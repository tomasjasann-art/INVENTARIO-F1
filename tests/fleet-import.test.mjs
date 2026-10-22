import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as XLSX from 'xlsx';
const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const domainUrl = url(compile(await readFile(new URL('../lib/fleet.ts',import.meta.url),'utf8')));
const f = await import(domainUrl);
const parser = await import(url(compile(await readFile(new URL('../lib/fleet-import.ts',import.meta.url),'utf8')).replace('"./fleet"',JSON.stringify(domainUrl))));
const fuelHeaders=['Fecha Controlador','Hora','Sitio','Combustible','Volumen Despachado','Precio unitario Despachado','Monto Despachado','Odometro','Codigo Vehiculo','Numero de Comprobante ERP','Numero de Comprobante','Id Transaccion'];
const fuelRow=['2026/10/22','07:18:45','Estación de prueba','GLP-G',6.337,6.99,44.30,'17811','QA-1001','','TICKET-1','transaction-1'];
const vehicles=[{id:10,plate:'QA1001'}];
const options={kind:'COMBUSTIBLE',provider:'Convenio de prueba',unit:'GAL',file:'reporte.xlsx'};
const parseFuel=(rows=[fuelRow],settings=options)=>parser.parseFleetImport([{name:'Transacciones',rows:[fuelHeaders,...rows]}],vehicles,settings);

test('La lectura real de CSV conserva fecha, hora e identificadores sin inferencia de zona horaria',()=>{
  const row=[...fuelRow];row[0]='2026-10-22';row[1]='00:15:00';row[11]='00000123456789012345';
  const csv=XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([fuelHeaders,row]));
  const taskOriginalTimezone=process.env.TZ;
  try {
    for(const timezone of ['America/Lima','America/Los_Angeles','UTC']) {
      process.env.TZ=timezone;
      const wb=XLSX.read(new TextEncoder().encode(csv),parser.FLEET_WORKBOOK_OPTIONS);
      const inputs=parser.parseFleetImport(wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true})})),vehicles,{...options,file:'combustible.csv'}).inputs;
      assert.equal(inputs[0].date,'2026-10-22');assert.equal(inputs[0].source.time,'00:15:00');assert.equal(inputs[0].source.transactionId,'00000123456789012345');
    }
  } finally {if(taskOriginalTimezone===undefined)delete process.env.TZ;else process.env.TZ=taskOriginalTimezone;}
});

