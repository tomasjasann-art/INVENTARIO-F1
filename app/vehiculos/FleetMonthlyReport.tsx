"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Car, CheckCircle2, Clock3, Coins, Fuel, Printer, Target } from "lucide-react";
import { limaDate, timeFromMinutes, type FleetData } from "../../lib/fleet";
import { monthlyReport, monthLabel, monthOffset } from "../../lib/fleet-monthly";
import type { DistanceSource } from "../../lib/fleet-report";
import { money } from "./FleetUI";
import "./fleet-monthly.css";

const number = (value: number | null, digits = 1) => value === null ? "—" : new Intl.NumberFormat("es-PE", { maximumFractionDigits: digits }).format(value);
const costKm = (value: number | null) => value === null ? "—" : `S/ ${number(value / 100, 3)}`;
type Report = ReturnType<typeof monthlyReport>;

function MonthlyChart({ report, target }: { report: Report; target: number }) {
  const max = Math.max(target, ...report.months.map(m => m.totals.efficiency || 0)) * 1.25;
  const y = (value: number) => 164 - value / max * 133;
  const points = report.months.map((m, i) => ({ x: 87 + i * 125, y: m.totals.efficiency === null ? null : y(m.totals.efficiency), m }));
  return <>
    <div className="fm-chart-key"><span><i />Km por galón estimado</span><span><b />Meta: {number(target)} km/gal</span></div>
    <svg className="fm-chart" viewBox="0 0 540 205" role="img" aria-label="Rendimiento estimado de los últimos cuatro meses y meta global">
      <defs><linearGradient id="fm-orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff8a27" /><stop offset="100%" stopColor="#f46216" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => { const value = max * i / 4; return <g key={i}><line x1="38" x2="526" y1={y(value)} y2={y(value)} stroke="#e6ebf2" /><text x="30" y={y(value) + 4} textAnchor="end" fontSize="10" fill="#67758d">{number(value, 0)}</text></g>; })}
      <line x1="38" x2="526" y1={y(target)} y2={y(target)} stroke="#182e65" strokeDasharray="6 4" strokeWidth="1.5" />
      {points.map((p, i) => <g key={p.m.month}><title>{`${monthLabel(p.m.month)}: ${number(p.m.totals.efficiency, 2)} km/gal${p.m.partial ? "; mes en curso" : ""}`}</title>{p.y !== null ? <><rect x={p.x - 34} y={p.y} width="68" height={164 - p.y} rx="3" fill="url(#fm-orange)" /><text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="13" fill="#102446" fontWeight="700">{number(p.m.totals.efficiency, 2)}</text></> : <text x={p.x} y="143" textAnchor="middle" fontSize="10" fill="#8190a6">Sin base</text>}{i > 0 && p.y !== null && points[i - 1].y !== null && <line x1={points[i - 1].x} y1={points[i - 1].y!} x2={p.x} y2={p.y} stroke="#102446" strokeWidth="2" />}{p.y !== null && <circle cx={p.x} cy={p.y} r="4" fill="#102446" />}<text x={p.x} y="184" textAnchor="middle" fontSize="10" fill="#102446" fontWeight="700">{monthLabel(p.m.month).toUpperCase()}</text>{p.m.partial && <text x={p.x} y="198" textAnchor="middle" fontSize="9" fill="#a56018">Mes en curso</text>}</g>)}
    </svg>
    <div className="fm-month-values">{report.months.map(m => <div key={m.month}><b>{money(m.totals.cost)}</b><span>{number(m.totals.km)} km</span><small>{m.totals.missing ? `${m.totals.missing} sin base de km` : m.rows.length ? "Base disponible" : "Sin registros"}</small></div>)}</div>
    <p className="fm-insight"><ArrowUpRight size={18} />{report.changes.efficiency !== null ? `El rendimiento estimado ${report.changes.efficiency >= 0 ? "aumentó" : "disminuyó"} ${number(Math.abs(report.changes.efficiency), 1)}% frente al mes anterior, con las mismas unidades comparables.` : "La variación mensual se calcula con meses cerrados y las mismas unidades comparables. Revisa la cobertura de cada periodo."}</p>
  </>;
}

