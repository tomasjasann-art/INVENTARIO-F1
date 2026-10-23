"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Boxes, Download, FileCheck2, Wrench, X } from "lucide-react";
import { assetAge, type Asset, type AssetFile, type AssetsData } from "../../lib/assets";
export type Field = { name: string; label: string; type?: string; required?: boolean; options?: { value: string | number; label: string }[]; min?: number; max?: number; step?: string; hint?: string };
export type FormSpec = { title: string; action: string; fields: Field[]; values: Record<string, unknown>; attachment?: boolean; photo?: boolean; assignmentId?: number };
export const options = (values: string[]) => values.map(value => ({ value, label: value }));
export const money = (n: number, currency = "PEN") => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(n / 100);
export const dateLabel = (d: string) => d ? d.slice(0, 10).split("-").reverse().join("/") : "—";
export const fileUrl = (id: number, download = false) => `/api/assets?file=${id}${download ? "&download=1" : ""}`;
export async function jsonRequest(url: string, init?: RequestInit) {
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),25000);
 try { const r=await fetch(url,{...init,cache:"no-store",signal:controller.signal}); const d=await r.json().catch(()=>{throw new Error("El servidor no devolvió una respuesta válida. Vuelve a intentarlo.");}); if(!r.ok)throw new Error(d.error||"No se pudo completar la operación."); return d;
 } catch(e) { if(controller.signal.aborted)throw new Error("La conexión tardó demasiado. Actualiza para reintentar."); throw e; } finally {clearTimeout(timer);}
}
export function Tag({ children }: { children: ReactNode }) { const s = String(children); return <span className={`af-tag ${/Vencido|Dañado|Perdido|Abierta|No aprobado/.test(s) ? "af-danger" : /Pendiente|parcial|Por vencer|proceso|Sin programar/.test(s) ? "af-warning" : /Vigente|Completado|Devuelto$|Aceptado/.test(s) ? "af-success" : ""}`}>{children}</span>; }
export function Empty({ children = "No hay registros con estos filtros." }: { children?: ReactNode }) { return <div className="af-empty"><Boxes size={30} /><strong>{children}</strong></div>; }
export function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) { return <section className="af-panel"><header><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</header>{children}</section>; }
export function DataTable({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) { return rows.length ? <div className="af-table-wrap"><table><thead><tr>{heads.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div> : <Empty />; }
export function Attachments({ ids, data }: { ids: number[]; data: AssetsData }) { return <div className="af-files">{ids.map(id => { const f = data.files.find(f => f.id === id); return <div key={id}><a href={fileUrl(id)} target="_blank" rel="noreferrer">{f?.name || `Archivo #${id}`}</a><a href={fileUrl(id, true)} aria-label="Descargar archivo"><Download size={14} /></a></div>; })}</div>; }
/* Unoptimized images keep authenticated file requests in the browser. */
export function AssetPhoto({ asset }: { asset: Asset }) { return asset.photoId ? <Image unoptimized width={145} height={145} className="af-photo" src={fileUrl(asset.photoId)} alt={asset.description} /> : <span className="af-photo af-placeholder"><Wrench size={26} /></span>; }
export function AssetForm({ spec, onClose, onSaved }: { spec: FormSpec; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, unknown>>(spec.values), [attached, setAttached] = useState<AssetFile[]>([]), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null); useEffect(() => { dialog.current?.showModal(); }, []);
  async function upload(list: FileList | null) {
    if (!list) return; setUploading(true); setError("");
    try {
      const selected = Array.from(list); if (spec.photo && selected.length > 1) throw new Error("Selecciona una sola foto."); if (attached.length + selected.length > 12) throw new Error("Máximo 12 archivos.");
      for (const file of selected) {
        if (spec.photo && !file.type.startsWith("image/")) throw new Error("Selecciona una imagen para la ficha.");
        const ticket = await jsonRequest("/api/assets/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size, ...(spec.assignmentId ? { assignmentId: spec.assignmentId } : {}) }) });
        const r = await fetch(ticket.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!r.ok) throw new Error("No se pudo subir el archivo. Intenta nuevamente.");
        setAttached(old => spec.photo ? [ticket.file] : [...old, ticket.file]);
      }
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = { ...values, action: spec.action, ...(spec.photo ? { photoId: attached[0]?.id || values.photoId || null } : {}), ...(spec.attachment ? { files: attached.map(f => f.id) } : {}) };
      await jsonRequest("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); await onSaved(); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="af-dialog" onCancel={e => { if (busy || uploading) e.preventDefault(); else onClose(); }} aria-labelledby="af-form-title"><form onSubmit={submit}>
    <header><div><small>ACTIVOS F1</small><h2 id="af-form-title">{spec.title}</h2></div><button type="button" className="af-icon" disabled={busy || uploading} onClick={onClose} aria-label="Cerrar"><X /></button></header>
    <div className="af-form-grid">{spec.fields.map(f => <label key={f.name} className={f.type === "textarea" ? "af-wide" : ""}><span>{f.label}{f.required ? " *" : ""}</span>{f.type === "checkbox" ? <input type="checkbox" checked={Boolean(values[f.name])} onChange={e => setValues({ ...values, [f.name]: e.target.checked })} /> : f.options ? <select required={f.required} value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: typeof f.options?.find(o => String(o.value) === e.target.value)?.value === "number" ? Number(e.target.value) : e.target.value })}><option value="">Seleccionar</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "textarea" ? <textarea rows={3} required={f.required} value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: e.target.value })} /> : <input type={f.type || "text"} required={f.required} min={f.min} max={f.max} step={f.step} value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })} />}{f.hint && <small>{f.hint}</small>}</label>)}</div>
    {(spec.attachment || spec.photo) && <div className="af-upload"><label><FileCheck2 size={20} /><span>{uploading ? "Cargando archivos…" : spec.photo ? "Foto del equipo · JPG, PNG o WEBP" : "Adjuntar documentos, fotos o videos · hasta 30 MB por archivo"}</span><input type="file" multiple={!spec.photo} accept={spec.photo ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"} disabled={busy || uploading} onChange={e => void upload(e.target.files)} /></label>{attached.map(f => <div key={f.id}>{f.name}<button type="button" onClick={() => setAttached(attached.filter(a => a.id !== f.id))} aria-label={`Quitar ${f.name}`}><X size={14} /></button></div>)}</div>}
    {error && <p className="af-error" role="alert">{error}</p>}<footer><button type="button" disabled={busy || uploading} onClick={onClose}>Cancelar</button><button className="af-primary" disabled={busy || uploading}>{busy ? "Guardando…" : "Guardar"}</button></footer></form></dialog>;
}
export function Detail({ asset, data, onClose }: { asset: Asset; data: AssetsData; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); useEffect(() => { dialog.current?.showModal(); }, []);
  const person = (id: number) => data.people.find(p => p.id === id)?.displayName || `Usuario #${id}`;
  return <dialog className="af-dialog af-detail" ref={dialog} onCancel={onClose}><header><div><small>{asset.code} · {asset.category}</small><h2>{asset.description}</h2></div><button className="af-icon" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="af-detail-body"><div className="af-detail-top"><AssetPhoto asset={asset} /><div><h3>{asset.brand} {asset.model}</h3><p>Serie: {asset.serial || "Control por cantidad"}</p><p>Compra: {dateLabel(asset.purchaseDate)} · {assetAge(asset.purchaseDate)}</p><p>Costo unitario: {money(asset.costCents, asset.currency)} · {asset.supplier}</p><p>{asset.available} disponibles · {asset.quarantined} en cuarentena · {asset.total - asset.available - asset.quarantined} asignados</p><p>Ubicación: {asset.location || "Sin registrar"}</p></div></div><p>{asset.notes}</p><h3>Responsables actuales</h3>{data.assignments.filter(a => a.assetId === asset.id && !a.cancelled && !a.draft && a.returned < a.quantity).map(a => <p key={a.id}>{person(a.userId)} · {a.quantity - a.returned} unidad(es) · {a.project} · {a.city}</p>)}<h3>Documentos y certificados</h3><Attachments ids={[...new Set(data.events.filter(e => e.assetId === asset.id).flatMap(e => e.files))]} data={data} /><h3>Historial del activo</h3><div className="af-timeline">{data.events.filter(e => e.assetId === asset.id).map(e => <article key={e.id}><span /><div><strong>{e.kind}</strong><small>{new Date(e.at).toLocaleString("es-PE", { timeZone: "America/Lima" })} · {e.actor}</small><details><summary>Ver registro</summary><pre>{JSON.stringify(e.data, null, 2)}</pre></details><Attachments ids={e.files} data={data} /></div></article>)}</div></div></dialog>;
}
