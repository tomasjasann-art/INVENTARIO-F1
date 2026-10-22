"use client";
import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, UserPlus } from "lucide-react";
import type { FleetData } from "../../lib/fleet";
import DriverInstallHelp from "../conductores/DriverInstallHelp";
import { Table } from "./FleetUI";
import "../conductores/drivers.css";

export default function DriverAccessPanel({ data, onManageDrivers }: { data: FleetData; onManageDrivers?: () => void }) {
  const [message, setMessage] = useState("");
  const drivers = data.drivers.filter(user => user.role === "CONDUCTOR");
  const admin = data.user.role === "ADMINISTRADOR";
  async function copyLink() {
    try { await navigator.clipboard.writeText(new URL("/conductores", window.location.origin).href); setMessage("Enlace de conductores copiado."); }
    catch { setMessage("Abre F1 Conductores y copia la dirección del navegador."); }
  }
  return <section className="fl-panel">
    <div className="fl-panel-head"><div><h2>Conductores y acceso desde el celular</h2><p>El mismo enlace para toda la flota; cada conductor ingresa con su propia cuenta.</p></div></div>
    <div className="fl-driver-access">
      <div className="fl-driver-link"><a className="fl-btn fl-primary" href="/conductores" target="_blank" rel="noreferrer"><ExternalLink size={17} />Abrir F1 Conductores</a><button className="fl-btn" onClick={() => void copyLink()}><Copy size={16} />Copiar enlace para conductores</button></div>
      {message && <p role="status">{message}</p>}
      <ol className="fl-driver-steps"><li>Crea una cuenta con el rol <strong>Conductor</strong> y entrega el usuario y la contraseña temporal.</li><li>Prepara la <strong>Asignación diaria</strong> con placa, conductor, fecha y horario.</li><li>El conductor abre F1 Conductores y registra <strong>Inicio y Final</strong>, kilometraje y <strong>7 fotos en cada evento</strong>.</li></ol>
      {!drivers.some(user => user.active !== false) && <p className="fl-driver-warning">Todavía no hay conductores activos. Primero crea sus cuentas para poder asignarles vehículos.</p>}
      {admin ? onManageDrivers ? <button className="fl-btn" onClick={onManageDrivers}><UserPlus size={17} />Crear o habilitar conductores</button> : <Link className="fl-btn" href="/?administrar=conductores"><UserPlus size={17} />Crear o habilitar conductores</Link> : <p>Un administrador crea y habilita las cuentas desde Usuarios y permisos.</p>}
      <DriverInstallHelp />
    </div>
    <Table heads={["Conductor", "Usuario para ingresar", "Estado"]} rows={drivers.map(user => [user.displayName, user.username || "Pendiente de usuario interno", user.active === false ? "Inactivo" : "Activo"])} empty="Aún no hay cuentas de conductores registradas." />
  </section>;
}
