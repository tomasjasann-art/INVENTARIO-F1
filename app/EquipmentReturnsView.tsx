"use client";

import { AlertTriangle, Camera, CheckCircle2, Clock3, Image as ImageIcon, LoaderCircle, PackageCheck, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { normalizeEquipmentIdentifier, recognizeEquipmentReturn } from "../lib/equipment-return-recognition";

export type EquipmentReturnRecord = {
  id: number;
  returnCode: string;
  productId: number;
  coordinatorId: number | null;
  sourceMovementId: number | null;
  stockMovementId: number | null;
  coordinatorF1: string;
  orderNumber: string;
  serial: string;
  detectedPartNumber: string;
  skuSnapshot: string;
  descriptionSnapshot: string;
  matchMethod: string;
  matchConfidence: number;
  evidenceImage: string;
  evidenceImageStored?: string;
  status: "PENDIENTE_APROBACION" | "OBSERVADA" | "APROBADA_PENDIENTE_RECEPCION" | "RECIBIDA_FISICA" | "RECHAZADA";
  logicalRegisteredAt: string;
  approvedAt: string;
  approvedBy: string;
  physicallyReceivedAt: string;
  receivedBy: string;
  createdBy: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductIdentifier = {
  id: number;
  productId: number;
  identifier: string;
  normalizedIdentifier: string;
  active: boolean;
};

type ReturnProduct = {
  id: number;
  sku: string;
  description: string;
  category: string;
};

type ReturnCoordinator = {
  id: number;
  organization: "F1" | "ENTEL";
  name: string;
  active: boolean;
};

type ReturnMovement = {
  id: number;
  productId: number;
  type: string;
  serials: string;
  orderNumber: string;
  coordinatorF1: string;
};

type Props = {
  products: ReturnProduct[];
  productIdentifiers: ProductIdentifier[];
  movements: ReturnMovement[];
  coordinators: ReturnCoordinator[];
  returns: EquipmentReturnRecord[];
  loading: boolean;
  saving: boolean;
  onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
};

function statusLabel(status: EquipmentReturnRecord["status"]) {
  if (status === "PENDIENTE_APROBACION") return "Pendiente de aprobación";
  if (status === "APROBADA_PENDIENTE_RECEPCION") return "Aprobada · pendiente física";
  if (status === "RECIBIDA_FISICA") return "Recibida físicamente";
  if (status === "OBSERVADA") return "Observada";
  return "Rechazada";
}

function elapsedLabel(record: EquipmentReturnRecord) {
  const start = new Date(record.logicalRegisteredAt || record.createdAt).getTime();
  const end = record.physicallyReceivedAt ? new Date(record.physicallyReceivedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const totalHours = Math.max(0, Math.floor((end - start) / 3_600_000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days ? `${days} d ${hours} h` : `${Math.max(1, totalHours)} h`;
}

function displayDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(date);
}

async function preparePhoto(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una imagen JPG, PNG o WEBP.");
  if (file.size > 10_000_000) throw new Error("La imagen supera 10 MB.");
  const bitmap = await createImageBitmap(file);
  const ocrScale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = Math.max(1, Math.round(bitmap.width * ocrScale));
  ocrCanvas.height = Math.max(1, Math.round(bitmap.height * ocrScale));
  ocrCanvas.getContext("2d")?.drawImage(bitmap, 0, 0, ocrCanvas.width, ocrCanvas.height);

  const storageScale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const storageCanvas = document.createElement("canvas");
  storageCanvas.width = Math.max(1, Math.round(bitmap.width * storageScale));
  storageCanvas.height = Math.max(1, Math.round(bitmap.height * storageScale));
  storageCanvas.getContext("2d")?.drawImage(bitmap, 0, 0, storageCanvas.width, storageCanvas.height);
  bitmap.close();
  const evidence = storageCanvas.toDataURL("image/jpeg", 0.8);
  if (evidence.length > 2_500_000) throw new Error("La imagen sigue siendo muy pesada. Toma otra más cerca de la etiqueta.");
  return { ocrCanvas, evidence };
}

export default function EquipmentReturnsView({ products, productIdentifiers, movements, coordinators, returns, loading, saving, onSave }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [evidenceImage, setEvidenceImage] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [serial, setSerial] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [productId, setProductId] = useState("");
  const [coordinatorF1, setCoordinatorF1] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [sourceMovementId, setSourceMovementId] = useState<number | null>(null);
  const [matchMethod, setMatchMethod] = useState("MANUAL");
  const [matchConfidence, setMatchConfidence] = useState(0);
  const [rememberIdentifier, setRememberIdentifier] = useState(true);

  const selectedProduct = products.find((product) => product.id === Number(productId));
  const f1Coordinators = coordinators.filter((coordinator) => coordinator.active && coordinator.organization === "F1");
  const metrics = useMemo(() => {
    const active = returns.filter((record) => !["RECIBIDA_FISICA", "RECHAZADA"].includes(record.status));
    const received = returns.filter((record) => record.status === "RECIBIDA_FISICA" && record.physicallyReceivedAt);
    const averageHours = received.length
      ? Math.round(received.reduce((sum, record) => sum + Math.max(0, new Date(record.physicallyReceivedAt).getTime() - new Date(record.logicalRegisteredAt).getTime()), 0) / received.length / 3_600_000)
      : 0;
    return {
      approval: active.filter((record) => ["PENDIENTE_APROBACION", "OBSERVADA"].includes(record.status)).length,
      physical: active.filter((record) => record.status === "APROBADA_PENDIENTE_RECEPCION").length,
      received: received.length,
      average: averageHours >= 24 ? `${Math.round(averageHours / 24)} días` : `${averageHours} h`,
    };
  }, [returns]);

  function resetDraft() {
    setEvidenceImage("");
    setRawOcrText("");
    setSerial("");
    setPartNumber("");
    setProductId("");
    setCoordinatorF1("");
    setOrderNumber("");
    setSourceMovementId(null);
    setMatchMethod("MANUAL");
    setMatchConfidence(0);
    setWarnings([]);
    setProgress(0);
  }

  async function readLabel(file?: File) {
    if (!file || processing) return;
    setProcessing(true);
    setError("");
    setWarnings([]);
    setProgress(3);
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    try {
      const prepared = await preparePhoto(file);
      setEvidenceImage(prepared.evidence);
      const { createWorker, PSM } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") setProgress(Math.max(10, Math.round(message.progress * 100)));
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
      const result = await worker.recognize(prepared.ocrCanvas);
      const text = result.data.text || "";
      const recognized = recognizeEquipmentReturn({ text, products, identifiers: productIdentifiers, movements });
      setRawOcrText(text);
      setSerial(recognized.serial);
      setPartNumber(recognized.partNumber);
      setProductId(recognized.productId ? String(recognized.productId) : "");
      setOrderNumber(recognized.orderNumber);
      setCoordinatorF1(recognized.coordinatorF1);
      setSourceMovementId(recognized.sourceMovementId);
      setMatchMethod(recognized.matchMethod);
      setMatchConfidence(recognized.matchConfidence);
      setWarnings(recognized.warnings);
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo reconocer la etiqueta.");
    } finally {
      await worker?.terminate();
      setProcessing(false);
    }
  }

  function selectProduct(value: string) {
    setProductId(value);
    if (!sourceMovementId) {
      setMatchMethod("MANUAL");
      setMatchConfidence(value ? 100 : 0);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!evidenceImage) return setError("Adjunta la foto de la etiqueta del equipo.");
    if (normalizeEquipmentIdentifier(serial).length < 5) return setError("Revisa e ingresa una serie válida.");
    if (!selectedProduct) return setError("Selecciona el SKU relacionado.");
    if (!coordinatorF1) return setError("Selecciona el Coordinador F1 responsable.");
    const form = new FormData(event.currentTarget);
    const ok = await onSave({
      action: "equipmentReturnCreate",
      productId: selectedProduct.id,
      coordinatorF1,
      orderNumber,
      serial,
      partNumber,
      sourceMovementId,
      matchMethod,
      matchConfidence,
      rawOcrText,
      evidenceImage,
      rememberIdentifier: rememberIdentifier && Boolean(partNumber.trim()),
      notes: String(form.get("notes") ?? ""),
    }, "Carga lógica registrada. El equipo todavía no ingresó al stock.");
    if (ok) resetDraft();
  }

  async function changeStatus(record: EquipmentReturnRecord, status: EquipmentReturnRecord["status"]) {
    let notes = record.notes;
    if (status === "OBSERVADA") {
      const observation = window.prompt("Escribe la observación que debe corregirse:", record.notes);
      if (observation === null) return;
      notes = observation.trim();
      if (!notes) return setError("La observación es obligatoria.");
    }
    if (status === "RECIBIDA_FISICA" && !window.confirm(`¿Confirmas que la serie ${record.serial} llegó físicamente a MO Company? Recién ahora se sumará al stock.`)) return;
    await onSave({ action: "equipmentReturnStatus", returnId: record.id, status, notes }, status === "RECIBIDA_FISICA" ? "Recepción física confirmada y stock actualizado." : "Estado de devolución actualizado.");
  }

  return <>
    <section className="return-metrics" aria-label="Indicadores de devoluciones">
      <article><span className="metric-icon amber"><ShieldCheck size={20} /></span><div><small>PENDIENTES DE APROBACIÓN</small><strong>{metrics.approval}</strong></div></article>
      <article><span className="metric-icon blue"><Clock3 size={20} /></span><div><small>APROBADAS SIN LLEGAR</small><strong>{metrics.physical}</strong></div></article>
      <article><span className="metric-icon green"><PackageCheck size={20} /></span><div><small>RECIBIDAS FÍSICAMENTE</small><strong>{metrics.received}</strong></div></article>
      <article><span className="metric-icon purple"><Clock3 size={20} /></span><div><small>TIEMPO PROMEDIO</small><strong>{metrics.average}</strong></div></article>
    </section>

    <section className="return-workspace">
      <article className="panel return-capture-card">
        <div className="panel-title"><div><h2>Carga lógica desde una imagen</h2><p>La lectura identifica serie y part number. Nada se suma al stock en esta etapa.</p></div><span className="logical-badge">NO AFECTA STOCK</span></div>
        <form onSubmit={submit}>
          <label className={`return-photo-drop ${evidenceImage ? "has-photo" : ""}`}>
            {evidenceImage ? <Image src={evidenceImage} alt="Etiqueta del equipo para reconocimiento" width={1200} height={800} unoptimized /> : <span><Camera size={28} /><strong>Subir foto de la etiqueta</strong><small>JPG, PNG o WEBP · máximo 10 MB</small></span>}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void readLabel(event.target.files?.[0])} />
            {processing && <span className="ocr-overlay"><LoaderCircle className="spin" size={23} />Leyendo serie y part number… {progress}%</span>}
          </label>

          <div className="return-form-grid">
            <label className="field"><span>Serie detectada *</span><input value={serial} onChange={(event) => setSerial(event.target.value.toUpperCase())} placeholder="Corrige la serie si el OCR falla" required /></label>
            <label className="field"><span>Part number detectado</span><input value={partNumber} onChange={(event) => setPartNumber(event.target.value.toUpperCase())} placeholder="Puede estar al inicio o dentro de la serie" /></label>
            <label className="field field-wide"><span>SKU y descripción *</span><select value={productId} onChange={(event) => selectProduct(event.target.value)} required><option value="">Selecciona el equipo</option>{products.map((product) => <option value={product.id} key={product.id}>{product.sku} — {product.description}</option>)}</select><small>{selectedProduct ? `${selectedProduct.description} · coincidencia ${matchConfidence}% (${matchMethod.replaceAll("_", " ").toLowerCase()})` : "Si no hay coincidencia única, debes seleccionar el SKU manualmente."}</small></label>
            <label className="field"><span>Coordinador F1 *</span><select value={coordinatorF1} onChange={(event) => setCoordinatorF1(event.target.value)} required><option value="">Selecciona</option>{f1Coordinators.map((coordinator) => <option value={coordinator.name} key={coordinator.id}>{coordinator.name}</option>)}</select></label>
            <label className="field"><span>N.º de pedido relacionado</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Se completa si la serie ya tuvo salida" /></label>
            <label className="field field-wide remember-part"><input type="checkbox" checked={rememberIdentifier} onChange={(event) => setRememberIdentifier(event.target.checked)} disabled={!partNumber.trim()} /><span><strong>Recordar esta relación Part Number → SKU</strong><small>La siguiente foto podrá reconocer el equipo aunque el part number aparezca en otra posición de la serie.</small></span></label>
            <label className="field field-wide"><span>Observación</span><textarea name="notes" rows={2} placeholder="Estado del equipo, motivo de devolución u otra referencia" /></label>
          </div>
          {warnings.map((warning) => <div className="inline-warning" key={warning}><AlertTriangle size={15} />{warning}</div>)}
          {error && <div className="inline-error">{error}</div>}
          <div className="return-submit-row"><span><ScanLine size={16} />Revisa la lectura antes de registrar.</span><button className="primary-button" type="submit" disabled={saving || processing}>{saving ? "Guardando…" : "Registrar carga lógica"}</button></div>
        </form>
      </article>

      <article className="panel return-flow-card">
        <div className="panel-title"><div><h2>Regla de ingreso al stock</h2><p>Separación entre aprobación documental y existencia física.</p></div></div>
        <ol className="return-flow"><li><b>1</b><span><strong>Foto y carga lógica</strong><small>OCR, serie, SKU, pedido y coordinador.</small></span></li><li><b>2</b><span><strong>Aprobación</strong><small>Se valida la relación con el maestro.</small></span></li><li><b>3</b><span><strong>Pendiente físico</strong><small>El contador continúa; aún no existe stock.</small></span></li><li><b>4</b><span><strong>Recepción en MO Company</strong><small>Se crea una devolución y recién se suma 1 unidad.</small></span></li></ol>
      </article>
    </section>

    <section className="panel return-history">
      <div className="panel-title"><div><h2>Seguimiento de devoluciones</h2><p>Tiempo desde la carga lógica hasta la llegada física del equipo.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Código</th><th>Evidencia</th><th>Serie / Part number</th><th>SKU / Descripción</th><th>Coordinador / Pedido</th><th>Registro lógico</th><th>Tiempo transcurrido</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={9}><div className="empty"><LoaderCircle className="spin" size={22} /><p>Cargando devoluciones…</p></div></td></tr> : !returns.length ? <tr><td colSpan={9}><div className="empty"><ImageIcon size={24} /><p>Aún no hay cargas lógicas de devolución.</p></div></td></tr> : returns.map((record) => <tr key={record.id}>
          <td><strong>{record.returnCode}</strong><small>{record.createdBy || "Logística F1"}</small></td>
          <td>{record.evidenceImage ? <a className="return-photo-link" href={record.evidenceImage} target="_blank" rel="noreferrer"><ImageIcon size={15} />Ver etiqueta</a> : "—"}</td>
          <td><strong>{record.serial}</strong><small>PN: {record.detectedPartNumber || "No registrado"}</small><small>{record.matchMethod.replaceAll("_", " ").toLowerCase()} · {record.matchConfidence}%</small></td>
          <td><strong>{record.skuSnapshot}</strong><small>{record.descriptionSnapshot}</small></td>
          <td><strong>{record.coordinatorF1}</strong><small>Pedido: {record.orderNumber || "Sin pedido"}</small></td>
          <td><strong>{displayDate(record.logicalRegisteredAt)}</strong><small>{record.approvedAt ? `Aprobada: ${displayDate(record.approvedAt)}` : "Aprobación pendiente"}</small></td>
          <td><span className={`return-clock ${record.status === "RECIBIDA_FISICA" ? "closed" : "running"}`}><Clock3 size={13} />{elapsedLabel(record)}</span><small>{record.physicallyReceivedAt ? `Recibida: ${displayDate(record.physicallyReceivedAt)}` : "Contador activo"}</small></td>
          <td><span className={`return-status ${record.status.toLowerCase()}`}>{statusLabel(record.status)}</span>{record.notes && <small>{record.notes}</small>}</td>
          <td><div className="return-actions">
            {["PENDIENTE_APROBACION", "OBSERVADA"].includes(record.status) && <button className="secondary-button" disabled={saving} onClick={() => void changeStatus(record, "APROBADA_PENDIENTE_RECEPCION")}><CheckCircle2 size={14} />Aprobar</button>}
            {record.status === "PENDIENTE_APROBACION" && <button className="text-button warning-text" disabled={saving} onClick={() => void changeStatus(record, "OBSERVADA")}><AlertTriangle size={14} />Observar</button>}
            {record.status === "APROBADA_PENDIENTE_RECEPCION" && <button className="primary-button" disabled={saving} onClick={() => void changeStatus(record, "RECIBIDA_FISICA")}><PackageCheck size={14} />Confirmar llegada</button>}
            {!['RECIBIDA_FISICA', 'RECHAZADA'].includes(record.status) && <button className="text-button danger-text" disabled={saving} onClick={() => void changeStatus(record, "RECHAZADA")}><XCircle size={14} />Rechazar</button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}
