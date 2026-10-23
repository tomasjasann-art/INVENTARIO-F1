import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const domainUrl = url(compile(await readFile(new URL('../lib/fleet.ts', import.meta.url), 'utf8')));
const domain = await import(domainUrl);
const syncUrl = url(compile(await readFile(new URL('../lib/fleet-sync.ts', import.meta.url), 'utf8')));
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
for(const [name,value] of Object.entries({'drizzle-orm':drizzleUrl,'zod':import.meta.resolve('zod'),'../../../db':dbUrl,'../../../db/schema':schemaUrl,'../../../lib/fleet-server':serverUrl,'../../../lib/fleet':domainUrl,'../../../lib/fleet-sync':syncUrl,'../../../lib/supabase-storage':url('export async function resolveEvidenceImage(){return "";}')})) route=route.replaceAll(`"${name}"`,JSON.stringify(value));
const {POST,GET}=await import(url(route));

function matches(row,predicate) {
  if(!predicate)return true;
  if(predicate.args)return predicate.args.every(p=>matches(row,p));
  if(predicate.col)return predicate.values ? predicate.values.includes(row[predicate.col.key]) : row[predicate.col.key]===predicate.value;
  if(predicate.parts?.join('').includes("<> ''"))return row.startedAt!=='';
  return true;
}
function reset(usage='OPERACIONES') {
  const state={user:{id:1,displayName:'Prueba',active:true,role:'LOGISTICA'},storageChecks:0,writes:[],nextExpenseId:100,rows:{fleetVehicles:[{id:10,usage,status:'OPERATIVO',initialKm:100}],appUsers:[{id:2,role:'CONDUCTOR',active:true}],fleetAssignments:[],coordinators:[{name:'Coordinador F1',active:true,organization:'F1'}]}};
  const db={
    select(){let table,predicate;const query={from(t){table=t.table;return query;},where(p){predicate=p;return query;},orderBy(){return query;},for(){return query;},limit(){return query;},then(resolve,reject){return Promise.resolve((state.rows[table]||[]).filter(row=>matches(row,predicate))).then(resolve,reject);}};return query;},
    async execute(){},async transaction(run){const previous=structuredClone({rows:state.rows,writes:state.writes});try{return await run(db);}catch(e){state.rows=previous.rows;state.writes=previous.writes;throw e;}},
    insert(table){return {values(value){let conflict;const query={onConflictDoUpdate(options){conflict=options;return query;},then(resolve,reject){return Promise.resolve().then(()=>{state.writes.push({table:table.table,value,conflict});if(table.table==='fleetExpenses'){const saved=state.rows.fleetExpenses ||= [];for(const next of Array.isArray(value)?value:[value]){const old=saved.find(r=>r.fingerprint===next.fingerprint);if(old&&!conflict)throw Object.assign(new Error('duplicate'),{code:'23505'});if(old){for(const key of Object.keys(conflict.set))old[key]=next[key];}else saved.push({...next,id:state.nextExpenseId++});}}else{const saved=state.rows[table.table] ||= [];for(const next of Array.isArray(value)?value:[value])saved.push({...next,id:next.id || state.nextExpenseId++});}}).then(resolve,reject);}};return query;}};},
    delete(table){return {async where(predicate){state.writes.push({table:table.table,deleted:true,predicate});state.rows[table.table]=(state.rows[table.table]||[]).filter(row=>!matches(row,predicate));}};},
    update(table){return {set(value){return {async where(predicate){state.writes.push({table:table.table,value,predicate});for(const row of state.rows[table.table]||[])if(matches(row,predicate))Object.assign(row,value);}};}};},
  };
  state.db=db;globalThis.fleetRecordTest=state;return state;
}
const post = body => POST(new Request('https://f1.example/api/fleet',{method:'POST',headers:{origin:'https://f1.example','Content-Type':'application/json'},body:JSON.stringify(body)}));
const assignment = overrides => ({action:'assignment',vehicleId:10,serviceDate:domain.limaDate(),endDate:domain.limaDate(),expectedStart:'08:00',expectedEnd:'18:00',driverId:2,...overrides});
function journey(state,overrides={}) {const a={id:20,vehicleId:10,driverId:2,trackingMode:'OPERATIVO',responsibleName:'',reason:'',site:'',finalZone:'',notes:'',createdBy:'original',updatedAt:'2026-10-22T12:00:00Z',startPhotos:[],endPhotos:[],planStatus:'CONFIRMADA',serviceDate:domain.limaDate(),endDate:domain.limaDate(),expectedStart:'08:00',expectedEnd:'18:00',startedAt:'',endedAt:'',coordinator:'Planificado',ceco:'7001',initialKm:null,finalKm:null,...overrides};state.rows.fleetAssignments=[a];return a;}
const record = overrides => ({action:'record',assignmentId:20,phase:'INICIO',odometer:150,coordinator:'Coordinador real',ceco:'7002',photos:domain.PHOTO_SLOTS.map((slot,i)=>({slot,path:`supabase://kardex-evidencias/fleet/1/assignment-20/INICIO/${i}.jpg`})),...overrides});

