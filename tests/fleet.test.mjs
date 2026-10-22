import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const domainUrl = moduleUrl(compile(await readFile(new URL('../lib/fleet.ts', import.meta.url), 'utf8')));
const f = await import(domainUrl);
const reportSource = compile(await readFile(new URL('../lib/fleet-report.ts', import.meta.url), 'utf8')).replace('"./fleet"', JSON.stringify(domainUrl));
const report = await import(moduleUrl(reportSource));

const fuelReading = (id, date, odometer, extra = {}) => ({ id, vehicleId: 1, date, kind: 'COMBUSTIBLE', odometer, amountCents: 10000, quantity: 10, unit: 'GAL', source: { time: '12:00:00' }, ...extra });

test('El recorrido de combustible ordena fecha y hora y resta odómetros acumulados sin sumar despachos repetidos', () => {
  const readings = [fuelReading(1, '2026-10-20', 1400), fuelReading(4, '2026-10-05', 1100, {source:{time:'18:00:00'}}), fuelReading(3, '2026-10-05', 1000), fuelReading(2, '2026-10-20', 1400)];
  const result = report.fuelDistance(readings);
  assert.equal(result.km, 400);
  assert.equal(result.first.id, 3);
  assert.equal(result.last.odometer, 1400);
  assert.equal(result.issues.length, 0);
  assert.equal(readings[0].id, 1, 'No modifica el orden del archivo original');
});
test('Sin dos lecturas distintas no inventa cero km; cero real se conserva', () => {
  assert.equal(report.fuelDistance([]).km, null);
  assert.equal(report.fuelDistance([fuelReading(1, '2026-10-05', 1000)]).km, null);
  assert.equal(report.fuelDistance([fuelReading(1, '2026-10-05', 1000), fuelReading(2, '2026-10-05', 1000)]).km, null);
  assert.equal(report.fuelDistance([fuelReading(1, '2026-10-05', 1000), fuelReading(2, '2026-10-06', 1000)]).km, 0);
});
test('Una lectura que retrocede bloquea el cálculo y conserva el dato y su origen para revisión', () => {
  const readings = [fuelReading(1, '2026-10-04', 46000), fuelReading(2, '2026-10-08', 46300), fuelReading(3, '2026-10-12', 36900), fuelReading(4, '2026-10-21', 47000)];
  const result = report.fuelDistance(readings);
  assert.equal(result.km, null);
  assert.equal(result.issues[0].reading.odometer, 36900);
  assert.equal(result.issues[0].previous.odometer, 46300);
  assert.match(result.status, /Revisar/);
});
test('No calcula con lecturas nulas ni infiere el orden de lecturas del mismo día sin hora', () => {
  for (const value of [null, -1, NaN]) assert.equal(report.fuelDistance([fuelReading(1, '2026-10-05', value), fuelReading(2, '2026-10-06', 1000)]).km, null);
  const result = report.fuelDistance([fuelReading(1, '2026-10-05', 1000, {source:null}), fuelReading(2, '2026-10-05', 1100, {source:null})]);
  assert.equal(result.km, null);
  assert.match(result.issues[0].reason, /hora/);
});
test('Las bases de combustible y jornadas se comparan por vehículo sin sumarse y permiten flota administrativa', () => {
  const vehicle = { id: 1, usage: 'ADMINISTRACION' };
  const expenses = [fuelReading(1, '2026-10-05', 1000), fuelReading(2, '2026-10-20', 1400), fuelReading(3, '2026-10-21', 99999, {vehicleId:2})];
  const assignments = [{vehicleId:1,trackingMode:'OPERATIVO',initialKm:1050,finalKm:1350,endedAt:'closed'}, {vehicleId:1,trackingMode:'OPERATIVO',initialKm:1400,finalKm:null,startedAt:'open',endedAt:''}, {vehicleId:2,initialKm:0,finalKm:10000,endedAt:'closed'}];
  const fuel = report.vehicleReport(vehicle, assignments, expenses, 'COMBUSTIBLE');
  assert.equal(fuel.km, 400);
  assert.equal(fuel.journeyKm, 300);
  assert.equal(fuel.costPerKm, 20000 / 400);
  assert.equal(report.vehicleReport(vehicle, assignments, expenses, 'JORNADAS').km, 300);
  assert.equal(report.vehicleReport(vehicle, [], expenses, 'COMBUSTIBLE').km, 400);
  assert.equal(report.vehicleReport(vehicle, [], expenses, 'JORNADAS').km, null);
});
test('El reporte respeta las fechas filtradas sin usar el máximo histórico ni el odómetro de mantenimiento', () => {
  const all = [fuelReading(1,'2026-09-30',900),fuelReading(2,'2026-10-05',1000),fuelReading(3,'2026-10-20',1400),fuelReading(4,'2026-11-01',2000),fuelReading(5,'2026-10-21',90000,{kind:'MANTENIMIENTO'})];
  const row = report.vehicleReport({id:1},[],all.filter(e=>e.date>='2026-10-01'&&e.date<='2026-10-22'),'COMBUSTIBLE');
  assert.equal(row.km,400);
  assert.equal(row.odometers.readings.length,2);
  assert.equal(row.cost,30000);
});
test('El costo por km ponderado excluye unidades sin km válido sin perder sus gastos del total', () => {
  const expenses = [fuelReading(1,'2026-10-05',1000),fuelReading(2,'2026-10-20',1400),fuelReading(3,'2026-10-05',5000,{vehicleId:2}),fuelReading(4,'2026-10-20',4900,{vehicleId:2})];
  const rows = [1,2].map(id=>report.vehicleReport({id},[],expenses,'COMBUSTIBLE'));
  const total = report.reportTotals(rows);
  assert.equal(total.km,400);
  assert.equal(total.cost,40000);
  assert.equal(total.comparableCost,20000);
  assert.equal(total.excludedCost,20000);
  assert.equal(total.costPerKm,50);
  assert.equal(total.missing,1);
  assert.equal(total.efficiency,20);
  assert.equal(report.reportTotals([rows[1]]).km,null);
  assert.equal(report.reportTotals([rows[1]]).costPerKm,null);
});
test('El rendimiento global compara solo los km y el combustible líquido de las mismas unidades', () => {
  const expenses = [fuelReading(1,'2026-10-05',1000,{unit:'L',quantity:37.85411784}),fuelReading(2,'2026-10-20',1400,{unit:'L',quantity:37.85411784}),fuelReading(3,'2026-10-05',5000,{vehicleId:2,unit:'M3'}),fuelReading(4,'2026-10-20',5900,{vehicleId:2,unit:'M3'})];
  const total = report.reportTotals([1,2].map(id=>report.vehicleReport({id},[],expenses,'COMBUSTIBLE')));
  assert.equal(total.km,1300);
  assert.ok(Math.abs(total.efficiency-20)<1e-9);
});

