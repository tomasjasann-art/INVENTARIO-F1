"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import Image from "next/image";

export default function PasswordChangeScreen({ displayName }: { displayName: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo actualizar la contraseña.");
      window.location.replace("/");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "No se pudo actualizar la contraseña.");
      setSaving(false);
    }
  }

  return <main className="login-page access-denied-page">
    <section className="login-brand-panel">
      <div className="login-brand-lockup"><Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={292} height={94} priority /></div>
      <div className="login-message"><p>PRIMER INGRESO</p><h1>Protege tu<br />cuenta de trabajo.</h1><span>Define una contraseña personal antes de ingresar a Logística F1.</span></div>
      <div className="login-brand-footer"><span>F1 Services © 2026</span><span>Acceso interno protegido</span></div>
    </section>
    <section className="login-access-panel"><div className="login-card password-change-card">
      <div className="login-secure-label"><ShieldCheck size={15} /> CAMBIO OBLIGATORIO</div>
      <h2>Hola, {displayName}</h2>
      <p>La contraseña entregada por el Administrador es temporal. Crea una nueva de al menos 10 caracteres.</p>
      <form className="internal-login-form" onSubmit={submit}>
        <label><span>Nueva contraseña</span><input name="password" type="password" minLength={10} autoComplete="new-password" required /></label>
        <label><span>Confirmar contraseña</span><input name="confirmation" type="password" minLength={10} autoComplete="new-password" required /></label>
        {error && <div className="login-form-error">{error}</div>}
        <button className="login-submit login-submit-button" type="submit" disabled={saving}><KeyRound size={18} />{saving ? "Actualizando..." : "Guardar contraseña"}</button>
      </form>
    </div></section>
  </main>;
}
