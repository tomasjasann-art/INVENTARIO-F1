"use client";
import { useMemo, useState } from "react";
import { Download, LocateFixed, MapPin, Navigation, Plus, Search, Upload } from "lucide-react";
import { normalizedPlate, stationDistance, type FleetData, type Station } from "../../lib/fleet";
import { Badge, Empty, Table } from "./FleetApp";
import type { Save } from "./FleetForms";

export function StationsPanel({ stations, manager, onEdit, onAdd }: { stations: Station[]; manager: boolean; onEdit: (s: Record<string, unknown>) => void; onAdd: () => void }) {
  const [search, setSearch] = useState(""), [fuel, setFuel] = useState(""), [selectedId, setSelectedId] = useState<number | null>(null), [location, setLocation] = useState<{ lat: number; lon: number } | null>(null), [error, setError] = useState("");
  const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = useMemo(() => stations.filter(s => clean([s.name, s.address, s.city, s.district, s.region, s.provider].join(" ")).includes(clean(search)) && (!fuel || clean(s.fuels).includes(clean(fuel)))).sort((a, b) => location ? stationDistance(a, location.lat, location.lon) - stationDistance(b, location.lat, location.lon) : a.name.localeCompare(b.name)), [stations, search, fuel, location]);
  const selected = filtered.find(s => s.id === selectedId) || filtered.find(s => s.verified && s.latitude !== null && s.longitude !== null);
  const lat = selected?.latitude, lon = selected?.longitude, verified = selected?.verified && lat !== null && lat !== undefined && lon !== null && lon !== undefined;
  function locate() { setError(""); if (!navigator.geolocation) { setError("Tu dispositivo no ofrece ubicación. Puedes buscar por distrito o ciudad."); return; } navigator.geolocation.getCurrentPosition(p => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setError("No se obtuvo la ubicación. Puedes permitirla en el navegador o buscar manualmente."), { timeout: 12000, maximumAge: 60000 }); }
  return <section className="fl-panel"><div className="fl-panel-head"><div><h2>Abastecimiento en convenio</h2><p>Busca un punto autorizado y consulta cómo llegar.</p></div>{manager && <button className="fl-btn fl-primary" onClick={onAdd}><Plus size={16} />Agregar punto</button>}</div><div className="fl-station-tools"><label className="fl-search"><Search size={17} /><input aria-label="Buscar punto de abastecimiento" placeholder="Estación, dirección, distrito o ciudad…" value={search} onChange={e => setSearch(e.target.value)} /></label><input className="fl-input" aria-label="Filtrar combustible" placeholder="Combustible: diésel, GNV…" value={fuel} onChange={e => setFuel(e.target.value)} /><button className="fl-btn" onClick={locate}><LocateFixed size={16} />Cerca de mí</button></div>{error && <p className="fl-error">{error}</p>}
  {!stations.length ? <Empty text={manager ? "Registra los puntos del convenio. El PDF del proveedor está pendiente de incorporar." : "Logística aún no ha registrado los puntos de abastecimiento."} /> : <div className="fl-map-layout"><div className="fl-station-list">{filtered.length ? filtered.map(s => { const dist = location ? stationDistance(s, location.lat, location.lon) : Infinity; return <article className={`fl-station-card ${selected?.id === s.id ? "fl-selected" : ""}`} key={s.id}><button onClick={() => setSelectedId(s.id)}><MapPin size={20} /><div><strong>{s.name}</strong><p>{s.address}</p><small>{[s.district, s.city, s.region].filter(Boolean).join(" · ")}</small></div></button><p>{s.provider} · {s.fuels || "Combustibles por confirmar"}</p>{s.hours && <small>Horario: {s.hours}</small>}{s.restrictions && <small>{s.restrictions}</small>}<div className="fl-row-actions"><Badge>{!s.active ? "INACTIVO" : s.verified ? "Ubicación verificada" : "Ubicación pendiente"}</Badge>{Number.isFinite(dist) && <small>{dist.toFixed(1)} km en línea recta</small>}{manager && <button className="fl-text-btn" onClick={() => onEdit({ ...s })}>Editar</button>}</div></article>; }) : <Empty text="No hay estaciones que coincidan con tu búsqueda." />}</div><div className="fl-map">{verified ? <><iframe title={`Mapa de ${selected!.name}`} loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon! - .035}%2C${lat! - .025}%2C${lon! + .035}%2C${lat! + .025}&layer=mapnik&marker=${lat}%2C${lon}`} /><div className="fl-map-caption"><div><strong>{selected!.name}</strong><small>{selected!.address}</small></div><a className="fl-btn fl-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lon}`}><Navigation size={16} />Cómo llegar</a></div></> : <Empty text="Selecciona una estación con coordenadas verificadas para mostrarla en el mapa." />}</div></div>}</section>;
}