test('Inicio y Final se evalúan contra la hora de Perú, incluyendo viajes de varios días', () => {
  const a = { planStatus:'CONFIRMADA',serviceDate:'2026-10-21',endDate:'2026-10-22',expectedStart:'08:00',expectedEnd:'18:00',startedAt:'',endedAt:'' };
  assert.equal(f.assignmentStatus(a,new Date('2026-10-21T12:59:00Z')),'Programada');
  assert.equal(f.assignmentStatus(a,new Date('2026-10-21T13:01:00Z')),'Sin Inicio');
  a.startedAt='2026-10-21T13:00:00Z';
  assert.equal(f.assignmentStatus(a,new Date('2026-10-22T22:59:00Z')),'En jornada');
  assert.equal(f.assignmentStatus(a,new Date('2026-10-22T23:01:00Z')),'Cierre pendiente');
  a.endedAt='2026-10-22T23:05:00Z';
  assert.equal(f.assignmentStatus(a,new Date('2026-10-23T02:00:00Z')),'Finalizada');
});
test('No salió requiere un estado explícito; la falta de registro conserva su condición',()=>{
  assert.equal(f.assignmentStatus({planStatus:'NO_SALIO'}),'No salió');
  assert.equal(f.assignmentStatus({planStatus:'CANCELADA'}),'Cancelada');
  assert.equal(f.assignmentStatus({planStatus:'POR_CONFIRMAR',startedAt:''}),'Por confirmar');
});
test('Las jornadas abiertas no agregan kilómetros al reporte',()=>{
  assert.equal(f.distance({initialKm:1000,finalKm:null,endedAt:''}),0);
  assert.equal(f.distance({initialKm:1000,finalKm:1360,endedAt:'closed'}),360);
});
test('Se convierte litros a galones y el GNV no se mezcla con combustibles líquidos',()=>{
  assert.equal(f.gallons({kind:'COMBUSTIBLE',unit:'GAL',quantity:10}),10);
  assert.ok(Math.abs(f.gallons({kind:'COMBUSTIBLE',unit:'L',quantity:37.85411784})-10)<1e-9);
  assert.equal(f.gallons({kind:'COMBUSTIBLE',unit:'M3',quantity:20}),0);
  assert.equal(f.gallons({kind:'PEAJE',unit:'GAL',quantity:100}),0);
});
test('El ralentí acumula más de 24 horas sin reiniciar el contador',()=>{
  assert.equal(f.minutesFromTime('01:35'),95);
  assert.equal(f.timeFromMinutes(27*60+15),'27:15');
  assert.throws(()=>f.minutesFromTime('1.35'));
  assert.throws(()=>f.minutesFromTime('01:60'));
  assert.throws(()=>f.minutesFromTime('-1:20'));
});
test('Hay siete evidencias definidas, incluida el acta de recepción y entrega',()=>{
  assert.equal(f.PHOTO_SLOTS.length,7);assert.equal(new Set(f.PHOTO_SLOTS).size,7);
  assert.ok(f.PHOTO_SLOTS.includes('Control de recepción y entrega'));
});
test('Vencimiento y próximos 30 días respetan los límites de fecha',()=>{
  assert.equal(f.documentStatus({expiryDate:'2026-10-20'},'2026-10-21'),'Vencido');
  assert.equal(f.documentStatus({expiryDate:'2026-10-21'},'2026-10-21'),'Vence en 0 días');
  assert.equal(f.documentStatus({expiryDate:'2026-11-20'},'2026-10-21'),'Vence en 30 días');
  assert.equal(f.documentStatus({expiryDate:'2026-11-21'},'2026-10-21'),'Vigente');
});
test('La fecha local cambia a medianoche de Lima y normaliza placas',()=>{
  assert.equal(f.limaDate(new Date('2026-10-22T03:00:00Z')),'2026-10-21');
  assert.equal(f.normalizedPlate(' abc-123 '),'ABC123');
});
test('Los puntos sin coordenadas verificadas se excluyen de cercanía',()=>{
  assert.equal(f.stationDistance({latitude:-12,longitude:-77,verified:false},-12,-77),Infinity);
  assert.equal(f.stationDistance({latitude:-12,longitude:-77,verified:true},-12,-77),0);
});