const version = (entity, row) => domain.fleetRecordVersion(entity,row);
const deletion = (entity, row, extra={}) => post({action:'deleteRecord',entity,id:row.id,_version:version(entity,row),confirmed:true,...extra});
const invoiceRow = (state,extra={}) => {const row={id:30,provider:'PRIMAX',number:'F001-1',issueDate:'2026-10-01',dueDate:'2026-10-31',totalCents:10000,attachment:'supabase://kardex-evidencias/fleet/9/invoice/original.pdf',notes:'Anterior',...extra};state.rows.fleetInvoices=[row];return row;};
const documentRow = (state,extra={}) => {const row={id:40,vehicleId:10,kind:'SOAT',provider:'Aseguradora',reference:'POLIZA-1',startDate:'2026-01-01',expiryDate:'2027-01-01',attachment:'supabase://kardex-evidencias/fleet/9/document/original.pdf',notes:'Anterior',...extra};state.rows.fleetDocuments=[row];return row;};
const editInvoice = (row,extra={}) => post({...row,action:'invoice',amount:row.totalCents/100,_version:version('invoice',row),...extra});
const editDocument = (row,extra={}) => post({...row,action:'document',_version:version('document',row),...extra});
const editAssignment = (row,extra={}) => post({...row,action:'assignment',_version:version('assignment',row),...extra});

