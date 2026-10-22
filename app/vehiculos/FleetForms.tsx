/* eslint-disable @next/next/no-img-element -- Evidencias privadas con URL temporal y vistas previas locales. */
"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { PHOTO_SLOTS, type Assignment, type FleetPhoto } from "../../lib/fleet";

export type FieldSpec = { name: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; hint?: string; step?: string; min?: string; operationsOnly?: boolean; administrationOnly?: boolean };
export type FormSpec = { title: string; action: string; fields: FieldSpec[]; values?: Record<string, unknown>; uploadPurpose?: string; vehicleCecos?: Record<string, string>; vehicleUsages?: Record<string, string> };
export type Save = (body: Record<string, unknown>) => Promise<boolean>;

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una fotografía.");
  if (file.size > 25_000_000) throw new Error("La fotografía supera los 25 MB. Reduce su tamaño antes de adjuntarla.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = objectUrl; await img.decode();
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext("2d"); if (!context) throw new Error("No se pudo procesar la foto.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo procesar la fotografía.")), "image/jpeg", .82));
    return blob;
  } catch { throw new Error("No se pudo abrir la imagen. Usa una fotografía JPG, PNG o WEBP."); }
  finally { URL.revokeObjectURL(objectUrl); }
}
export async function uploadFleetFile(file: File, purpose: string, assignmentId?: number) {
  const content = file.type.startsWith("image/") ? await compressPhoto(file) : file;
  if (content.size > 8_000_000) throw new Error("El archivo debe pesar como máximo 8 MB.");
  const res = await fetch("/api/fleet/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, assignmentId, contentType: content.type, size: content.size }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo preparar la carga.");
  const uploaded = await fetch(data.signedUrl, { method: "PUT", headers: { "Content-Type": content.type, "x-upsert": "false" }, body: content });
  if (!uploaded.ok) throw new Error("La carga del archivo falló. Comprueba tu conexión y vuelve a intentar.");
  return data.path as string;
}

export function Modal({ title, children, onClose, busy = false }: { title: string; children: React.ReactNode; onClose: () => void; busy?: boolean }) {
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    modalRef.current?.querySelector<HTMLElement>("button, input, select, textarea, a")?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="fl-modal-backdrop"><section ref={modalRef} onKeyDown={e => {
    if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); }
    if (e.key === "Tab") {
      const nodes = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }} role="dialog" aria-modal="true" aria-label={title} className="fl-modal"><header><div><small>CONTROL DE VEHÍCULOS</small><h2>{title}</h2></div><button type="button" className="fl-icon" disabled={busy} onClick={onClose} aria-label="Cerrar"><X size={21} /></button></header>{children}</section></div>;
}

export function EntityForm({ spec, onSave, onClose }: { spec: FormSpec; onSave: Save; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>(spec.values || {});
  const [attachment, setAttachment] = useState(String(spec.values?.attachment || ""));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const administrative = spec.action === "assignment" && spec.vehicleUsages?.[String(values.vehicleId)] === "ADMINISTRACION";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try { if (await onSave({ ...values, action: spec.action, attachment })) onClose(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title={spec.title} onClose={onClose} busy={busy}><form onSubmit={submit}>{administrative && <p className="fl-muted">Registro administrativo: se agrega sin cuenta de conductor, Inicio, Final ni fotografías. Puedes indicar un responsable de gerencia.</p>}<div className="fl-form-grid">{spec.fields.filter(f => administrative ? !f.operationsOnly : !f.administrationOnly).map(f => <label className={`fl-field ${f.type === "textarea" ? "fl-wide" : ""}`} key={f.name}><span>{f.label}{f.required ? " *" : ""}</span>{f.options ? <select required={f.required} value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: e.target.value, ...(f.name === "vehicleId" && spec.vehicleCecos ? { ceco: spec.vehicleCecos[e.target.value] || "", driverId: "", responsibleName: "" } : {}) })}><option value="">Seleccionar</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "checkbox" ? <input type="checkbox" checked={Boolean(values[f.name])} onChange={e => setValues({ ...values, [f.name]: e.target.checked })} /> : f.type === "textarea" ? <textarea value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: e.target.value })} /> : <input type={f.type || "text"} required={f.required} min={f.min} step={f.step || (f.type === "number" ? "any" : undefined)} maxLength={f.type === "text" || !f.type ? 2000 : undefined} value={String(values[f.name] ?? "")} onChange={e => setValues({ ...values, [f.name]: e.target.value })} />}{f.hint && <small>{f.hint}</small>}</label>)}</div>
    {spec.uploadPurpose && <label className="fl-upload-document"><span>Adjuntar sustento (PDF o imagen){spec.action === "payment" ? " *" : ""}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); setError(""); try { setAttachment(await uploadFleetFile(file, spec.uploadPurpose!)); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }} />{attachment && <small><CheckCircle2 size={14} /> Archivo cargado</small>}</label>}
    {error && <p role="alert" className="fl-error">{error}</p>}<footer><button type="button" className="fl-btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="fl-btn fl-primary" disabled={busy || (spec.action === "payment" && !attachment)}>{busy ? "Procesando…" : "Guardar registro"}</button></footer></form></Modal>;
}

