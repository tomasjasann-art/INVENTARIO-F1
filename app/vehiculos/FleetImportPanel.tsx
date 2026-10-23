"use client";
import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { type FleetData, type ImportChange } from "../../lib/fleet";
import { FLEET_WORKBOOK_OPTIONS, parseFleetImport } from "../../lib/fleet-import";
import { Badge, Empty, Table, money } from "./FleetUI";
import FleetHistoryImport from "./FleetHistoryImport";
import type { Save } from "./FleetForms";

type PreviewRow = { row: number; input: Record<string, unknown>; error?: string; warning?: string; plate?: string; amount?: number; reference?: string; assignmentId?: number | null; operation?: "NUEVO" | "ACTUALIZAR" | "SIN_CAMBIOS"; changes?: ImportChange[] };
function ExpenseImportPanel({ data, onSave, manager }: { data: FleetData; onSave: Save; manager: boolean }) {
  const [kind, setKind] = useState("COMBUSTIBLE"), [provider, setProvider] = useState(""), [unit, setUnit] = useState("GAL");
  const [rows, setRows] = useState<PreviewRow[]>([]), [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [info, setInfo] = useState("");
  const [page, setPage] = useState(0);
  const valid = rows.filter(r => !r.error), pageSize = 100;
  const newRows = valid.filter(r => r.operation === "NUEVO"), updates = valid.filter(r => r.operation === "ACTUALIZAR"), unchanged = valid.filter(r => r.operation === "SIN_CAMBIOS");
  const writable = newRows.length + updates.length;
  const newTotal = newRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const adjustment = updates.reduce((sum, r) => sum + (r.changes || []).filter(c => c.field === "amountCents").reduce((sum, c) => sum + Number(c.after) - Number(c.before), 0), 0);
  const showChange = (field: string, value: string | number | null) => value === null ? "—" : field === "amountCents" ? money(Number(value)) : field === "vehicleId" ? data.vehicles.find(v => v.id === Number(value))?.plate || String(value) : String(value);
  const unknown = [...new Set(rows.filter(r => Number(r.input.vehicleId) === 0).map(r => r.plate || "Sin placa"))].sort();
  function invalidate() { setRows([]); setInfo(""); setError(""); setPage(0); }
  async function template() {
    const XLSX = await import("xlsx"), wb = XLSX.utils.book_new();
    const sample = { Fecha: "", Placa: "", Proveedor: "", Referencia: "", Importe: "", ...(kind === "COMBUSTIBLE" ? { Combustible: "", Volumen: "", Unidad: "GAL", PrecioUnitario: "", Odometro: "" } : { Colector: "" }), AsignacionID: "", Observacion: "" };
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([sample]), "Carga"); XLSX.writeFile(wb, `Plantilla_Flota_${kind}.xlsx`);
  }
  async function read(selected: File) {
    setBusy(true); invalidate(); setFile(selected);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (selected.size > 8_000_000) throw new Error("El archivo supera los 8 MB.");
      if (!/\.(xlsx|xls|csv)$/i.test(selected.name)) throw new Error("Selecciona Excel o CSV.");
      const XLSX = await import("xlsx"), wb = XLSX.read(await selected.arrayBuffer(), FLEET_WORKBOOK_OPTIONS);
      const parsed = parseFleetImport(wb.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, range: 0, defval: "", raw: true }) })), data.vehicles, { kind, provider, unit, file: selected.name, date1904: Boolean(wb.Workbook?.WBProps?.date1904) });
      if (parsed.format === "FUEL_ATIO" && !provider.trim()) throw new Error("Indica el proveedor del convenio y pulsa Validar archivo. El reporte contiene estaciones, pero no identifica al proveedor de facturación.");
      timer = setTimeout(() => controller.abort(), 60000);
      const res = await fetch("/api/fleet", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkPreview", rows: parsed.inputs }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || "No se pudo validar el archivo.");
      if (!Array.isArray(result.rows) || result.rows.length !== parsed.inputs.length) throw new Error("La validación devolvió una respuesta incompleta. Vuelve a validar.");
      setRows(result.rows);
      setInfo(`${parsed.format === "FUEL_ATIO" ? "Reporte de combustible" : parsed.format === "TOLL_REPORT" ? "Reporte de peajes" : "Plantilla base"} · Hoja ${parsed.sheet} · ${parsed.inputs.length.toLocaleString("es-PE")} movimientos${parsed.skippedTotals ? ` · ${parsed.skippedTotals} fila de totales omitida` : ""}`);
    } catch (e) { setError(controller.signal.aborted ? "La validación tardó demasiado. Vuelve a validar; no se han importado movimientos." : (e as Error).message); } finally { clearTimeout(timer); setBusy(false); }
  }
  return <section className="fl-panel"><div className="fl-panel-head"><div><h2>Carga masiva de combustible y peajes</h2><p>Sube los reportes originales del proveedor. No necesitas cambiar columnas ni mantenerlas pintadas de amarillo.</p></div>{manager && <button className="fl-btn" disabled={busy} onClick={() => void template()}><Download size={16} />Plantilla alternativa</button>}</div>{manager ? <>
    <div className="fl-import-controls"><label className="fl-field"><span>Tipo de carga</span><select value={kind} disabled={busy} onChange={e => { setKind(e.target.value); invalidate(); }}><option value="COMBUSTIBLE">Combustible</option><option value="PEAJE">Peajes</option></select></label>
    {kind === "COMBUSTIBLE" && <><label className="fl-field"><span>Proveedor del convenio</span><input value={provider} disabled={busy} maxLength={200} placeholder="Nombre del proveedor de facturación" onChange={e => { setProvider(e.target.value); invalidate(); }} /><small>Para el reporte original de combustible. La estación se conserva por separado.</small></label><label className="fl-field"><span>Unidad del volumen del reporte</span><select value={unit} disabled={busy} onChange={e => { setUnit(e.target.value); invalidate(); }}><option value="GAL">Galones (GAL)</option><option value="L">Litros (L)</option></select><small>El reporte no indica unidad. Confirma la utilizada; GNV se registra en m³.</small></label></>}
    <label className="fl-file-picker"><Upload size={22} /><span>{busy ? "Validando archivo…" : "Seleccionar Excel o CSV"}</span><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} /></label>{file && <button className="fl-btn" disabled={busy} onClick={() => void read(file)}>Validar archivo</button>}</div>
    <p className="fl-muted fl-pad">Hasta 5,000 movimientos por archivo. La vista previa no guarda datos. Se verifica cada pase de peaje aunque comparta comprobante con otros. La vinculación a una jornada se propone por placa, fecha y hora; si no es única queda pendiente.</p>
    <p className="fl-muted fl-pad">El reporte original de combustible usa Id Transaccion: los nuevos se agregan, los corregidos se actualizan y los idénticos quedan sin cambios. La vista previa muestra el valor anterior y el nuevo. Las jornadas, facturas y sustentos vinculados se conservan.</p>
    <p className="fl-muted fl-pad">El odómetro del abastecimiento se guarda tal como viene del proveedor. Los kilómetros de Inicio y Final del conductor se conservan y se comparan al vincular la jornada.</p>
    {error && <p role="alert" className="fl-error">{error}</p>}{info && <p className="fl-muted fl-pad" role="status">{info}</p>}
    {unknown.length > 0 && <p className="fl-driver-warning">Placas pendientes en Datos del vehículo ({unknown.length}): {unknown.join(", ")}. Sus movimientos quedan observados; no se crean vehículos automáticamente.</p>}
    {rows.length > 0 && <><div className="fl-import-summary"><strong>{file?.name}</strong><Badge>{newRows.length} nuevos</Badge><Badge>{updates.length} por actualizar</Badge><Badge>{unchanged.length} sin cambios</Badge><Badge>{rows.length - valid.length} observados / duplicados</Badge><span>Importe de nuevos: {money(Math.round(newTotal * 100))} · Ajuste de importes: {money(adjustment)}</span><button className="fl-btn fl-primary" disabled={busy || !writable} onClick={async () => { setBusy(true); setError(""); try { if (await onSave({ action: "bulkExpense", rows: valid.map(r => r.input) })) { setRows([]); setInfo("Archivo procesado correctamente. El resultado de la carga se muestra en el aviso de confirmación."); } } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>Aplicar {writable} cambios</button></div>
    <Table heads={["Fila", "Placa / fecha / hora", "Estación / plaza", "Comprobante", "Combustible / volumen", "Precio unitario", "Importe", "Odómetro", "Jornada", "Acción / cambios"]} rows={rows.slice(page * pageSize, (page + 1) * pageSize).map(r => { const source = r.input.source as { time?: string; station?: string; voucherDate?: string } | null; return [r.row, <><strong>{r.plate}</strong><small>{String(r.input.date)} {source?.time}</small></>, source?.station || String(r.input.collector || "—"), <>{r.reference}<small>{source?.voucherDate}</small></>, kind === "COMBUSTIBLE" ? <>{String(r.input.fuel)}<small>{String(r.input.quantity)} {String(r.input.unit)}</small></> : "—", kind === "COMBUSTIBLE" ? String(r.input.unitPrice) : "—", Number.isFinite(Number(r.amount)) ? money(Math.round(Number(r.amount) * 100)) : "—", r.input.odometer == null ? "—" : String(r.input.odometer), r.assignmentId ? `#${r.assignmentId}` : "Pendiente", r.error || <><Badge>{r.operation === "ACTUALIZAR" ? "Actualizar" : r.operation === "SIN_CAMBIOS" ? "Sin cambios" : "Nuevo"}</Badge>{r.changes?.map(c => <small key={c.field}>{c.label}: {showChange(c.field, c.before)} → {showChange(c.field, c.after)}</small>)}{r.warning && <small>{r.warning}</small>}</>]; })} />
    {rows.length > pageSize && <div className="fl-import-summary"><button className="fl-btn" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Anterior</button><span>Filas {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} de {rows.length}</span><button className="fl-btn" disabled={(page + 1) * pageSize >= rows.length || busy} onClick={() => setPage(page + 1)}>Siguiente</button></div>}</>}
  </> : <Empty text="La carga masiva está reservada para Logística." />}</section>;
}

export function ImportPanel(props: { data: FleetData; onSave: Save; manager: boolean }) {
  const [historical, setHistorical] = useState(false);
  return <><div className="fl-head-actions fl-import-mode"><button className={`fl-btn ${!historical ? "fl-primary" : ""}`} aria-pressed={!historical} onClick={() => setHistorical(false)}>Combustible y peajes</button><button className={`fl-btn ${historical ? "fl-primary" : ""}`} aria-pressed={historical} onClick={() => setHistorical(true)}>Seguimiento histórico</button></div>{historical ? <FleetHistoryImport {...props} /> : <ExpenseImportPanel {...props} />}</>;
}