type PreviewRow = { row: number; input: Record<string, unknown>; error?: string; plate?: string; amount?: number; reference?: string };
export function ImportPanel({ data, onSave, manager }: { data: FleetData; onSave: Save; manager: boolean }) {
  const [kind, setKind] = useState("COMBUSTIBLE"), [rows, setRows] = useState<PreviewRow[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [fileName, setFileName] = useState("");
  const valid = rows.filter(r => !r.error);
  async function template() {
    const XLSX = await import("xlsx"), wb = XLSX.utils.book_new();
    const sample = { Fecha: "", Placa: "", Proveedor: "", Referencia: "", Importe: "", ...(kind === "COMBUSTIBLE" ? { Combustible: "", Volumen: "", Unidad: "GAL", PrecioUnitario: "", Odometro: "" } : { Colector: "" }), AsignacionID: "", Observacion: "" };
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([sample]), "Carga"); XLSX.writeFile(wb, `Plantilla_Flota_${kind}.xlsx`);
  }
  async function read(file: File) {
    setBusy(true); setError(""); setRows([]); setFileName(file.name);
    try {
      if (file.size > 8_000_000) throw new Error("El archivo supera los 8 MB.");
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Selecciona Excel o CSV.");
      const XLSX = await import("xlsx"), wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      if (!source.length || source.length > 500) throw new Error("El archivo debe contener entre 1 y 500 filas. Divide los archivos mayores.");
      const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const inputRows = source.map(row => {
        const pairs = Object.entries(row).map(([k, v]) => [norm(k), String(v).trim()]);
        const get = (...keys: string[]) => pairs.find(([k]) => keys.map(norm).includes(k))?.[1] || "";
        const number = (v: string) => {
          const raw = v.replace(/S\/?\.?/gi, "").replace(/\s/g, "");
          const normalized = raw.includes(",") && raw.includes(".") ? raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "") : raw.replace(",", ".");
          return Number(normalized);
        };
        let day = get("Fecha", "Fecha de consumo");
        if (/^\d{5}$/.test(day)) { const d = XLSX.SSF.parse_date_code(Number(day)); day = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`; }
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(day)) { const [d, m, y] = day.split("/"); day = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
        const plate = normalizedPlate(get("Placa", "Placa del Vehiculo", "Vehiculo"));
        return { vehicleId: data.vehicles.find(v => v.plate === plate)?.id || 0, date: day, kind, provider: get("Proveedor"), collector: get("Colector"), reference: get("Referencia", "NroServicio", "Comprobante"), amount: number(get("Importe", "Monto Despachado", "Total")), fuel: get("Combustible"), quantity: number(get("Volumen", "Volumen Despachado")) || 0, unit: (get("Unidad") || "GAL").toUpperCase().replace("M³", "M3"), unitPrice: number(get("PrecioUnitario", "Precio unitario Despachado")) || 0, odometer: get("Odometro") ? number(get("Odometro")) : null, assignmentId: get("AsignacionID") ? number(get("AsignacionID")) : null, invoiceId: null, notes: get("Observacion"), _plate: plate };
      });
      const res = await fetch("/api/fleet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkPreview", rows: inputRows }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || "No se pudo validar el archivo."); setRows(result.rows);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="fl-panel"><div className="fl-panel-head"><div><h2>Carga masiva de combustible y peajes</h2><p>Plantilla base disponible. Adaptaremos las columnas a los formatos de tus proveedores cuando los compartas.</p></div>{manager && <button className="fl-btn" onClick={() => void template()}><Download size={16} />Descargar plantilla</button>}</div>{manager ? <><div className="fl-import-controls"><label className="fl-field"><span>Tipo de carga</span><select value={kind} disabled={busy} onChange={e => { setKind(e.target.value); setRows([]); }}><option value="COMBUSTIBLE">Combustible</option><option value="PEAJE">Peajes</option></select></label><label className="fl-file-picker"><Upload size={22} /><span>{busy ? "Validando archivo…" : "Seleccionar Excel o CSV"}</span><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} /></label></div><p className="fl-muted fl-pad">La validación comprueba placas registradas, fechas, importes y referencias duplicadas. Los gastos sin AsignacionID quedan pendientes de atribuir a un conductor.</p>{error && <p className="fl-error">{error}</p>}{rows.length > 0 && <><div className="fl-import-summary"><strong>{fileName}</strong><Badge>{valid.length} aceptados</Badge><Badge>{rows.length - valid.length} observados / duplicados</Badge><button className="fl-btn fl-primary" disabled={busy || !valid.length} onClick={async () => { setBusy(true); try { if (await onSave({ action: "bulkExpense", rows: valid.map(r => r.input) })) { setRows([]); setFileName(""); } } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>Importar {valid.length} aceptados</button></div><Table heads={["Fila", "Placa", "Referencia", "Importe", "Validación"]} rows={rows.map(r => [r.row, r.plate, r.reference, r.amount, r.error || <Badge>Aceptado</Badge>])} /></>}</> : <Empty text="La carga masiva está reservada para Logística." />}</section>;
}