// Exercise the real access gate with only its external identity provider replaced.
globalThis.fleetTestIdentity = {};
const authStub = moduleUrl('export async function getAuthenticatedUser(){return globalThis.fleetTestIdentity.user;} export async function getKardexAccess(){return globalThis.fleetTestIdentity.access;}');
const storageStub = moduleUrl('export function createSupabaseAdminClient(){throw new Error("Storage no debe intervenir en autorización");}');
let source=compile(await readFile(new URL('../lib/fleet-server.ts',import.meta.url),'utf8'));
source=source.replace('"../app/auth"',JSON.stringify(authStub)).replace('"./supabase-auth"',JSON.stringify(storageStub)).replace('"./fleet"',JSON.stringify(domainUrl));
const server=await import(moduleUrl(source));
test('La autorización rechaza sesión ausente, inactivos, coordinadores y contraseña temporal',async()=>{
  for(const state of [
    {user:null,access:null,status:401},
    {user:{email:'qa',userId:'1',authProvider:'supabase'},access:{id:1,role:'CONDUCTOR',active:false},status:403},
    {user:{email:'qa',userId:'1',authProvider:'supabase'},access:{id:1,role:'COORDINADOR',active:true},status:403},
    {user:{email:'qa',userId:'1',authProvider:'supabase'},access:{id:1,role:'CONDUCTOR',active:true,mustChangePassword:true},status:403},
  ]){globalThis.fleetTestIdentity=state;await assert.rejects(server.fleetAccess(),e=>e.status===state.status);}
});
test('Conductor y solo lectura no obtienen permisos de administración',async()=>{
  for(const role of ['CONDUCTOR','SOLO_LECTURA','LOGISTICA','ADMINISTRADOR']){
    globalThis.fleetTestIdentity={user:{email:'qa',userId:'1',authProvider:'supabase'},access:{id:1,role,active:true,displayName:'QA'}};
    assert.equal((await server.fleetAccess()).manager,['LOGISTICA','ADMINISTRADOR'].includes(role));
  }
});
test('Las modificaciones rechazan un origen externo',()=>{
  assert.throws(()=>server.sameOrigin(new Request('https://f1.example/api/fleet',{headers:{origin:'https://otro.example'}})),e=>e.status===403);
  assert.doesNotThrow(()=>server.sameOrigin(new Request('https://f1.example/api/fleet',{headers:{origin:'https://f1.example'}})));
});


