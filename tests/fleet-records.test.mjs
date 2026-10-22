import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const domainUrl = url(compile(await readFile(new URL('../lib/fleet.ts', import.meta.url), 'utf8')));
const domain = await import(domainUrl);
const tables = ['appUsers','coordinators','fleetVehicles','fleetAssignments','fleetDocuments','fleetExpenses','fleetInvoices','fleetPayments','fleetIdle','fleetStations'];
const schemaUrl = url(tables.map(t => `export const ${t}=new Proxy({table:${JSON.stringify(t)}},{get:(o,k)=>k in o?o[k]:({table:o.table,key:k})});`).join('\n'));
const drizzleUrl = url('export const eq=(col,value)=>({col,value});export const and=(...args)=>({args});export const inArray=(col,values)=>({col,values});export const desc=x=>x;export const sql=(parts,...values)=>({parts,values});');
const dbUrl = url('export function getDb(){return globalThis.fleetRecordTest.db;}');
const authUrl = url('export async function getAuthenticatedUser(){return {email:"qa",userId:"1",authProvider:"supabase"};}export async function getKardexAccess(){return globalThis.fleetRecordTest.user;}');
const storageUrl = url('export function createSupabaseAdminClient(){return {storage:{from(){return {async list(folder,options){globalThis.fleetRecordTest.storageChecks++;return {data:[{name:options.search,id:"uploaded"}]};}};}}};}');
let server = compile(await readFile(new URL('../lib/fleet-server.ts', import.meta.url), 'utf8'));
for (const [name,value] of Object.entries({'../app/auth':authUrl,'./supabase-auth':storageUrl,'./fleet':domainUrl})) server=server.replaceAll(`"${name}"`,JSON.stringify(value));
const serverUrl=url(server);
let route = compile(await readFile(new URL('../app/api/fleet/route.ts', import.meta.url), 'utf8'));
for(const [name,value] of Object.entries({'drizzle-orm':drizzleUrl,'zod':import.meta.resolve('zod'),'../../../db':dbUrl,'../../../db/schema':schemaUrl,'../../../lib/fleet-server':serverUrl,'../../../lib/fleet':domainUrl,'../../../lib/supabase-storage':url('export async function resolveEvidenceImage(){return "";}')})) route=route.replaceAll(`"${name}"`,JSON.stringify(value));
const {POST,GET}=await import(url(route));

function matches(row,predicate) {
  if(!predicate)return true;
  if(predicate.args)return predicate.args.every(p=>matches(row,p));
  if(predicate.col)return predicate.values ? predicate.values.includes(row[predicate.col.key]) : row[predicate.col.key]===predicate.value;
  if(predicate.parts?.join('').includes("<> ''"))return row.startedAt!=='';
  return true;
}
function reset(usage='OPERACIONES') {
  const state={user:{id:1,displayName:'Prueba',active:true,role:'LOGISTICA'},storageChecks:0,writes:[],rows:{fleetVehicles:[{id:10,usage,status:'OPERATIVO',initialKm:100}],appUsers:[{id:2,role:'CONDUCTOR',active:true}],fleetAssignments:[],coordinators:[{name:'Coordinador F1',active:true,organization:'F1'}]}};
  const db={
    select(){let table,predicate;const query={from(t){table=t.table;return query;},where(p){predicate=p;return query;},orderBy(){return query;},for(){return query;},limit(){return query;},then(resolve,reject){return Promise.resolve((state.rows[table]||[]).filter(row=>matches(row,predicate))).then(resolve,reject);}};return query;},
    async execute(){},async transaction(run){return run(db);},
    insert(table){return {async values(value){state.writes.push({table:table.table,value});}};},
    update(table){return {set(value){return {async where(predicate){state.writes.push({table:table.table,value,predicate});}};}};},
  };
  state.db=db;globalThis.fleetRecordTest=state;return state;
}
const post = body => POST(new Request('https://f1.example/api/fleet',{method:'POST',headers:{origin:'https://f1.example','Content-Type':'application/json'},body:JSON.stringify(body)}));
const assignment = overrides => ({action:'assignment',vehicleId:10,serviceDate:domain.limaDate(),endDate:domain.limaDate(),expectedStart:'08:00',expectedEnd:'18:00',driverId:2,...overrides});
function journey(state,overrides={}) {const a={id:20,vehicleId:10,driverId:2,trackingMode:'OPERATIVO',planStatus:'CONFIRMADA',serviceDate:domain.limaDate(),endDate:domain.limaDate(),expectedStart:'08:00',expectedEnd:'18:00',startedAt:'',endedAt:'',coordinator:'Planificado',ceco:'7001',initialKm:null,finalKm:null,...overrides};state.rows.fleetAssignments=[a];return a;}
const record = overrides => ({action:'record',assignmentId:20,phase:'INICIO',odometer:150,coordinator:'Coordinador real',ceco:'7002',photos:domain.PHOTO_SLOTS.map((slot,i)=>({slot,path:`supabase://kardex-evidencias/fleet/1/assignment-20/INICIO/${i}.jpg`})),...overrides});

