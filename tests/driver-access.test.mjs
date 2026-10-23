import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const returnUrl = moduleUrl(compile(await readFile(new URL('../lib/return-path.ts', import.meta.url), 'utf8')));
const { safeReturnPath } = await import(returnUrl);

test('Se conserva el portal al volver del inicio de sesión', () => {
  assert.equal(safeReturnPath('/conductores'), '/conductores');
  assert.equal(safeReturnPath('/vehiculos?dia=2026-10-21#registro'), '/vehiculos?dia=2026-10-21#registro');
});
test('El retorno rechaza dominios externos, entradas repetidas y bucles de autenticación', () => {
  for (const value of ['https://otro.example', '//otro.example', '/\\otro.example', 'javascript:alert(1)', '/sign-in?redirect_url=/sign-in', '/sign-out', '/api/fleet', ['/conductores'], null]) assert.equal(safeReturnPath(value), '/');
});
const configUrl = moduleUrl('export function isClerkConfigured(){return globalThis.driverAccessState.clerk;} export function missingDeploymentConfig(){return globalThis.driverAccessState.missing;}');
const loginUrl = moduleUrl('export default function LoginScreen(){} export function AccessDeniedScreen(){} export function DeploymentSetupScreen(){}');
const navUrl = moduleUrl('export function redirect(path){throw Object.assign(new Error("Redirect"),{destination:path});}');
const authUrl = moduleUrl('export async function getAuthenticatedUser(){return globalThis.driverAccessState.user;} export async function getKardexAccess(){return globalThis.driverAccessState.access;} export function signInPath(path="/"){return "/sign-in?redirect_url="+encodeURIComponent(path);} export function signOutPath(){return "/sign-out";}');
const jsxUrl = import.meta.resolve('react/jsx-runtime');
const fleetUrl = moduleUrl('export default function FleetApp(){}');
const passwordUrl = moduleUrl('export default function PasswordChangeScreen(){}');
const installUrl = moduleUrl('export default function DriverInstallHelp(){}');
async function loadPage(path, replacements) {
  let source = compile(await readFile(new URL(path, import.meta.url), 'utf8'));
  for (const [key,value] of Object.entries({ 'react/jsx-runtime':jsxUrl, 'next/navigation':navUrl, ...replacements })) source = source.replaceAll(`"${key}"`, JSON.stringify(value));
  return (await import(moduleUrl(source))).default;
}
const SignInPage = await loadPage('../app/sign-in/[[...sign-in]]/page.tsx', {
  '@clerk/nextjs':moduleUrl('export function SignIn(){}'), '../../LoginScreen':loginUrl, '../../deployment-config':configUrl, '../../../lib/return-path':returnUrl,
});
const LegacyPage = await loadPage('../app/sign-in/legacy/[[...legacy]]/page.tsx', { '@clerk/nextjs':moduleUrl('export function SignIn(){}'), '../../../deployment-config':configUrl, '../../../../lib/return-path':returnUrl });
const DriversPage = await loadPage('../app/conductores/page.tsx', { '../LoginScreen':loginUrl, '../PasswordChangeScreen':passwordUrl, '../auth':authUrl, '../deployment-config':configUrl, '../vehiculos/FleetApp':fleetUrl, './DriverInstallHelp':installUrl });
const Home = await loadPage('../app/page.tsx', { './KardexApp':moduleUrl('export default function KardexApp(){}'), './LoginScreen':loginUrl, './PasswordChangeScreen':passwordUrl, './auth':authUrl, './deployment-config':configUrl });
const FleetPage = await loadPage('../app/vehiculos/page.tsx', { '../auth':authUrl, './FleetApp':fleetUrl });
function reset() { globalThis.driverAccessState = { clerk:false, missing:[], user:null, access:null }; }
function signedIn(role='CONDUCTOR') { reset();Object.assign(globalThis.driverAccessState, { user:{email:'persona@example.test',userId:'qa',authProvider:'supabase',displayName:'Prueba'}, access:{id:1,active:true,role,displayName:'Prueba'} }); }
function descendants(element) { return [element,...[element?.props?.children].flat(Infinity).filter(child=>child&&typeof child==='object').flatMap(descendants)]; }
test.beforeEach(reset);