test('El formato original de combustible conserva hora, estación, odómetro y referencia alternativa',()=>{
  const r=parseFuel().inputs[0];assert.equal(r.vehicleId,10);assert.equal(r.date,'2026-10-22');assert.equal(r.odometer,17811);assert.equal(r.amount,44.3);assert.equal(r.quantity,6.337);assert.equal(r.reference,'TICKET-1');assert.equal(r.source.time,'07:18:45');assert.equal(r.source.station,'Estación de prueba');assert.equal(r.source.row,2);assert.equal(r.source.voucher,'');assert.equal(r.provider,'Convenio de prueba');
});
test('Comprobante ERP tiene prioridad y no se sustituye la fecha de consumo por la del comprobante',()=>{
  const row=[...fuelRow];row[9]='FACTURA-ERP';assert.equal(parseFuel([row]).inputs[0].reference,'FACTURA-ERP');
});
test('Se excluye la fila de totales sin descartar movimientos con datos incompletos',()=>{
  const total=Array(12).fill('');total[3]='Total';total[4]='22,414.521';total[6]='300,500.33';
  const incomplete=[...fuelRow];incomplete[8]='';
  const r=parseFuel([fuelRow,incomplete,total]);assert.equal(r.inputs.length,2);assert.equal(r.skippedTotals,1);assert.equal(r.inputs[1].vehicleId,0);
});
test('El archivo completo admite más de 500 movimientos sin dividirlo y limita el tamaño',()=>{
  const rows=Array.from({length:2401},(_,i)=>{const row=[...fuelRow];row[11]=`transaction-${i}`;return row;});
  assert.equal(parseFuel(rows).inputs.length,2401);assert.throws(()=>parseFuel(Array(5001).fill(fuelRow)),/5,000|5000/);
});
test('Peajes detecta la cabecera de la segunda fila, fecha de uso y cada pase del comprobante',()=>{
  const headers=['Placa','Red Uso','Fecha Inicio','Hora Inicio','Plaza','Pista','Importe','Nro Comprobante','Fecha Comprobante'];
  const row=['QA1001','Red de prueba','01/10/2026','08:44:15','Plaza de prueba','152','6.30','FACTURA-1','07/10/2026'];
  const r=parser.parseFleetImport([{name:'Consumo',rows:[[],headers,row,[...row.slice(0,3),'09:44:15',...row.slice(4)]]}],vehicles,{...options,kind:'PEAJE'});
  assert.equal(r.inputs.length,2);assert.equal(r.inputs[0].date,'2026-10-01');assert.equal(r.inputs[0].source.voucherDate,'2026-10-07');assert.equal(r.inputs[0].source.row,3);assert.equal(r.inputs[0].source.lane,'152');assert.equal(r.inputs[0].amount,6.3);
  assert.notDeepEqual(f.expenseIdentity(r.inputs[0]),f.expenseIdentity(r.inputs[1]));
});
test('La identidad del peaje es estable si luego se emite o cambia el comprobante',()=>{
  const a={vehicleId:10,date:'2026-10-22',kind:'PEAJE',provider:'RED',reference:'FACTURA-1',source:{format:'TOLL_REPORT',time:'10:00:00',station:' Plaza de prueba ',lane:'1'}};
  assert.deepEqual(f.expenseIdentity(a),f.expenseIdentity({...a,reference:'FACTURA-2',source:{...a.source,voucher:'FACTURA-2'}}));
});
test('La identidad de combustible usa la transacción y no depende del nombre de archivo, orden o ERP vacío',()=>{
  const a=parseFuel().inputs[0];assert.deepEqual(f.expenseIdentity(a),f.expenseIdentity({...a,reference:'ERP-NUEVO',source:{...a.source,file:'otro.xlsx',row:400}}));
});
test('La unidad del volumen es explícita y los números inválidos no se convierten en cero',()=>{
  assert.equal(parseFuel([fuelRow],{...options,unit:'L'}).inputs[0].unit,'L');
  const row=[...fuelRow];row[4]='no válido';assert.match(parseFuel([row]).inputs[0]._error,/quantity/);
  assert.equal(parser.importNumber('S/ 1,234.56'),1234.56);assert.equal(parser.importNumber('1.234,56'),1234.56);assert.equal(parser.importNumber(''),null);assert.ok(Number.isNaN(parser.importNumber('123abc')));
});
test('Se interpretan fechas y horas numéricas de Excel sin desplazar el día en Perú',()=>{
  assert.equal(parser.importDate(46317),'2026-10-22');assert.equal(parser.importTime(.5),'12:00:00');assert.equal(parser.importTime('8:45'),'08:45:00');
});
test('Una plantilla base sigue funcionando y un tipo de archivo equivocado muestra el error',()=>{
  const r=parser.parseFleetImport([{name:'Carga',rows:[['Fecha','Placa','Importe','Proveedor','Referencia'],['22/10/2026','QA1001',10,'Proveedor','T-1']]}],vehicles,{...options,kind:'PEAJE'});
  assert.equal(r.inputs[0].source,null);assert.equal(r.inputs[0].reference,'T-1');assert.throws(()=>parseFuel([fuelRow],{...options,kind:'PEAJE'}),/Cambia el tipo/);
});
test('La atribución automática requiere una única jornada y respeta fecha y hora',()=>{
  const expense={vehicleId:10,date:'2026-10-22',source:{time:'10:00:00'}};
  const a={id:1,vehicleId:10,planStatus:'CONFIRMADA',trackingMode:'OPERATIVO',serviceDate:'2026-10-22',endDate:'2026-10-22',expectedStart:'08:00',expectedEnd:'18:00',startedAt:'',endedAt:''};
  assert.equal(f.matchingAssignments(expense,[a]).length,1);assert.equal(f.matchingAssignments(expense,[a,{...a,id:2}]).length,2);
  assert.equal(f.matchingAssignments({...expense,source:{time:'20:00:00'}},[a]).length,0);
  assert.equal(f.matchingAssignments(expense,[{...a,planStatus:'NO_SALIO'}]).length,0);
});
test('Odómetro de abastecimiento se compara sin modificar el Inicio o Final',()=>{
  const a={trackingMode:'OPERATIVO',initialKm:100,finalKm:200};const e={kind:'COMBUSTIBLE',odometer:150};
  assert.equal(f.odometerReview(e,a),'Dentro del rango de la jornada');assert.match(f.odometerReview({...e,odometer:250},a),/fuera del rango/);assert.match(f.odometerReview(e,{...a,finalKm:null}),/Final pendiente/);assert.equal(f.odometerReview(e),'Sin jornada vinculada');assert.equal(a.initialKm,100);assert.equal(a.finalKm,200);
});