test('Administración no genera pendientes de Inicio ni Final',()=>{
  for (const a of [
    {trackingMode:'ADMINISTRATIVO',startedAt:'',endedAt:''},
    {trackingMode:'ADMINISTRATIVO',planStatus:'CONFIRMADA',serviceDate:'2020-01-01',expectedStart:''},
  ]) assert.equal(f.assignmentStatus(a,new Date('2026-10-22T20:00:00Z')),'Registro administrativo');
});
test('Las cuentas elegibles para conducir son únicamente CONDUCTOR activo',()=>{
  const users=[{id:1,role:'CONDUCTOR',active:true},{id:2,role:'CONDUCTOR',active:false},{id:3,role:'ADMINISTRADOR',active:true},{id:4,role:'LOGISTICA',active:true}];
  assert.deepEqual(f.activeDrivers(users).map(u=>u.id),[1]);
});
test('Inicio exige el coordinador y CECO reales del trabajo',()=>{
  assert.deepEqual(f.journeyWork({coordinator:'Plan',ceco:'Antiguo'},'INICIO',{coordinator:' Coordinador real ',ceco:' 7001 '}),{coordinator:'Coordinador real',ceco:'7001'});
  for(const input of [{coordinator:'',ceco:'7001'},{coordinator:'Persona',ceco:'  '}]) assert.throws(()=>f.journeyWork({coordinator:'Plan',ceco:'Plan'},'INICIO',input),/coordinador y el CECO/);
});
test('Final conserva la atribución confirmada al Inicio y permite completar jornadas antiguas',()=>{
  assert.deepEqual(f.journeyWork({coordinator:'Confirmado',ceco:'7001'},'FINAL',{coordinator:'Otro',ceco:'9999'}),{coordinator:'Confirmado',ceco:'7001'});
  assert.deepEqual(f.journeyWork({coordinator:'',ceco:'7001'},'FINAL',{coordinator:'Completar',ceco:'9999'}),{coordinator:'Completar',ceco:'7001'});
});
