import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const domainUrl=url(compile(await readFile(new URL('../lib/fleet.ts',import.meta.url),'utf8')));
const f=await import(url(compile(await readFile(new URL('../lib/fleet-stations.ts',import.meta.url),'utf8')).replace('"./fleet"',JSON.stringify(domainUrl))));
const station=(overrides={})=>({id:1,name:'Estación de prueba',address:'Av. Árbol 123',district:'Distrito Uno',city:'',region:'Región Uno',provider:'Red de prueba',fuels:'',hours:'',restrictions:'',latitude:null,longitude:null,verified:false,active:true,source:null,importKey:null,...overrides});
const filters={search:'',region:'',district:'',fuel:''};
test('Las estaciones del PDF se pueden abrir en el mapa y en rutas sin inventar coordenadas',()=>{
  const s=station(),links=f.stationLinks(s);
  assert.equal(f.stationCoordinates(s),false);assert.equal(new URL(links.directions).searchParams.get('destination'),f.stationAddress(s));
  assert.equal(new URL(links.embed).hostname,'maps.google.com');assert.equal(new URL(links.embed).searchParams.get('q'),f.stationAddress(s));
  assert.ok(!links.directions.includes('null'));assert.equal(new URL(links.search).searchParams.get('api'),'1');
});
test('Una coordenada cargada aún sin verificar sigue usando la dirección',()=>{
  const s=station({latitude:-12.1,longitude:-77.1});assert.equal(f.stationCoordinates(s),false);assert.match(new URL(f.stationLinks(s).directions).searchParams.get('destination'),/Av. Árbol/);
});
test('Solo las coordenadas verificadas se usan para mostrar un pin y obtener rutas precisas',()=>{
  const s=station({latitude:-12.1,longitude:-77.1,verified:true});assert.equal(f.stationCoordinates(s),true);assert.equal(new URL(f.stationLinks(s).embed).hostname,'www.openstreetmap.org');assert.equal(new URL(f.stationLinks(s).directions).searchParams.get('destination'),'-12.1,-77.1');
});
test('Búsqueda sin tildes encuentra nombres, direcciones, departamento y distrito',()=>{
  const rows=[station()];for(const search of ['estacion','ARBOL','region uno','Distrito Uno','red de prueba']) assert.equal(f.filterStations(rows,{...filters,search}).length,1);
  assert.equal(f.filterStations(rows,{...filters,search:'No existe'}).length,0);
});
test('Los filtros de departamento y distrito se combinan sin confundir lugares homónimos',()=>{
  const rows=[station(),station({id:2,region:'Región Dos'}),station({id:3,district:'Distrito Dos'})];assert.deepEqual(f.filterStations(rows,{...filters,region:'region uno',district:'Distrito Uno'}).map(s=>s.id),[1]);
});
test('Los puntos sin GPS no participan en el orden de cercanía',()=>{
  const rows=[station({id:1,name:'A sin coordenadas'}),station({id:2,name:'B verificado',verified:true,latitude:-12,longitude:-77})];
  assert.deepEqual(f.filterStations(rows,filters,{lat:-12,lon:-77}).map(s=>s.id),[2,1]);
});
test('No se afirma disponibilidad de un combustible que el PDF no informa',()=>{
  assert.equal(f.filterStations([station()],{...filters,fuel:'GLP'}).length,0);assert.equal(f.filterStations([station({fuels:'GLP y Diésel'})],{...filters,fuel:'diesel'}).length,1);
});
test('Los selectores unifican variantes de mayúsculas y tildes de un mismo lugar',()=>{
  assert.equal(f.stationPlaces(['Región Uno','REGION UNO','Región Dos','']).length,2);
});
test('Las rutas incluyen la marca de la red y el modo automóvil para evitar negocios homónimos',()=>{
  const links=f.stationLinks(station({provider:'COESTI / PRIMAX'}));const route=new URL(links.directions);assert.match(route.searchParams.get('destination'),/^PRIMAX /);assert.equal(route.searchParams.get('travelmode'),'driving');
});