export default function FleetMonthlyReport({ data }: { data: FleetData }) {
  const [month, setMonth] = useState(() => limaDate().slice(0, 7)), [source, setSource] = useState<DistanceSource>("COMBUSTIBLE");
  const [usage, setUsage] = useState(""), [tenure, setTenure] = useState(""), [vehicleId, setVehicleId] = useState(""), [targetInput, setTargetInput] = useState("30");
  const [comments, setComments] = useState<Record<string, string>>({});
  const target = Number(targetInput);
  const vehicles = useMemo(() => data.vehicles.filter(v => (!usage || v.usage === usage) && (!tenure || v.tenure === tenure) && (!vehicleId || v.id === Number(vehicleId))), [data.vehicles, usage, tenure, vehicleId]);
  const report = useMemo(() => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number.isFinite(target) && target > 0 && target <= 1000 ? monthlyReport(data, vehicles, month, source, target) : null, [data, vehicles, month, source, target]);
  const commentKey = JSON.stringify([month, source, usage, tenure, vehicleId, targetInput]);
  const comment = comments[commentKey] || "";
  const scope = [usage ? usage === "OPERACIONES" ? "Operaciones" : "Administración" : "Todos los usos", tenure ? tenure === "ALQUILADO" ? "Alquilados" : "Propios" : "Todas las tenencias", vehicleId ? vehicles[0]?.plate || "Sin vehículo" : "Todas las placas"].join(" · ");
  return <div className="fm-workspace">
    <div className="fm-controls">
      <label>Mes del informe<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
      <label>Uso del vehículo<select value={usage} onChange={e => setUsage(e.target.value)}><option value="">Todos</option><option value="OPERACIONES">Operaciones</option><option value="ADMINISTRACION">Administración</option></select></label>
      <label>Tenencia del vehículo<select value={tenure} onChange={e => setTenure(e.target.value)}><option value="">Todas</option><option value="PROPIO">Propios</option><option value="ALQUILADO">Alquilados</option></select></label>
      <label>Placa del informe<select value={vehicleId} onChange={e => setVehicleId(e.target.value)}><option value="">Todas</option>{data.vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></label>
      <label>Base del recorrido<select value={source} onChange={e => setSource(e.target.value as DistanceSource)}><option value="COMBUSTIBLE">Odómetro de combustible</option><option value="JORNADAS">Jornadas de conductores</option></select></label>
      <label>Meta global (km/gal)<input type="number" min="0.1" max="1000" step="0.1" value={targetInput} onChange={e => setTargetInput(e.target.value)} /></label>
      <button className="fl-btn fl-primary" disabled={!report} onClick={() => window.print()}><Printer size={16} />Imprimir / guardar PDF</button>
    </div>
    {!report ? <p role="alert" className="fl-error fm-validation">Selecciona un mes válido y una meta mayor a 0 y hasta 1000 km/gal.</p> : <>
      <div className="fm-report">
        <header className="fm-header"><Image src="/f1-services-logo-horizontal.png" alt="F1 Projects, Engineering & Services" width={210} height={68} unoptimized /><div><p>REPORTE EJECUTIVO MENSUAL</p><h2>KPI de eficiencia de flota</h2><strong>{monthLabel(month)}</strong></div><div className="fm-edition"><Car size={30} /><span>{report.partial ? `Avance al ${report.end}` : `Periodo ${month}`}</span><small>{report.rows.length} unidades con actividad · {report.fuelCount} abastecimientos</small></div></header>
        <div className="fm-scope">{scope}<span>Base: {source === "COMBUSTIBLE" ? "odómetro de combustible" : "jornadas cerradas"}</span></div>
        <div className="fm-kpis">{[
          { label: "Kilómetros recorridos", value: number(report.totals.km), sub: "Con base de km válida", icon: Car },
          { label: "Costo operativo registrado", value: money(report.totals.cost), sub: "Combustible + peajes + mantenimiento", icon: Coins },
          { label: "Rendimiento estimado", value: number(report.totals.efficiency, 2), sub: "km/gal abastecido · sin GNV", icon: Fuel },
          { label: "Costo por km estimado", value: costKm(report.totals.costPerKm), sub: "Gasto de unidades con km válidos / km", icon: ArrowUpRight },
          { label: "Cumplimiento de rendimiento", value: report.compliance === null ? "—" : `${number(report.compliance, 1)}%`, sub: `Meta global: ${number(target)} km/gal`, icon: Target },
        ].map(k => <article key={k.label} className={k.label === "Cumplimiento de rendimiento" && report.compliance !== null ? report.compliance >= 100 ? "fm-goal-good" : "fm-goal-low" : ""}><k.icon size={24} /><span>{k.label}</span><strong>{k.value}</strong><small>{k.sub}</small></article>)}</div>
        {report.totals.missing > 0 && <p className="fm-coverage"><AlertTriangle size={14} />Cálculo parcial: {report.totals.missing} unidad(es) sin base válida de km. Costo usado en costo/km: {money(report.totals.comparableCost)}. Gasto pendiente de incluir: {money(report.totals.excludedCost)}.</p>}
        <div className="fm-grid">
          <section className="fm-panel"><h3>Desempeño por vehículo · {monthLabel(month)}</h3><div className="fm-table-wrap"><table className="fm-table"><thead><tr>{["Vehículo", "Km", "Km/gal", "Costo operativo", "Costo/km", "Evaluación"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{report.rows.length ? report.rows.map(r => <tr key={r.v.id}><td><b>{r.v.plate}</b><small>{r.v.usage === "ADMINISTRACION" ? "Administración" : "Operaciones"}</small></td><td>{number(r.km)}</td><td>{number(r.efficiency, 2)}</td><td>{money(r.cost)}</td><td>{costKm(r.costPerKm)}</td><td><span className={`fm-status ${r.efficiency === null ? "fm-muted" : r.efficiency >= (r.v.target || target) ? "fm-good" : "fm-review"}`}>{r.km === null && source === "COMBUSTIBLE" && r.odometers.issues.length ? "Revisar odómetros" : r.efficiency === null ? r.mixed ? "GNV: sin km/gal" : "Sin evaluación" : r.efficiency >= (r.v.target || target) ? "Cumple meta" : "Bajo la meta"}</span><small>Meta: {number(r.v.target || target)} km/gal</small></td></tr>) : <tr><td colSpan={6}>Sin registros para el mes y los filtros seleccionados.</td></tr>}</tbody><tfoot><tr><td>Total / ponderado</td><td>{number(report.totals.km)}</td><td>{number(report.totals.efficiency, 2)}</td><td>{money(report.totals.cost)}</td><td>{costKm(report.totals.costPerKm)}</td><td>{report.totals.missing ? "Base parcial" : "Datos registrados"}</td></tr></tfoot></table></div><p className="fm-data-line">{report.costs.map((c, i) => <span key={c.kind}>{i > 0 && " · "}{c.kind === "COMBUSTIBLE" ? "Combustible" : c.kind === "PEAJE" ? "Peajes" : "Mantenimiento"}: {c.count ? money(c.amount) : "sin registros"}</span>)}</p></section>
          <section className="fm-panel"><h3>Rendimiento mes a mes · últimos 4 meses</h3><MonthlyChart report={report} target={target} /></section>
        </div>
        <div className="fm-grid fm-bottom-grid">
          <section className="fm-panel"><h3>Análisis ejecutivo</h3><div className="fm-analysis"><div><h4><CheckCircle2 size={17} />Fortalezas</h4>{report.strengths.length ? <ul>{report.strengths.map(s => <li key={s}>{s}</li>)}</ul> : <p>Sin conclusiones favorables verificables con la base disponible.</p>}</div><div><h4><AlertTriangle size={17} />Puntos por revisar</h4>{report.risks.length ? <ul>{report.risks.map(s => <li key={s}>{s}</li>)}</ul> : <p>Sin incidencias detectadas en los controles disponibles.</p>}</div><div className="fm-focus"><h4><Target size={17} />Foco principal</h4>{report.focus ? <><b>{report.focus.v.plate}</b><strong>{number(report.focus.efficiency, 2)} km/gal</strong><span>{costKm(report.focus.costPerKm)} por km</span><p>Menor cumplimiento de su meta entre las unidades evaluables.</p></> : <p>{report.invalid.length ? "Validar odómetros observados antes del cierre del informe." : "Completar la cobertura y mantener el seguimiento de la flota."}</p>}</div></div></section>
          <section className="fm-panel"><h3>Acciones sugeridas para {monthLabel(monthOffset(month, 1))}</h3><ol className="fm-recommendations">{report.recommendations.map(r => <li key={r}>{r}</li>)}</ol><div className="fm-idle"><Clock3 size={16} />Ralentí registrado del mes: <b>{report.idleMinutes === null ? "sin datos" : `${timeFromMinutes(report.idleMinutes)} h:min`}</b></div></section>
        </div>
        {comment && <section className="fm-comment"><b>Comentario de Logística</b><p>{comment}</p></section>}
        <footer className="fm-footer"><p><b>Objetivo · {monthLabel(monthOffset(month, 1))}</b> Mejorar el rendimiento hacia la meta global de {number(target)} km/gal, controlar costos y completar los registros de la flota.</p><p><b>Lectura del informe</b> Verde: cumple su meta por vehículo. Naranja: bajo la meta. Gris: sin evaluación. El cumplimiento global es rendimiento ÷ meta global × 100.</p><small>Datos registrados en F1 · Combustible: último odómetro menos primero dentro de cada mes; las lecturas que retroceden quedan pendientes. Jornadas: cierres atribuidos por fecha de servicio. Las bases pueden cubrir distintos horarios. Costo/km y km/gal son estimaciones sobre el volumen abastecido, con la cobertura indicada; no representan consumo medido. GNV se excluye de km/gal. Las variaciones se muestran solo con meses cerrados y las mismas unidades comparables.</small></footer>
      </div>
      <label className="fm-editor">Comentario de Logística para esta impresión (opcional)<textarea maxLength={2000} rows={3} value={comment} onChange={e => setComments(previous => ({ ...previous, [commentKey]: e.target.value }))} placeholder="Agrega una observación para gerencia. Se incluye en el PDF de esta sesión." /></label>
    </>}
  </div>;
}
