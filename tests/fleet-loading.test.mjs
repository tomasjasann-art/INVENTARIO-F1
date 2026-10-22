import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { fetchFleetData } = await import(moduleUrl(compile(await readFile(new URL('../lib/fleet-client.ts', import.meta.url), 'utf8'))));
const empty = { user: { id: 1, displayName: 'Prueba', role: 'LOGISTICA', username: 'prueba' }, ...Object.fromEntries(['vehicles','assignments','expenses','documents','invoices','payments','idle','stations','drivers','coordinators'].map(key => [key, []])) };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('Una flota vacía es una carga correcta, lista para el primer registro', async () => {
  globalThis.fetch = async () => Response.json(empty);
  assert.deepEqual(await fetchFleetData(), empty);
});
test('Una sesión vencida informa el problema en lugar de quedar cargando', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Sesión ausente' }, { status: 401 });
  await assert.rejects(fetchFleetData(), /sesión venció/);
});
test('Los errores JSON y las respuestas HTML del servidor terminan la carga con un mensaje', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Base de datos no disponible' }, { status: 503 });
  await assert.rejects(fetchFleetData(), /Base de datos no disponible/);
  globalThis.fetch = async () => new Response('<html>Error de plataforma</html>', { status: 504 });
  await assert.rejects(fetchFleetData(), /servidor no pudo responder/);
});
test('Una respuesta incompleta no se presenta como una flota vacía', async () => {
  globalThis.fetch = async () => Response.json({ user: empty.user, vehicles: [] });
  await assert.rejects(fetchFleetData(), /respuesta de vehículos está incompleta/);
});
test('Una petición sin respuesta se cancela y permite reintentar', async () => {
  let aborted = false;
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
  await assert.rejects(fetchFleetData({ timeoutMs: 15 }), /conexión tardó demasiado/);
  assert.equal(aborted, true);
  globalThis.fetch = async () => Response.json(empty);
  assert.deepEqual(await fetchFleetData(), empty);
});
test('El límite también cubre una descarga de JSON que nunca termina', async () => {
  globalThis.fetch = async (_, { signal }) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })) });
  await assert.rejects(fetchFleetData({ timeoutMs: 15 }), /conexión tardó demasiado/);
});
test('Al salir del módulo se cancela la petición pendiente', async () => {
  const controller = new AbortController();
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  const pending = fetchFleetData({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, e => e.name === 'AbortError');
});

// Exercise the actual GET handler; replace only identity, storage and database I/O.
// A stalled database must produce JSON 504 before Vercel terminates the function.
const drizzle = await import('drizzle-orm');
let schemaSource = compile(await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8'));
for (const pkg of ['drizzle-orm', 'drizzle-orm/pg-core']) schemaSource = schemaSource.replaceAll(`"${pkg}"`, JSON.stringify(import.meta.resolve(pkg)));
const schemaUrl = moduleUrl(schemaSource);
const domainUrl = moduleUrl(compile(await readFile(new URL('../lib/fleet.ts', import.meta.url), 'utf8')));
const accessUrl = moduleUrl(`export class FleetError extends Error { constructor(message,status=400){super(message);this.status=status;} } export async function fleetAccess(){return globalThis.fleetLoadingIdentity;} export function fleetFailure(e){return Response.json({error:e.message},{status:e.status||500});} export function sameOrigin(){} export function verifyAttachment(){} export function verifyPhotos(){}`);
let routeSource = compile(await readFile(new URL('../app/api/fleet/route.ts', import.meta.url), 'utf8'));
for (const [source,target] of Object.entries({
  'drizzle-orm': import.meta.resolve('drizzle-orm'), 'zod': import.meta.resolve('zod'),
  '../../../db': moduleUrl('export function getDb(){return globalThis.fleetLoadingDb;}'),
  '../../../db/schema': schemaUrl, '../../../lib/fleet-server': accessUrl,
  '../../../lib/fleet': domainUrl, '../../../lib/fleet-sync': moduleUrl(compile(await readFile(new URL('../lib/fleet-sync.ts', import.meta.url), 'utf8'))), '../../../lib/supabase-storage': moduleUrl('export async function resolveEvidenceImage(){throw new Error("No evidence requested");}'),
})) routeSource = routeSource.replaceAll(`"${source}"`, JSON.stringify(target));
const { GET } = await import(moduleUrl(routeSource));
function setDatabase(stalled = false) {
  const queried = [];
  globalThis.fleetLoadingIdentity = { ...empty.user, manager: true };
  globalThis.fleetLoadingDb = { select(){ let table; const q = { from(t){table=drizzle.getTableName(t);return q;},where(){return q;},orderBy(){return q;},then(resolve,reject){queried.push(table);return (stalled ? new Promise(()=>{}) : Promise.resolve([])).then(resolve,reject);} };return q; } };
  return queried;
}
test('El GET real devuelve todas las colecciones con una flota sin vehículos', async () => {
  const queried = setDatabase();
  const response = await GET(new Request('https://f1.example/api/fleet'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), empty);
  assert.ok(queried.includes('coordinators'));
});
test('El GET real termina con 504 JSON cuando la base no responde', async t => {
  setDatabase(true);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = GET(new Request('https://f1.example/api/fleet'));
  t.mock.timers.tick(20000);
  const response = await pending;
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /base de datos tardó demasiado/);
});
test('El GET de conductor no consulta documentación, gastos ni pagos administrativos', async () => {
  const queried = setDatabase();
  globalThis.fleetLoadingIdentity = { ...empty.user, role: 'CONDUCTOR', manager: false };
  const response = await GET(new Request('https://f1.example/api/fleet'));
  assert.equal(response.status, 200);
  assert.deepEqual(queried, ['fleet_assignments','fleet_stations','app_users','coordinators']);
});
