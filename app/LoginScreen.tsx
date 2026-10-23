"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Boxes, Car, KeyRound, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { safeReturnPath } from "../lib/return-path";
import DriverInstallHelp from "./conductores/DriverInstallHelp";
import "./conductores/drivers.css";

export default function LoginScreen({ legacyAccessAvailable, returnTo = "/", driverPortal = false, assetsPortal = false }: { legacyAccessAvailable: boolean; returnTo?: string; driverPortal?: boolean; assetsPortal?: boolean }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
      });
      const body = await response.json() as { error?: string; mustChangePassword?: boolean };
      if (!response.ok) throw new Error(body.error || "No se pudo iniciar sesión.");
      window.location.replace(body.mustChangePassword && !assetsPortal ? "/" : safeReturnPath(returnTo));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-lockup" aria-label="F1 Projects, Engineering and Services">
          <Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority />
        </div>

        <div className="login-message">
          <p>{assetsPortal ? "ACTIVOS F1" : driverPortal ? "F1 CONDUCTORES" : "OPERATIONS HUB"}</p>
          <h1>{assetsPortal ? <>Tus equipos.<br />Tu operación al día.</> : driverPortal ? <>Tu vehículo.<br />Tu jornada al día.</> : <>Datos alineados.<br />Operación en marcha.</>}</h1>
          <span>{assetsPortal ? "Consulta tus equipos, confirma traspasos y reporta fallas con fotos o videos desde tu celular." : driverPortal ? "Registra Inicio y Final, kilometraje y siete fotografías en cada momento desde tu celular." : "Inventario, trazabilidad, conciliación y auditoría logística en un solo lugar."}</span>
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
          <h2>{assetsPortal ? "Ingreso de técnicos" : driverPortal ? "Ingreso de conductores" : "Bienvenido"}</h2>
          <p>Ingresa con el <strong>usuario y contraseña que el Administrador creó</strong> en Logística F1.</p>

          <form className="internal-login-form" onSubmit={login}>
            <label><span>Usuario</span><input name="username" autoComplete="username" required placeholder="nombre.apellido" /></label>
            <label><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••" /></label>
            {error && <div className="login-form-error">{error}</div>}
            <button className="login-submit login-submit-button" type="submit" disabled={submitting}><KeyRound size={18} />{submitting ? "Ingresando..." : driverPortal ? "Ingresar a mi jornada" : "Ingresar a Logística F1"}</button>
          </form>

          {legacyAccessAvailable ? <a className="legacy-login-link" href={`/sign-in/legacy?redirect_url=${encodeURIComponent(safeReturnPath(returnTo))}`} target="_top">Acceso anterior del administrador <ArrowRight size={14} /></a> : null}

          <div className="login-security-note">
            <ShieldCheck size={18} />
            <span>Solo ingresan cuentas activas creadas en <b>Configuración → Usuarios y permisos</b>.</span>
          </div>

          {driverPortal && <DriverInstallHelp />}

          <div className="login-module-list">
            <span>{driverPortal ? <Car size={18} /> : <Boxes size={18} />}</span>
            <span><strong>{driverPortal ? "Mi jornada y mi vehículo" : "Control de Equipos Entel"}</strong><small>{driverPortal ? "Inicio · Final · Kilometraje · 7 fotos por registro" : "Stock · Solicitudes · Conciliación"}</small></span>
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
      <div className="login-message"><p>CONFIGURACIÓN DE PRODUCCIÓN</p><h1>El código ya está<br />listo para Vercel.</h1><span>Falta conectar la base PostgreSQL y el acceso de usuarios del proyecto.</span></div>
      <div className="login-brand-footer"><span>F1 Services © 2026</span><span>Logística F1</span></div>
    </section>
    <section className="login-access-panel"><div className="login-card access-denied-card">
      <div className="login-secure-label denied"><ShieldAlert size={15} /> CONFIGURACIÓN PENDIENTE</div>
      <h2>Faltan variables en Vercel</h2>
      <p>Conecta Supabase PostgreSQL y Supabase Auth al proyecto y agrega estas variables:</p>
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
      <div className="login-message"><p>ACCESO CONTROLADO</p><h1>Tu operación,<br />siempre protegida.</h1><span>Logística F1 está reservada para el equipo autorizado de F1 Services.</span></div>
      <div className="login-brand-footer"><span>F1 Services © 2026</span><span>Logística F1</span></div>
    </section>
    <section className="login-access-panel"><div className="login-card access-denied-card">
      <div className="login-secure-label denied"><ShieldAlert size={15} /> ACCESO NO AUTORIZADO</div>
      <h2>Usuario sin permiso</h2>
      <p>La cuenta <strong>{email}</strong> no está registrada o se encuentra inactiva.</p>
      <div className="login-security-note"><ShieldCheck size={18} /><span>Pide al Administrador que habilite tu usuario en <b>Configuración → Usuarios y permisos</b>.</span></div>
      <a className="login-submit" href={signOutPath} target="_top"><LogOut size={18} />Cerrar sesión y cambiar cuenta</a>
    </div></section>
  </main>;
}
