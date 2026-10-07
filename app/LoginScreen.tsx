import { ArrowRight, Boxes, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import Image from "next/image";

export default function LoginScreen({ signInPath }: { signInPath: string }) {
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-lockup" aria-label="F1 Projects, Engineering and Services">
          <Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority />
        </div>

        <div className="login-message">
          <p>OPERATIONS HUB</p>
          <h1>Datos alineados.<br />Operación en marcha.</h1>
          <span>Inventario, trazabilidad, conciliación y auditoría logística en un solo lugar.</span>
        </div>

        <div className="login-brand-footer">
          <span>F1 Services © 2026</span>
          <span>Operación logística · Acceso protegido</span>
        </div>
      </section>

      <section className="login-access-panel">
        <div className="login-card">
          <Image className="login-client-logo" src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority />
          <div className="login-secure-label"><ShieldCheck size={15} /> ACCESO PRIVADO</div>
          <h2>Bienvenido</h2>
          <p>Ingresa con el <strong>Google o Gmail que el Administrador registró</strong> en el Kardex.</p>

          <div className="login-access-steps">
            <strong>¿Cómo ingresar?</strong>
            <ol>
              <li><b>1</b><span>Presiona el botón y selecciona tu cuenta de Google.</span></li>
              <li><b>2</b><span>Elige exactamente el Gmail autorizado por F1.</span></li>
            </ol>
          </div>

          <a className="login-submit" href={signInPath} target="_top">
            Ingresar con Google o Gmail <ArrowRight size={18} />
          </a>

          <div className="login-security-note">
            <ShieldCheck size={18} />
            <span>Solo ingresan correos registrados previamente en <b>Configuración → Usuarios y permisos</b>.</span>
          </div>

          <div className="login-module-list">
            <Boxes size={18} />
            <span><strong>Kardex F1 Logística</strong><small>Stock · Ingresos · Salidas · Conciliación · Auditoría</small></span>
          </div>
        </div>
      </section>
    </main>
  );
}

export function DeploymentSetupScreen({ missing }: { missing: string[] }) {
  return <main className="login-page access-denied-page">
    <section className="login-brand-panel">
      <div className="login-brand-lockup" aria-label="F1 Projects, Engineering and Services">
        <Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority />
      </div>
      <div className="login-message"><p>CONFIGURACIÓN DE PRODUCCIÓN</p><h1>El código ya está<br />listo para Vercel.</h1><span>Falta conectar la base de datos y el acceso Gmail del proyecto.</span></div>
      <div className="login-brand-footer"><span>F1 Services © 2026</span><span>Kardex F1 Logística</span></div>
    </section>
    <section className="login-access-panel"><div className="login-card access-denied-card">
      <div className="login-secure-label denied"><ShieldAlert size={15} /> CONFIGURACIÓN PENDIENTE</div>
      <h2>Faltan variables en Vercel</h2>
      <p>Conecta Neon y Clerk al proyecto y agrega estas variables:</p>
      <div className="login-security-note"><ShieldCheck size={18} /><span><b>{missing.join(", ")}</b></span></div>
      <p>Después vuelve a desplegar la rama <strong>main</strong>.</p>
    </div></section>
  </main>;
}

export function AccessDeniedScreen({ email, signOutPath }: { email: string; signOutPath: string }) {
  return <main className="login-page access-denied-page">
    <section className="login-brand-panel">
      <div className="login-brand-lockup" aria-label="F1 Projects, Engineering and Services">
        <Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority />
      </div>
      <div className="login-message"><p>ACCESO CONTROLADO</p><h1>Tu operación,<br />siempre protegida.</h1><span>El Kardex F1 está reservado para el equipo autorizado de F1 Services.</span></div>
      <div className="login-brand-footer"><span>F1 Services © 2026</span><span>Kardex F1 Logística</span></div>
    </section>
    <section className="login-access-panel"><div className="login-card access-denied-card">
      <div className="login-secure-label denied"><ShieldAlert size={15} /> ACCESO NO AUTORIZADO</div>
      <h2>Gmail sin permiso</h2>
      <p>La cuenta <strong>{email}</strong> no está registrada o se encuentra inactiva.</p>
      <div className="login-security-note"><ShieldCheck size={18} /><span>Pide al Administrador que registre este correo exacto en <b>Configuración → Usuarios y permisos</b>.</span></div>
      <a className="login-submit" href={signOutPath} target="_top"><LogOut size={18} />Cerrar sesión y cambiar cuenta</a>
    </div></section>
  </main>;
}
