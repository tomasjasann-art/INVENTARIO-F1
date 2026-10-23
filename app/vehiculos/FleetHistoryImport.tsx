"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { limaDate, type FleetData } from "../../lib/fleet";
import { FLEET_WORKBOOK_OPTIONS } from "../../lib/fleet-import";
import { parseFleetHistory } from "../../lib/fleet-history";
import { Badge, Empty, Table } from "./FleetUI";
import type { Save } from "./FleetForms";

type Row = { row: number; plate: string; input: Record<string, unknown>; operation?: string; error?: string; warning?: string };
export default function FleetHistoryImport({ data, onSave, manager }: { data: FleetData; onSave: Save; manager: boolean }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(() => new Date(Date.parse(`${limaDate().slice(0, 7)}-01T12:00:00Z`) - 86400000).toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null), [rows, setRows] = useState<Row[]>([]), [excluded, setExcluded] = useState(0), [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fresh = rows.filter(r => !r.error && r.operation === "NUEVO"), errors = rows.filter(r => r.error);
  function reset() { setRows([]); setError(""); setPage(0); setExcluded(0); }
  async function validate(selected: File) {
    reset(); setFile(selected); setBusy(true);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
    try {
      if (selected.size > 8_000_000 || !/\.(xlsx|xls|csv)$/i.test(selected.name)) throw new Error("Selecciona un Excel o CSV de hasta 8 MB.");
      if (!to) throw new Error("Selecciona la fecha final del histórico.");
      const XLSX = await import("xlsx"), book = XLSX.read(await selected.arrayBuffer(), FLEET_WORKBOOK_OPTIONS);
      const parsed = parseFleetHistory(book.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: "", raw: true }) })), data.vehicles, { file: selected.name, from: from || "1900-01-01", to, date1904: Boolean(book.Workbook?.WBProps?.date1904) });
      const response = await fetch("/api/fleet", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "historyPreview", rows: parsed.inputs }) });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.rows) || result.rows.length !== parsed.inputs.length) throw new Error(result.error || "No se pudo validar todo el archivo.");
      setRows(result.rows); setExcluded(parsed.excluded);
    } catch (err) { setError(err instanceof Error && err.name === "AbortError" ? "La validación tardó demasiado. Vuelve a intentar." : (err as Error).message); }
    finally { clearTimeout(timer); setBusy(false); }
  }
  return <section className="fl-panel"><div className="fl-panel-head"><div><h2>Seguimiento histórico</h2><p>Importa el control anterior con Fecha, Placa, Kilometraje Inicial, Kilometraje Final y Conductores. Conserva cada viaje, sin crear cuentas ni exigir fotografías. Las horas de envío del formulario quedan como referencia del archivo.</p></div></div>{manager ? <>
    <div className="fl-import-controls"><label className="fl-field"><span>Desde (opcional)</span><input type="date" value={from} disabled={busy} onChange={e => { setFrom(e.target.value); reset(); }} /></label><label className="fl-field"><span>Hasta</span><input type="date" value={to} disabled={busy} onChange={e => { setTo(e.target.value); reset(); }} /></label><label className="fl-file-picker"><Upload size={18} />{file?.name || "Seleccionar control anterior"}<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void validate(f); e.target.value = ""; }} /></label>{file && <button className="fl-btn" disabled={busy} onClick={() => void validate(file)}>Validar histórico</button>}</div>
    {error && <p role="alert" className="fl-error">{error}</p>}{busy && <p className="fl-pad" role="status">Procesando histórico…</p>}
    {rows.length > 0 && <><div className="fl-import-summary"><strong>{fresh.length} nuevos</strong><span>{rows.filter(r => r.operation === "SIN_CAMBIOS").length} ya registrados</span><span>{rows.filter(r => r.operation === "REPETIDO").length} repetidos</span><span>{errors.length} observados</span><span>{excluded} fuera del periodo</span><button className="fl-btn fl-primary" disabled={busy || !fresh.length || errors.length > 0} onClick={async () => { setBusy(true); setError(""); try { if (await onSave({ action: "historyImport", rows: rows.map(r => r.input) })) setRows([]); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>Importar {fresh.length} registros históricos</button></div>
    <Table heads={["Fila", "Placa / fecha", "Conductor", "Km inicial / final", "Km recorridos", "Coordinador / CECO", "SITE", "Resultado"]} rows={rows.slice(page * 100, (page + 1) * 100).map(r => [r.row, <><strong>{r.plate}</strong><small>{String(r.input.serviceDate)}</small></>, String(r.input.responsibleName || "—"), `${r.input.initialKm ?? "—"} / ${r.input.finalKm ?? "—"}`, r.input.initialKm != null && r.input.finalKm != null ? Number(r.input.finalKm) - Number(r.input.initialKm) : "—", <>{String(r.input.coordinator || "—")}<small>{String(r.input.ceco || "—")}</small></>, String(r.input.site || "—"), r.error || <><Badge>{r.operation === "REPETIDO" ? "Repetido: se omite" : r.operation === "SIN_CAMBIOS" ? "Ya registrado" : "Nuevo"}</Badge>{r.warning && <small>{r.warning}</small>}</>])} />
    {rows.length > 100 && <div className="fl-import-summary"><button className="fl-btn" disabled={!page || busy} onClick={() => setPage(page - 1)}>Anterior</button><span>{page * 100 + 1}–{Math.min((page + 1) * 100, rows.length)} de {rows.length}</span><button className="fl-btn" disabled={(page + 1) * 100 >= rows.length || busy} onClick={() => setPage(page + 1)}>Siguiente</button></div>}</>}
  </> : <Empty text="La carga histórica está reservada para Administración y Logística." />}</section>;
}