test('Editar un documento conserva su ID y el adjunto de otro administrador sin duplicar la renovación',async()=>{
 const state=reset(),row=documentRow(state);const response=await editDocument(row,{reference:'POLIZA-CORREGIDA'});
 assert.equal(response.status,200);assert.equal(state.rows.fleetDocuments.length,1);assert.equal(state.rows.fleetDocuments[0].id,40);assert.equal(state.rows.fleetDocuments[0].reference,'POLIZA-CORREGIDA');assert.equal(state.rows.fleetDocuments[0].attachment,row.attachment);assert.equal(state.storageChecks,0);
 assert.equal((await editDocument(state.rows.fleetDocuments[0],{attachment:'supabase://kardex-evidencias/fleet/9/document/ajeno.pdf'})).status,400);
});
test('Las correcciones de documentos conservan las reglas de cada tipo y detectan cambios concurrentes',async()=>{
 const state=reset(),row=documentRow(state),original={...row};row.notes='Cambio de otro usuario';
 assert.equal((await editDocument(original,{reference:'NO APLICAR'})).status,409);assert.equal(state.writes.length,0);
 assert.equal((await editDocument(row,{kind:'TARJETA_PROPIEDAD'})).status,200);assert.equal(state.rows.fleetDocuments[0].expiryDate,'');
});
test('Editar una factura conserva ID, pagos, abastecimientos y adjunto',async()=>{
 const state=reset(),row=invoiceRow(state);state.rows.fleetPayments=[{id:50,invoiceId:30,amountCents:5000}];state.rows.fleetExpenses=[{id:60,invoiceId:30,provider:'PRIMAX'}];
 assert.equal((await editInvoice(row,{number:'F001-CORREGIDA',amount:120})).status,200);
 assert.equal(state.rows.fleetInvoices.length,1);assert.equal(state.rows.fleetInvoices[0].id,30);assert.equal(state.rows.fleetInvoices[0].totalCents,12000);assert.equal(state.rows.fleetInvoices[0].attachment,row.attachment);assert.equal(state.rows.fleetPayments.length,1);assert.equal(state.rows.fleetExpenses[0].invoiceId,30);assert.equal(state.storageChecks,0);
});
test('Una factura no admite total menor que lo pagado ni proveedor incompatible con sus despachos',async()=>{
 const state=reset(),row=invoiceRow(state);state.rows.fleetPayments=[{invoiceId:30,amountCents:5000}];state.rows.fleetExpenses=[{invoiceId:30,provider:'PRIMAX'}];
 assert.equal((await editInvoice(row,{amount:40})).status,400);assert.equal((await editInvoice(row,{provider:'OTRO'})).status,400);assert.equal(state.writes.length,0);
});
test('Una asignación sin Inicio permite corregir sus datos y conserva al creador',async()=>{
 const state=reset(),row=journey(state);
 assert.equal((await editAssignment(row,{site:'SITE CORREGIDO',coordinator:'Coordinador real'})).status,200);
 assert.equal(state.rows.fleetAssignments[0].site,'SITE CORREGIDO');assert.equal(state.rows.fleetAssignments[0].createdBy,'original');assert.equal(state.rows.fleetAssignments.length,1);
});
test('Con Inicio se corrige la atribución sin cambiar la identidad, fotos ni kilometraje de la jornada',async()=>{
 const state=reset(),row=journey(state,{startedAt:'2026-10-22T13:00:00Z',initialKm:150,startPhotos:[{slot:'Frente',path:'original'}]});
 state.rows.appUsers[0].active=false;state.rows.fleetVehicles[0].status='MANTENIMIENTO';
 assert.equal((await editAssignment(row,{coordinator:'Corrección',ceco:'9001',site:'Otro SITE'})).status,200);
 const saved=state.rows.fleetAssignments[0];assert.equal(saved.coordinator,'Corrección');assert.equal(saved.initialKm,150);assert.equal(saved.startedAt,'2026-10-22T13:00:00Z');assert.deepEqual(saved.startPhotos,[{slot:'Frente',path:'original'}]);
 assert.equal((await editAssignment(saved,{serviceDate:'2026-10-21'})).status,400);assert.equal((await editAssignment(saved,{ceco:''})).status,400);
});
test('La asignación rechaza una corrección incompatible con gastos vinculados',async()=>{
 const state=reset(),row=journey(state);state.rows.fleetExpenses=[{id:60,assignmentId:20,vehicleId:10,date:row.serviceDate}];
 assert.equal((await editAssignment(row,{serviceDate:'2026-10-23',endDate:'2026-10-23'})).status,400);assert.equal(state.writes.length,0);
});
test('Eliminar un documento o una asignación vacía elimina solo la fila seleccionada',async()=>{
 for(const entity of ['document','assignment','invoice']){const state=reset(),row=entity==='document'?documentRow(state):entity==='assignment'?journey(state):invoiceRow(state);
 const table={document:'fleetDocuments',assignment:'fleetAssignments',invoice:'fleetInvoices'}[entity];state.rows[table].push({...row,id:999});
 assert.equal((await deletion(entity,row)).status,200);assert.deepEqual(state.rows[table].map(r=>r.id),[999]);}
});
test('Eliminar exige confirmación y versión vigente; no borra un registro modificado',async()=>{
 const state=reset(),row=documentRow(state);assert.equal((await deletion('document',row,{confirmed:false})).status,400);
 assert.equal((await deletion('document',row,{_version:'ANTIGUA'})).status,409);assert.equal(state.writes.length,0);
});
test('No se eliminan asignaciones iniciadas o con gastos, ni facturas con pagos o abastecimientos',async()=>{
 for(const mode of ['started','assignmentExpense','invoiceExpense','payment']){const state=reset();let entity,row;
 if(mode==='started'||mode==='assignmentExpense'){entity='assignment';row=journey(state,{startedAt:mode==='started'?'2026-10-22T13:00:00Z':''});if(mode==='assignmentExpense')state.rows.fleetExpenses=[{assignmentId:20}];}
 else {entity='invoice';row=invoiceRow(state);if(mode==='payment')state.rows.fleetPayments=[{invoiceId:30,amountCents:1}];else state.rows.fleetExpenses=[{invoiceId:30}];}
 assert.equal((await deletion(entity,row)).status,400);assert.equal(state.writes.length,0);}
});
test('Guardar una carga vuelve a comprobar las vinculaciones si la factura o asignación cambió',async()=>{
 for(const entity of ['invoice','assignment']) {
  const state=reset();const row=entity==='invoice'?invoiceRow(state):journey(state);
  const run=state.db.transaction;state.db.transaction=async callback=>{if(entity==='invoice')row.provider='OTRO';else row.vehicleId=999;return run(callback);};
  const response=await post({action:'expense',vehicleId:10,date:domain.limaDate(),kind:'COMBUSTIBLE',provider:'PRIMAX',reference:'QA-VALIDACION',fuel:'GLP',quantity:1,unit:'GAL',amount:10,odometer:150,...(entity==='invoice'?{invoiceId:30}:{assignmentId:20})});
  assert.equal(response.status,409);assert.equal(state.writes.length,0);
 }
});
test('Conductores y solo lectura no pueden editar ni eliminar estos registros',async()=>{
 for(const role of ['CONDUCTOR','SOLO_LECTURA']){const state=reset(),row=documentRow(state);state.user.role=role;assert.equal((await editDocument(row)).status,403);assert.equal((await deletion('document',row)).status,403);assert.equal(state.writes.length,0);}
});

