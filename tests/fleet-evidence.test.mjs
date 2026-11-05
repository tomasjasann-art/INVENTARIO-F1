import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const domainUrl=url(compile(await readFile(new URL('../lib/fleet.ts',import.meta.url),'utf8')));
const domain=await import(domainUrl);
const photoUrl=url(compile(await readFile(new URL('../lib/fleet-photo-watermark.ts',import.meta.url),'utf8')).replaceAll('"./fleet"',JSON.stringify(domainUrl)));
const photos=await import(photoUrl);
const pdfUrl=url(compile(await readFile(new URL('../lib/fleet-journey-pdf.ts',import.meta.url),'utf8')).replaceAll('"./fleet"',JSON.stringify(domainUrl)).replaceAll('"./fleet-photo-watermark"',JSON.stringify(photoUrl)));
const {createJourneyPdf}=await import(pdfUrl);

test('Fecha y hora de la marca usan Perú, sin depender de la zona del teléfono',()=>{
 assert.match(domain.fleetTimestamp('2026-11-05T15:30:40.000Z'),/05\/11\/2026.*10:30:40/);
 assert.equal(domain.fleetTimestamp('inválida'),'Sin registro');
 const at=1793887500000,path='supabase://kardex-evidencias/fleet/2/assignment-20/FINAL/'+at+'-00000000-0000-4000-8000-000000000001.jpg';
 assert.equal(domain.photoRegisteredAt(path),new Date(at).toISOString());
 assert.equal(domain.photoRegisteredAt('legacy/00000000-0000-4000-8000-000000000001.jpg'),undefined);
});
test('La marca agrega un pie con logo, placa, fase, posición y hora; no tapa la foto y genera JPEG',async()=>{
 const previous={Image:globalThis.Image,document:globalThis.document,fetch:globalThis.fetch};
 const calls=[],canvas={width:0,height:0,getContext(){return {drawImage(...args){calls.push(['image',...args.slice(1)]);},fillRect(...args){calls.push(['rect',...args]);},fillText(...args){calls.push(['text',...args]);}};},toBlob(callback,type){calls.push(['encoded',this.width,this.height,type]);callback(new Blob(['jpeg'],{type}));}};
 try {
  globalThis.Image=class {naturalWidth=1600;naturalHeight=900;async decode(){}};
  globalThis.document={createElement(){return canvas;}};
  globalThis.fetch=async()=>new Response(new Blob(['logo']));
  const result=await photos.watermarkFleetPhoto(new Blob(['foto'],{type:'image/jpeg'}),{registeredAt:'2026-11-05T15:30:40Z',plate:'PRU001',phase:'FINAL',slot:'Frente'});
  assert.equal(result.type,'image/jpeg');
  assert.deepEqual(calls[0],['image',0,0,1600,900]);
  assert.equal(calls.filter(c=>c[0]==='image').length,2);
  assert.ok(calls.some(c=>c[0]==='encoded'&&c[1]===1600&&c[2]>900&&c[3]==='image/jpeg'));
  const words=calls.filter(c=>c[0]==='text').map(c=>c[1]).join(' ');
  assert.match(words,/PRU001.*FINAL.*Frente/);assert.match(words,/05\/11\/2026.*10:30:40/);
  await assert.rejects(photos.watermarkFleetPhoto(new Blob(),{registeredAt:'',plate:'PRU001',phase:'FINAL',slot:'Frente'}),/fecha de registro/);
 }finally{Object.assign(globalThis,previous);}
});
const exports={};const context={exports,module:{exports},console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,atob,btoa,setTimeout,clearTimeout};
vm.runInNewContext(await readFile(new URL('../public/vendor/jspdf-4.2.1.umd.min.js',import.meta.url),'utf8'),context);
const SDK=exports.jsPDF;
assert.equal(typeof SDK,'function');
const logo=await readFile(new URL('../public/f1-services-logo-horizontal.png',import.meta.url));
const picture={data:'data:image/png;base64,'+logo.toString('base64'),width:292,height:94};
function report(){
 const a={id:20,vehicleId:10,driverId:2,trackingMode:'OPERATIVO',responsibleName:'',serviceDate:'2026-11-05',endDate:'2026-11-05',expectedStart:'08:00',expectedEnd:'18:00',coordinator:'Coordinador de prueba',ceco:'7001',site:'Site de prueba',finalZone:'Cochera',notes:'',planStatus:'CONFIRMADA',reason:'',initialKm:100,finalKm:200,startedAt:'2026-11-05T13:00:00Z',endedAt:'2026-11-05T22:00:00Z',startPhotos:[],endPhotos:[],startNotes:'Revisar frenos',endNotes:'Luz posterior dañada',createdBy:'prueba',updatedAt:'2026-11-05T22:00:00Z'};
 const images=domain.PHOTO_SLOTS.map(slot=>({slot,path:'archivo',url:'https://evidencia.example/'+slot,registeredAt:'2026-11-05T15:30:40Z'}));
 return {assignment:a,vehicle:{plate:'PRU001',brand:'Marca',model:'Modelo'},driverName:'Conductor de prueba',startPhotos:images,endPhotos:images,generatedAt:'2026-11-05T22:01:00Z'};
}
test('El PDF real contiene las 14 evidencias en cinco páginas y conserva zona y observaciones',async()=>{
 const rendered=[],reads=[];
 function Constructor(options){const doc=new SDK(options),text=doc.text.bind(doc);doc.text=(...args)=>{rendered.push(args);return text(...args);};return doc;}
 const doc=await createJourneyPdf(report(),Constructor,async path=>{reads.push(path);return picture;});
 assert.equal(doc.getNumberOfPages(),5);assert.equal(reads.length,15);
 const content=Buffer.from(doc.output('arraybuffer'));assert.ok(content.toString('ascii',0,5)==='%PDF-');assert.ok(content.length>5000);
 const words=rendered.map(c=>c[0]).join(' ');for(const word of ['Cochera','Revisar frenos','Luz posterior dañada','PRU001'])assert.ok(words.includes(word),word);
 assert.ok(rendered.every(c=>c[2]>=0&&c[2]<=290));
});
test('Textos largos continúan en nuevas páginas y una evidencia inaccesible impide emitir un PDF incompleto',async()=>{
 const input=report();input.assignment.startNotes='Observación extensa del vehículo. '.repeat(70);
 const doc=await createJourneyPdf(input,SDK,async()=>picture);assert.ok(doc.getNumberOfPages()>5);
 await assert.rejects(createJourneyPdf(report(),SDK,async path=>{if(path.startsWith('https:'))throw new Error('Sin conexión');return picture;}),/No se pudo descargar/);
});