test('Administración guarda sin cuenta, horarios ni fotos e ignora una cuenta oculta del formulario',async()=>{
  const state=reset('ADMINISTRACION');const response=await post({action:'assignment',vehicleId:10,serviceDate:domain.limaDate(),responsibleName:'Gerencia',driverId:2});
  assert.equal(response.status,200);assert.equal(state.writes.length,1);
  const saved=state.writes[0].value;assert.equal(saved.driverId,null);assert.equal(saved.trackingMode,'ADMINISTRATIVO');assert.equal(saved.responsibleName,'Gerencia');assert.equal(saved.expectedStart,'');assert.equal(state.storageChecks,0);
});
test('Operaciones rechaza administradores, logística, inactivos y cuentas ausentes aunque se envíe modo administrativo',async()=>{
  for(const role of ['ADMINISTRADOR','LOGISTICA','CONDUCTOR',null]) {
    const state=reset();state.rows.appUsers=role?[{id:2,role,active:role!=='CONDUCTOR'}]:[];
    const response=await post(assignment({trackingMode:'ADMINISTRATIVO'}));assert.equal(response.status,400);assert.equal(state.writes.length,0);
  }
  const state=reset();assert.equal((await post(assignment({driverId:''}))).status,400);assert.equal(state.writes.length,0);
});
test('Operaciones conserva asignaciones con cuenta CONDUCTOR activa',async()=>{
  const state=reset();assert.equal((await post(assignment())).status,200);assert.equal(state.writes[0].value.trackingMode,'OPERATIVO');assert.equal(state.writes[0].value.driverId,2);
});
test('El servidor impide registrar Inicio o Final para administración antes de cargar evidencia',async()=>{
  for(const phase of ['INICIO','FINAL']){const state=reset('ADMINISTRACION');journey(state,{trackingMode:'ADMINISTRATIVO',driverId:null});const response=await post(record({phase,photos:[]}));assert.equal(response.status,400);assert.equal(state.storageChecks,0);assert.equal(state.writes.length,0);}
});
test('El Inicio operativo guarda coordinador y CECO junto al kilometraje y siete evidencias verificadas',async()=>{
  const state=reset();journey(state);const response=await post(record());assert.equal(response.status,200);assert.equal(state.storageChecks,7);assert.equal(state.writes[0].value.coordinator,'Coordinador real');assert.equal(state.writes[0].value.ceco,'7002');assert.equal(state.writes[0].value.startPhotos.length,7);
});
test('El Inicio rechaza fotos incompletas y datos de trabajo vacíos sin persistir',async()=>{
  for(const input of [{photos:[]},{coordinator:'  '},{ceco:''}]){const state=reset();journey(state);assert.equal((await post(record(input))).status,400);assert.equal(state.writes.length,0);}
});
test('Final conserva coordinador y CECO confirmados al Inicio',async()=>{
  const state=reset();journey(state,{startedAt:'2026-10-22T13:00:00Z',initialKm:100});
  const body=record({phase:'FINAL'});body.photos=body.photos.map(p=>({...p,path:p.path.replace('/INICIO/','/FINAL/')}));
  assert.equal((await post(body)).status,200);assert.equal(state.writes[0].value.coordinator,'Planificado');assert.equal(state.writes[0].value.ceco,'7001');
});
test('El conductor recibe los coordinadores F1 y únicamente sus jornadas operativas',async()=>{
  const state=reset();state.user={id:2,displayName:'Prueba',active:true,role:'CONDUCTOR'};const own=journey(state);state.rows.fleetAssignments=[own,{...own,id:21,driverId:3},{...own,id:22,trackingMode:'ADMINISTRATIVO'}];
  const response=await GET(new Request('https://f1.example/api/fleet'));const body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.coordinators,['Coordinador F1']);assert.deepEqual(body.assignments.map(a=>a.id),[20]);
});