test('La tarjeta de propiedad guarda fecha de emisión y no exige vencimiento ni proveedor',async()=>{
  const state=reset();
  const response=await post({action:'document',vehicleId:10,kind:'TARJETA_PROPIEDAD',reference:'TARJETA-QA',startDate:'2026-10-22'});
  assert.equal(response.status,200);assert.equal(state.writes.length,1);
  assert.equal(state.writes[0].value.kind,'TARJETA_PROPIEDAD');assert.equal(state.writes[0].value.expiryDate,'');assert.equal(state.writes[0].value.startDate,'2026-10-22');
  assert.equal(domain.documentStatus(state.writes[0].value,'2030-01-01'),'Sin vencimiento');
});
test('SOAT, revisión técnica y seguro mantienen el vencimiento obligatorio y sus renovaciones',async()=>{
  for(const kind of ['SOAT','REVISION_TECNICA','SEGURO']) {
    const state=reset();const input={action:'document',vehicleId:10,kind,reference:'CERTIFICADO-QA',startDate:'2026-10-22'};
    for(const expiryDate of ['',undefined,'2026-10-21']){assert.equal((await post({...input,expiryDate})).status,400);assert.equal(state.writes.length,0);}
    assert.equal((await post({...input,expiryDate:'2027-10-22'})).status,200);
    assert.equal(state.writes[0].value.expiryDate,'2027-10-22');
  }
});

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