test('El acceso interno funciona sin Clerk y no muestra una configuración vacía', async () => {
  const page = await SignInPage({ searchParams:Promise.resolve({redirect_url:'/conductores'}) });
  assert.equal(page.type.name, 'LoginScreen');assert.equal(page.props.returnTo, '/conductores');assert.equal(page.props.driverPortal, true);
});
test('Con Clerk configurado se conserva el acceso por usuario; el anterior exige selección explícita', async () => {
  globalThis.driverAccessState.clerk=true;
  const internal=await SignInPage({searchParams:Promise.resolve({redirect_url:'/conductores'})});
  assert.equal(internal.type.name,'LoginScreen');
  await assert.rejects(SignInPage({searchParams:Promise.resolve({legacy:'1',redirect_url:'/conductores'})}),error=>error.destination==='/sign-in/legacy?redirect_url=%2Fconductores');
});
test('El enlace público abre directamente el formulario de ingreso de conductores', async () => {
  const page=await DriversPage();assert.equal(page.type.name,'LoginScreen');assert.equal(page.props.returnTo,'/conductores');assert.equal(page.props.driverPortal,true);
});
test('El conductor autenticado accede al formulario de jornadas', async () => {
  signedIn();const page=await DriversPage();const fleet=descendants(page).find(node=>node.type?.name==='FleetApp');assert.equal(fleet?.props.driverPortal,true);
});
test('Se conservan el bloqueo de inactivos y el cambio obligatorio de contraseña', async () => {
  signedIn();globalThis.driverAccessState.access.active=false;
  assert.equal((await DriversPage()).type.name,'AccessDeniedScreen');
  signedIn();globalThis.driverAccessState.access.mustChangePassword=true;
  assert.equal((await DriversPage()).type.name,'PasswordChangeScreen');
});
test('El coordinador no obtiene acceso al portal de conductores', async () => {
  signedIn('COORDINADOR');await assert.rejects(DriversPage(),error=>error.destination==='/');
});
test('Inicio general y enlace anterior conducen a la nueva app del conductor', async () => {
  signedIn();await assert.rejects(Home({searchParams:Promise.resolve({})}),error=>error.destination==='/conductores');
  await assert.rejects(FleetPage(),error=>error.destination==='/conductores');
});
test('La administración de conductores abre la configuración solo para un administrador', async () => {
  for(const role of ['ADMINISTRADOR','LOGISTICA']) {
    signedIn(role);const page=await Home({searchParams:Promise.resolve({administrar:'conductores'})});
    assert.equal(page.props.driverSetup,role==='ADMINISTRADOR');
  }
});

test('El acceso anterior mantiene una ruta estable para sus pasos de verificación',async()=>{
  globalThis.driverAccessState.clerk=true;
  const page=await LegacyPage({searchParams:Promise.resolve({redirect_url:'/conductores'})});
  assert.equal(page.props.children.type.name,'SignIn');
  assert.equal(page.props.children.props.path,'/sign-in/legacy');
  assert.equal(page.props.children.props.fallbackRedirectUrl,'/conductores');
});
const TechniciansPage = await loadPage('../app/activos/tecnicos/page.tsx', { '../../LoginScreen':loginUrl, '../../PasswordChangeScreen':passwordUrl, '../../auth':authUrl, '../../deployment-config':configUrl, '../AssetsApp':moduleUrl('export default function AssetsApp(){}') });
test('Técnicos: ingreso y contraseña permanecen en el portal de Activos F1', async () => {
 reset();let page=await TechniciansPage();assert.equal(page.props.assetsPortal,true);assert.equal(page.props.returnTo,'/activos/tecnicos');
 signedIn('TECNICO');globalThis.driverAccessState.access.mustChangePassword=true;page=await TechniciansPage();assert.equal(page.props.returnTo,'/activos/tecnicos');
 globalThis.driverAccessState.access.mustChangePassword=false;page=await TechniciansPage();assert.equal(page.props.mobilePortal,true);
 await assert.rejects(Home({searchParams:Promise.resolve({})}),e=>e.destination==='/activos/tecnicos');
});
test('Técnicos: cuentas inactivas no acceden al módulo',async()=>{signedIn('TECNICO');globalThis.driverAccessState.access.active=false;const page=await TechniciansPage();assert.equal(page.props.signOutPath,'/sign-out');});