export function JourneyForm({ assignment, plate, phase, coordinators = [], onSave, onClose }: { assignment: Assignment; plate: string; phase: "INICIO" | "FINAL"; coordinators?: string[]; onSave: Save; onClose: () => void }) {
  const coordinatorListId = useId();
  const [photos, setPhotos] = useState<Record<string, { path: string; preview: string }>>({});
  const [uploading, setUploading] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function attach(slot: string, file: File) {
    setUploading(slot); setError("");
    try { const path = await uploadFleetFile(file, phase, assignment.id); const preview = URL.createObjectURL(file); setPhotos(old => { if (old[slot]) URL.revokeObjectURL(old[slot].preview); return { ...old, [slot]: { path, preview } }; }); }
    catch (err) { setError((err as Error).message); } finally { setUploading(""); }
  }
  const close = () => { Object.values(photos).forEach(p => URL.revokeObjectURL(p.preview)); onClose(); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const f = new FormData(event.currentTarget);
    try { const ok = await onSave({ action: "record", assignmentId: assignment.id, phase, coordinator: String(f.get("coordinator") || ""), ceco: String(f.get("ceco") || ""), odometer: Number(f.get("odometer")), notes: String(f.get("notes") || ""), photos: PHOTO_SLOTS.map(slot => ({ slot, path: photos[slot]?.path })) }); if (ok) close(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title={`${phase === "INICIO" ? "Iniciar" : "Finalizar"} jornada · ${plate}`} onClose={close} busy={busy || Boolean(uploading)}><form onSubmit={submit}><p className="fl-muted">{assignment.site || "Servicio asignado"} · {assignment.serviceDate}<br />Adjunta las siete fotografías antes de guardar. El registro queda confirmado al mostrarse el mensaje de éxito.</p><div className="fl-form-grid"><label className="fl-field"><span>Coordinador del trabajo *</span><input name="coordinator" defaultValue={assignment.coordinator} required maxLength={2000} list={coordinatorListId} readOnly={phase === "FINAL" && Boolean(assignment.coordinator)} /><datalist id={coordinatorListId}>{coordinators.map(c => <option key={c} value={c} />)}</datalist></label><label className="fl-field"><span>CECO del trabajo *</span><input name="ceco" defaultValue={assignment.ceco} required maxLength={2000} readOnly={phase === "FINAL" && Boolean(assignment.ceco)} /></label><label className="fl-field"><span>Kilometraje {phase === "INICIO" ? "inicial" : "final"} *</span><input name="odometer" type="number" min={phase === "FINAL" ? assignment.initialKm || 0 : 0} step="0.1" required inputMode="decimal" /></label><label className="fl-field"><span>Observaciones</span><input name="notes" maxLength={2000} placeholder="Estado del vehículo o incidencia" /></label></div><div className="fl-photo-grid">{PHOTO_SLOTS.map((slot, i) => <label className={`fl-photo ${photos[slot] ? "fl-photo-ready" : ""}`} key={slot}>{photos[slot] ? <img src={photos[slot].preview} alt={slot} /> : <Camera size={25} />}<strong>{i + 1}. {slot}</strong><small>{uploading === slot ? <><LoaderCircle size={14} className="fl-spin" /> Subiendo…</> : photos[slot] ? "Cargada · tocar para reemplazar" : "Tomar o seleccionar foto"}</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={Boolean(uploading) || busy} onChange={e => { const f = e.target.files?.[0]; if (f) void attach(slot, f); e.target.value = ""; }} /></label>)}</div>{error && <p role="alert" className="fl-error">{error}</p>}<footer><span className="fl-muted">{Object.keys(photos).length} de 7 fotos</span><button className="fl-btn fl-primary" disabled={busy || Boolean(uploading) || Object.keys(photos).length !== 7}>{busy ? "Guardando…" : `Confirmar ${phase === "INICIO" ? "Inicio" : "Final"}`}</button></footer></form></Modal>;
}

export function Evidence({ photos, label }: { photos: FleetPhoto[]; label: string }) { return <div><h3>{label}</h3><div className="fl-photo-grid">{photos.length ? photos.map(p => <a className="fl-evidence" key={p.slot} href={p.url} target="_blank" rel="noreferrer">{p.url ? <img src={p.url} alt={p.slot} loading="lazy" /> : <span>No disponible</span>}<span>{p.slot}</span></a>) : <p className="fl-muted">Sin registro.</p>}</div></div>; }