const sourceRecord = overrides => ({format:'TOLL_REPORT',transactionId:'',time:'10:00:00',station:'Plaza de prueba',lane:'1',voucher:'FACTURA-1',voucherDate:'2026-10-22',file:'reporte.xlsx',sheet:'Consumo',row:3,...overrides});
const expense = overrides => ({vehicleId:10,date:domain.limaDate(),kind:'PEAJE',provider:'Red de prueba',reference:'FACTURA-1',amount:6.3,source:sourceRecord(),autoAssign:true,...overrides});
const preview = rows => post({action:'bulkPreview',rows});
test('El mismo comprobante permite varios pases, pero el mismo pase queda duplicado aunque cambie la factura',async()=>{
  reset();const body=await (await preview([expense(),expense({source:sourceRecord({time:'11:00:00'})}),expense({reference:'FACTURA-2',source:sourceRecord({voucher:'FACTURA-2'})})])).json();
  assert.equal(body.rows.length,3);assert.equal(body.rows.filter(r=>!r.error).length,2);assert.match(body.rows[2].error,/duplicada/);
});
test('Repetir un reporte de combustible detecta la transacción aun cuando cambie el ERP',async()=>{
  const state=reset();const item=expense({kind:'COMBUSTIBLE',fuel:'GLP',quantity:1,unit:'GAL',unitPrice:10,odometer:150,amount:10,source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-1'})});
  state.rows.fleetExpenses=[{fingerprint:createHash('sha256').update(JSON.stringify(domain.expenseIdentity(item))).digest('hex')}];
  const body=await (await preview([{...item,reference:'ERP-NUEVO'}])).json();assert.match(body.rows[0].error,/ya fue cargado/);assert.equal(state.writes.length,0);
});
test('La vista previa vincula una única jornada, conserva trazabilidad y alerta odómetro fuera del rango',async()=>{
  const state=reset();journey(state,{initialKm:100,finalKm:200});
  const body=await (await preview([expense({kind:'COMBUSTIBLE',fuel:'GLP',quantity:1,unit:'GAL',unitPrice:10,odometer:250,amount:10,source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-1'})})])).json();
  assert.equal(body.rows[0].assignmentId,20);assert.match(body.rows[0].warning,/fuera del rango/);assert.equal(body.rows[0].input.source.file,'reporte.xlsx');assert.equal(body.rows[0].input.autoAssign,false);assert.equal(state.writes.length,0);
});
test('Jornadas ambiguas no se atribuyen a un conductor automáticamente',async()=>{
  const state=reset();const a=journey(state);state.rows.fleetAssignments.push({...a,id:21});const body=await (await preview([expense()])).json();assert.equal(body.rows[0].assignmentId,null);assert.match(body.rows[0].warning,/Varias jornadas/);
});
test('Un archivo de 2,401 movimientos se guarda con inserciones por lotes dentro de una sola transacción',async()=>{
  const state=reset();const input=Array.from({length:2401},(_,i)=>expense({kind:'COMBUSTIBLE',fuel:'GLP',quantity:1,unit:'GAL',unitPrice:10,odometer:150,amount:10,autoAssign:false,source:sourceRecord({format:'FUEL_ATIO',transactionId:`transaction-${i}`})}));
  assert.equal((await post({action:'bulkExpense',rows:input})).status,200);assert.equal(state.writes.length,13);assert.equal(state.writes.flatMap(w=>w.value).length,2401);assert.ok(state.writes.every(w=>w.value.length<=200));
});
test('El guardado vuelve a validar y no escribe ningún gasto si encuentra una fila inválida',async()=>{
  const state=reset();const response=await post({action:'bulkExpense',rows:[expense(),expense({vehicleId:999})]});assert.equal(response.status,400);assert.equal(state.writes.length,0);
});