test('El directorio del conductor muestra solo estaciones activas',async()=>{
  const state=reset();state.user={id:2,displayName:'Prueba',active:true,role:'CONDUCTOR'};
  state.rows.fleetStations=[{id:1,active:true,name:'Activa'},{id:2,active:false,name:'Inactiva'}];
  const response=await GET(new Request('https://f1.example/api/fleet'));const body=await response.json();assert.deepEqual(body.stations.map(s=>s.id),[1]);
});

const sourceRecord = overrides => ({format:'TOLL_REPORT',transactionId:'',time:'10:00:00',station:'Plaza de prueba',lane:'1',voucher:'FACTURA-1',voucherDate:'2026-10-22',file:'reporte.xlsx',sheet:'Consumo',row:3,...overrides});
const expense = overrides => ({vehicleId:10,date:domain.limaDate(),kind:'PEAJE',provider:'Red de prueba',reference:'FACTURA-1',amount:6.3,source:sourceRecord(),autoAssign:true,...overrides});
const storedFuel = (input, extra={}) => ({id:50,vehicleId:input.vehicleId,assignmentId:null,date:input.date,kind:input.kind,amountCents:Math.round(input.amount*100),quantity:input.quantity,unit:input.unit,fuel:input.fuel,unitPrice:input.unitPrice,odometer:input.odometer,provider:input.provider,reference:input.reference,collector:'',invoiceId:null,maintenanceType:'',nextKm:null,attachment:'',notes:'',source:input.source,fingerprint:createHash('sha256').update(JSON.stringify(domain.expenseIdentity(input))).digest('hex'),createdBy:'original',...extra});
const preview = rows => post({action:'bulkPreview',rows});
test('El mismo comprobante permite varios pases, pero el mismo pase queda duplicado aunque cambie la factura',async()=>{
  reset();const body=await (await preview([expense(),expense({source:sourceRecord({time:'11:00:00'})}),expense({reference:'FACTURA-2',source:sourceRecord({voucher:'FACTURA-2'})})])).json();
  assert.equal(body.rows.length,3);assert.equal(body.rows.filter(r=>!r.error).length,2);assert.match(body.rows[2].error,/duplicada/);
});
test('Corregir el ERP identifica la misma transacción y propone actualizar esa fila',async()=>{
  const state=reset();const item=expense({kind:'COMBUSTIBLE',fuel:'GLP',quantity:1,unit:'GAL',unitPrice:10,odometer:150,amount:10,source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-1'})});
  state.rows.fleetExpenses=[storedFuel(item)];
  const body=await (await preview([{...item,reference:'ERP-NUEVO'}])).json();assert.equal(body.rows[0].error,undefined);assert.equal(body.rows[0].operation,'ACTUALIZAR');assert.equal(body.rows[0].changes[0].field,'reference');assert.equal(state.writes.length,0);
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

const fuelExpense = (extra={}) => expense({kind:'COMBUSTIBLE',fuel:'GLP',quantity:1,unit:'GAL',unitPrice:10,odometer:150,amount:10,source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-1'}),...extra});
const validatedInputs = async inputs => {
  const response=await preview(inputs);assert.equal(response.status,200);
  return (await response.json()).rows;
};
test('Repetir el mismo reporte o renombrarlo deja el combustible sin cambios y sin escrituras',async()=>{
  const state=reset(),original=fuelExpense();state.rows.fleetExpenses=[storedFuel(original)];
  const rows=await validatedInputs([{...original,source:{...original.source,file:'renombrado.xlsx',sheet:'Otra hoja',row:500}}]);
  assert.equal(rows[0].operation,'SIN_CAMBIOS');assert.deepEqual(rows[0].changes,[]);
  const response=await post({action:'bulkExpense',rows:rows.map(r=>r.input)});
  assert.deepEqual((await response.json()).import,{inserted:0,updated:0,unchanged:1});assert.equal(state.writes.length,0);assert.equal(state.rows.fleetExpenses[0].source.file,'reporte.xlsx');
});
test('Una carga mixta agrega solo el nuevo, corrige solo el modificado y se puede repetir sin duplicados',async()=>{
  const state=reset(),first=fuelExpense(),second=fuelExpense({source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-2'})});
  state.rows.fleetExpenses=[storedFuel(first),storedFuel(second,{id:51})];
  const third=fuelExpense({source:sourceRecord({format:'FUEL_ATIO',transactionId:'transaction-3'})});
  const rows=await validatedInputs([first,{...second,odometer:175},third]);
  assert.deepEqual(rows.map(r=>r.operation),['SIN_CAMBIOS','ACTUALIZAR','NUEVO']);
  assert.deepEqual(rows[1].changes,[{field:'odometer',label:'Odómetro',before:150,after:175}]);
  const inputs=rows.map(r=>r.input),response=await post({action:'bulkExpense',rows:inputs});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).import,{inserted:1,updated:1,unchanged:1});
  assert.equal(state.rows.fleetExpenses.length,3);assert.equal(state.rows.fleetExpenses.find(e=>e.id===51).odometer,175);assert.equal(state.rows.fleetExpenses.find(e=>e.id===50).odometer,150);
  const writes=state.writes.length;
  const again=await post({action:'bulkExpense',rows:inputs});assert.equal(again.status,200);assert.deepEqual((await again.json()).import,{inserted:0,updated:0,unchanged:3});assert.equal(state.writes.length,writes);
});
test('La corrección conserva el ID, el creador, las vinculaciones, notas y sustento, y registra antes/después',async()=>{
  const state=reset(),input=fuelExpense();journey(state,{initialKm:100,finalKm:200});
  state.rows.fleetInvoices=[{id:9,provider:input.provider}];
  state.rows.fleetExpenses=[storedFuel(input,{assignmentId:20,invoiceId:9,notes:'Nota interna',attachment:'sustento existente',createdBy:'original'})];
  const rows=await validatedInputs([{...input,odometer:180,notes:'Texto del archivo'}]);
  assert.equal(rows[0].input.assignmentId,20);assert.equal(rows[0].input.invoiceId,9);
  assert.equal((await post({action:'bulkExpense',rows:rows.map(r=>r.input)})).status,200);
  const saved=state.rows.fleetExpenses[0];
  assert.equal(saved.id,50);assert.equal(saved.createdBy,'original');assert.equal(saved.assignmentId,20);assert.equal(saved.invoiceId,9);assert.equal(saved.notes,'Nota interna');assert.equal(saved.attachment,'sustento existente');
  assert.equal(saved.source.corrections.length,1);assert.equal(saved.source.corrections[0].by,'1:Prueba');assert.deepEqual(saved.source.corrections[0].changes,[{field:'odometer',label:'Odómetro',before:150,after:180}]);
});
test('No crea una nueva vinculación automática al corregir un movimiento que estaba pendiente',async()=>{
  const state=reset(),input=fuelExpense();state.rows.fleetExpenses=[storedFuel(input)];journey(state);
  const rows=await validatedInputs([{...input,odometer:180}]);
  assert.equal(rows[0].assignmentId,null);
  assert.equal((await post({action:'bulkExpense',rows:rows.map(r=>r.input)})).status,200);assert.equal(state.rows.fleetExpenses[0].assignmentId,null);
});
test('Corregir volumen, precio, importe y comprobante mantiene una sola transacción',async()=>{
  const state=reset(),input=fuelExpense();state.rows.fleetExpenses=[storedFuel(input)];
  const changed={...input,quantity:2,unitPrice:12,amount:24,reference:'ERP-2',source:{...input.source,station:'Otra estación',voucher:'ERP-2',time:'11:00:00'}};
  const rows=await validatedInputs([changed]);assert.equal(rows[0].operation,'ACTUALIZAR');assert.ok(rows[0].changes.some(c=>c.field==='amountCents'&&c.before===1000&&c.after===2400));
  assert.equal((await post({action:'bulkExpense',rows:rows.map(r=>r.input)})).status,200);
  assert.equal(state.rows.fleetExpenses.length,1);assert.equal(state.rows.fleetExpenses[0].amountCents,2400);assert.equal(state.rows.fleetExpenses[0].quantity,2);assert.equal(state.rows.fleetExpenses[0].source.station,'Otra estación');
});
test('Un cambio posterior a la vista previa bloquea el lote completo antes de insertar o corregir',async()=>{
  const state=reset(),input=fuelExpense();state.rows.fleetExpenses=[storedFuel(input)];
  const rows=await validatedInputs([{...input,odometer:180},fuelExpense({source:sourceRecord({format:'FUEL_ATIO',transactionId:'new-id'})})]);
  state.rows.fleetExpenses[0].odometer=190;
  const response=await post({action:'bulkExpense',rows:rows.map(r=>r.input)});assert.equal(response.status,409);assert.match((await response.json()).error,/Vuelve a validar/);
  assert.equal(state.rows.fleetExpenses.length,1);assert.equal(state.rows.fleetExpenses[0].odometer,190);assert.equal(state.writes.length,0);
});
test('Una transacción nueva que aparece después de validar no se sobrescribe a ciegas',async()=>{
  const state=reset(),input=fuelExpense(),rows=await validatedInputs([input]);state.rows.fleetExpenses=[storedFuel({...input,odometer:200})];
  assert.equal((await post({action:'bulkExpense',rows:rows.map(r=>r.input)})).status,409);assert.equal(state.rows.fleetExpenses[0].odometer,200);assert.equal(state.writes.length,0);
});
test('Cambiar placa o fecha no rompe una jornada ya vinculada',async()=>{
  const state=reset(),input=fuelExpense();journey(state);state.rows.fleetExpenses=[storedFuel(input,{assignmentId:20})];
  const rows=await validatedInputs([{...input,date:'2026-01-01',autoAssign:false}]);assert.match(rows[0].error,/jornada vinculada/);
  assert.equal((await post({action:'bulkExpense',rows:[{...input,date:'2026-01-01',autoAssign:false}]})).status,409);assert.equal(state.writes.length,0);
});
test('Cambiar el proveedor no rompe una factura vinculada',async()=>{
  const state=reset(),input=fuelExpense();state.rows.fleetInvoices=[{id:9,provider:input.provider}];state.rows.fleetExpenses=[storedFuel(input,{invoiceId:9})];
  const rows=await validatedInputs([{...input,provider:'Otro proveedor'}]);assert.match(rows[0].error,/factura vinculada/);assert.equal(state.writes.length,0);
});
test('Una fila inválida no altera el odómetro existente ni inserta otras filas',async()=>{
  const state=reset(),input=fuelExpense();state.rows.fleetExpenses=[storedFuel(input)];
  const rows=await validatedInputs([{...input,odometer:180}]);
  const response=await post({action:'bulkExpense',rows:[rows[0].input,fuelExpense({odometer:-1,source:sourceRecord({format:'FUEL_ATIO',transactionId:'new-id'})})]});
  assert.equal(response.status,400);assert.equal(state.writes.length,0);assert.equal(state.rows.fleetExpenses[0].odometer,150);
});
test('Una transacción repetida dentro del mismo archivo queda observada aunque sus datos sean diferentes',async()=>{
  const state=reset(),input=fuelExpense(),rows=await validatedInputs([input,{...input,odometer:180}]);
  assert.equal(rows[0].operation,'NUEVO');assert.match(rows[1].error,/duplicada/);assert.equal(state.writes.length,0);
});
test('Los peajes repetidos conservan su control de duplicados',async()=>{
  const state=reset(),input=expense();state.rows.fleetExpenses=[storedFuel(input)];
  const rows=await validatedInputs([input]);assert.match(rows[0].error,/ya fue cargado/);assert.equal(state.writes.length,0);
});
