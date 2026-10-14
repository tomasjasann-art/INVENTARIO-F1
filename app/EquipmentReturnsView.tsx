"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  LoaderCircle,
  PackageCheck,
  Plus,
  ScanLine,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { normalizeEquipmentIdentifier, recognizeEquipmentReturn } from "../lib/equipment-return-recognition";

type ReturnStatus = "PENDIENTE_APROBACION" | "OBSERVADA" | "APROBADA_PENDIENTE_RECEPCION" | "RECIBIDA_FISICA" | "RECHAZADA";

export type EquipmentReturnRecord = {
  id: number;
  returnCode: string;
  batchCode: string;
  batchItem: number;
  productId: number;
  coordinatorId: number | null;
  sourceMovementId: number | null;
  stockMovementId: number | null;
  coordinatorF1: string;
  orderNumber: string;
  site: string;
  warehouse: string;
  batchComments: string;
  networkComponent: string;
  subProject: string;
  sourceProject: string;
  hardwareTask: string;
  serial: string;
  quantity: number;
  length: string;
  condition: string;
  volumeM3: string;
  detectedPartNumber: string;
  skuSnapshot: string;
  descriptionSnapshot: string;
  matchMethod: string;
  matchConfidence: number;
  evidenceImage: string;
  evidenceImageStored?: string;
  entelLabelImage: string;
  entelLabelImageStored?: string;
  modelImage: string;
  modelImageStored?: string;
  panoramicImage: string;
  panoramicImageStored?: string;
  status: ReturnStatus;
  logicalRegisteredAt: string;
  approvedAt: string;
  approvedBy: string;
  physicallyReceivedAt: string;
  receivedBy: string;
  receiptMovementDate: string;
  receiptDocument: string;
  receiptGrLink: string;
  receiptProject: string;
  receiptOrigin: string;
  receiptCoordinatorEntel: string;
  receiptOriginSite: string;
  receiptStockLocation: string;
  receiptUnitMeasure: string;
  receiptEquipmentStatus: string;
  receiptCondition: string;
  receiptUnitCostCents: number;
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
  unit?: string;
  defaultProject?: string;
  unitCostCents?: number;
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

type DraftRow = {
  key: string;
  productId: number | null;
  productSearch: string;
  serial: string;
  partNumber: string;
  quantity: number;
  networkComponent: string;
  subProject: string;
  sourceProject: string;
  hardwareTask: string;
  length: string;
  condition: string;
  volumeM3: string;
  sourceMovementId: number | null;
  matchMethod: string;
  matchConfidence: number;
  rawOcrText: string;
  evidenceImage: string;
  evidencePreview: string;
  entelLabelImage: string;
  entelLabelPreview: string;
  modelImage: string;
  modelPreview: string;
  panoramicImage: string;
  panoramicPreview: string;
  rememberIdentifier: boolean;
  notes: string;
  warnings: string[];
};

type ReceiptDraft = {
  returnId: number;
  movementDate: string;
  document: string;
  grLink: string;
  orderNumber: string;
  project: string;
  origin: string;
  coordinatorEntel: string;
  originSite: string;
  stockLocation: string;
  unitMeasure: string;
  equipmentStatus: string;
  condition: string;
  unitCost: string;
  notes: string;
};

type ReturnBatch = {
  code: string;
  rows: EquipmentReturnRecord[];
  status: ReturnStatus;
  site: string;
  coordinatorF1: string;
  warehouse: string;
  orderNumber: string;
  createdAt: string;
};

function newDraftRow(key = crypto.randomUUID()): DraftRow {
  return {
    key,
    productId: null,
    productSearch: "",
    serial: "",
    partNumber: "",
    quantity: 1,
    networkComponent: "",
    subProject: "",
    sourceProject: "",
    hardwareTask: "",
    length: "",
    condition: "USADO OPERATIVO",
    volumeM3: "",
    sourceMovementId: null,
    matchMethod: "MANUAL",
    matchConfidence: 0,
    rawOcrText: "",
    evidenceImage: "",
    evidencePreview: "",
    entelLabelImage: "",
    entelLabelPreview: "",
    modelImage: "",
    modelPreview: "",
    panoramicImage: "",
    panoramicPreview: "",
    rememberIdentifier: true,
    notes: "",
    warnings: [],
  };
}

function statusLabel(status: ReturnStatus) {
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

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function saveBlob(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvPayload(values: {
  item: number;
  coordinatorF1: string;
  warehouse: string;
  networkComponent: string;
  subProject: string;
  sourceProject: string;
  hardwareTask: string;
  sku: string;
  serial: string;
  quantity: number;
  condition: string;
  volumeM3: string;
  site: string;
}) {
  return [values.item, values.coordinatorF1, values.warehouse, values.networkComponent, values.subProject, values.sourceProject, values.hardwareTask, values.sku, values.serial, values.quantity, values.condition, values.volumeM3, values.site].map(csvCell).join(",");
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
  const storageScale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const storageCanvas = document.createElement("canvas");
  storageCanvas.width = Math.max(1, Math.round(bitmap.width * storageScale));
  storageCanvas.height = Math.max(1, Math.round(bitmap.height * storageScale));
  storageCanvas.getContext("2d")?.drawImage(bitmap, 0, 0, storageCanvas.width, storageCanvas.height);
  bitmap.close();
  const evidence = storageCanvas.toDataURL("image/jpeg", 0.74);
  if (evidence.length > 2_500_000) throw new Error("La imagen sigue siendo muy pesada. Toma otra más cerca del equipo.");
  return { ocrCanvas, evidence };
}

function returnExportRows(batch: ReturnBatch) {
  return batch.rows.map((record) => ({
    ID: record.batchItem,
    "N.º F1": batch.code,
    "Coordinador F1": record.coordinatorF1,
    Almacén: record.warehouse,
    Comentario: record.batchComments,
    Componente: record.networkComponent,
    "Sub proyecto": record.subProject,
    "Proyecto origen": record.sourceProject,
    "Tarea hardware": record.hardwareTask,
    SKU: record.skuSnapshot,
    Descripción: record.descriptionSnapshot,
    "Serie / Lote": record.serial,
    Largo: record.length,
    Cantidad: record.quantity,
    Condición: record.condition,
    "M3": record.volumeM3,
    Site: record.site,
    "Foto serie": record.evidenceImage,
    "Foto modelo": record.modelImage,
    "Foto panorámica": record.panoramicImage,
    "Etiqueta Entel": record.entelLabelImage,
    Observación: record.notes,
    Estado: statusLabel(record.status),
    CSV: csvPayload({
      item: record.batchItem,
      coordinatorF1: record.coordinatorF1,
      warehouse: record.warehouse,
      networkComponent: record.networkComponent,
      subProject: record.subProject,
      sourceProject: record.sourceProject,
      hardwareTask: record.hardwareTask,
      sku: record.skuSnapshot,
      serial: record.serial,
      quantity: record.quantity,
      condition: record.condition,
      volumeM3: record.volumeM3,
      site: record.site,
    }),
  }));
}

export default function EquipmentReturnsView({ products, productIdentifiers, movements, coordinators, returns, loading, saving, onSave }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => [newDraftRow("draft-initial")]);
  const [coordinatorF1, setCoordinatorF1] = useState("");
  const [site, setSite] = useState("");
  const [warehouse, setWarehouse] = useState("RED");
  const [orderNumber, setOrderNumber] = useState("");
  const [comments, setComments] = useState("");
  const [processingKey, setProcessingKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [receivingBatch, setReceivingBatch] = useState("");
  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([]);

  const f1Coordinators = coordinators.filter((coordinator) => coordinator.active && coordinator.organization === "F1");
  const entelCoordinators = coordinators.filter((coordinator) => coordinator.active && coordinator.organization === "ENTEL");
  const batches = useMemo<ReturnBatch[]>(() => {
    const groups = new Map<string, EquipmentReturnRecord[]>();
    returns.forEach((record) => {
      const code = record.batchCode || record.returnCode;
      groups.set(code, [...(groups.get(code) ?? []), record]);
    });
    return [...groups.entries()].map(([code, group]) => {
      const sorted = group.toSorted((left, right) => (left.batchItem || left.id) - (right.batchItem || right.id));
      return {
        code,
        rows: sorted,
        status: sorted[0]?.status ?? "PENDIENTE_APROBACION",
        site: sorted[0]?.site || "SIN SITE",
        coordinatorF1: sorted[0]?.coordinatorF1 || "—",
        warehouse: sorted[0]?.warehouse || "RED",
        orderNumber: sorted[0]?.orderNumber || "",
        createdAt: sorted[0]?.logicalRegisteredAt || sorted[0]?.createdAt || "",
      };
    }).toSorted((left, right) => Math.max(...right.rows.map((row) => row.id)) - Math.max(...left.rows.map((row) => row.id)));
  }, [returns]);
  const metrics = useMemo(() => {
    const received = batches.filter((batch) => batch.status === "RECIBIDA_FISICA");
    const receivedRows = received.flatMap((batch) => batch.rows).filter((record) => record.physicallyReceivedAt);
    const averageHours = receivedRows.length
      ? Math.round(receivedRows.reduce((sum, record) => sum + Math.max(0, new Date(record.physicallyReceivedAt).getTime() - new Date(record.logicalRegisteredAt).getTime()), 0) / receivedRows.length / 3_600_000)
      : 0;
    return {
      approval: batches.filter((batch) => ["PENDIENTE_APROBACION", "OBSERVADA"].includes(batch.status)).length,
      physical: batches.filter((batch) => batch.status === "APROBADA_PENDIENTE_RECEPCION").length,
      received: received.length,
      average: averageHours >= 24 ? `${Math.round(averageHours / 24)} días` : `${averageHours} h`,
    };
  }, [batches]);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  async function uploadPreparedImage(row: DraftRow, kind: string, evidence: string) {
    const response = await fetch("/api/kardex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "equipmentReturnEvidenceUpload", folderKey: row.key, kind, evidenceImage: evidence }),
    });
    const body = await response.json() as { error?: string; storedImage?: string };
    if (!response.ok || !body.storedImage) throw new Error(body.error || "No se pudo almacenar la fotografía.");
    return body.storedImage;
  }

  async function attachPhoto(row: DraftRow, kind: "serie" | "modelo" | "panoramica" | "entel", file?: File) {
    if (!file || processingKey) return;
    const operationKey = `${row.key}:${kind}`;
    setProcessingKey(operationKey);
    setError("");
    setProgress(kind === "serie" ? 3 : 35);
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    try {
      const prepared = await preparePhoto(file);
      const previewPatch: Partial<DraftRow> = kind === "serie" ? { evidencePreview: prepared.evidence }
        : kind === "modelo" ? { modelPreview: prepared.evidence }
          : kind === "panoramica" ? { panoramicPreview: prepared.evidence }
            : { entelLabelPreview: prepared.evidence };
      updateRow(row.key, previewPatch);
      const uploadPromise = uploadPreparedImage(row, kind, prepared.evidence);
      if (kind === "serie") {
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
        const product = recognized.productId ? products.find((item) => item.id === recognized.productId) : undefined;
        updateRow(row.key, {
          rawOcrText: text,
          serial: recognized.serial,
          partNumber: recognized.partNumber,
          productId: recognized.productId,
          productSearch: product ? `${product.sku} — ${product.description}` : "",
          sourceMovementId: recognized.sourceMovementId,
          matchMethod: recognized.matchMethod,
          matchConfidence: recognized.matchConfidence,
          warnings: recognized.warnings,
        });
        if (!orderNumber && recognized.orderNumber) setOrderNumber(recognized.orderNumber);
        if (!coordinatorF1 && recognized.coordinatorF1) setCoordinatorF1(recognized.coordinatorF1);
      }
      const storedImage = await uploadPromise;
      const storedPatch: Partial<DraftRow> = kind === "serie" ? { evidenceImage: storedImage }
        : kind === "modelo" ? { modelImage: storedImage }
          : kind === "panoramica" ? { panoramicImage: storedImage }
            : { entelLabelImage: storedImage };
      updateRow(row.key, storedPatch);
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo procesar la fotografía.");
    } finally {
      await worker?.terminate();
      setProcessingKey("");
    }
  }

  function selectProduct(row: DraftRow, value: string) {
    const sku = value.split("—")[0].trim().toUpperCase();
    const product = products.find((item) => item.sku.toUpperCase() === sku || `${item.sku} — ${item.description}` === value);
    updateRow(row.key, {
      productSearch: value,
      productId: product?.id ?? null,
      matchMethod: product ? "MANUAL" : row.matchMethod,
      matchConfidence: product ? 100 : 0,
    });
  }

  function resetDraft() {
    setRows([newDraftRow()]);
    setCoordinatorF1("");
    setSite("");
    setWarehouse("RED");
    setOrderNumber("");
    setComments("");
    setProgress(0);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (processingKey) return setError("Espera a que termine la lectura o carga de fotografías.");
    if (!coordinatorF1 || !site.trim()) return setError("Selecciona el Coordinador F1 e ingresa el site.");
    const invalidIndex = rows.findIndex((row) => !row.productId || normalizeEquipmentIdentifier(row.serial).length < 5);
    if (invalidIndex >= 0) return setError(`Fila ${invalidIndex + 1}: selecciona el SKU y completa una Serie/Lote válida.`);
    const ok = await onSave({
      action: "equipmentReturnBatchCreate",
      coordinatorF1,
      orderNumber,
      site,
      warehouse,
      comments,
      rows: rows.map((row) => ({
        productId: row.productId,
        serial: row.serial,
        partNumber: row.partNumber,
        quantity: row.quantity,
        networkComponent: row.networkComponent,
        subProject: row.subProject,
        sourceProject: row.sourceProject,
        hardwareTask: row.hardwareTask,
        length: row.length,
        condition: row.condition,
        volumeM3: row.volumeM3,
        sourceMovementId: row.sourceMovementId,
        matchMethod: row.matchMethod,
        matchConfidence: row.matchConfidence,
        rawOcrText: row.rawOcrText,
        evidenceImage: row.evidenceImage,
        entelLabelImage: row.entelLabelImage,
        modelImage: row.modelImage,
        panoramicImage: row.panoramicImage,
        rememberIdentifier: row.rememberIdentifier && Boolean(row.partNumber.trim()),
        notes: row.notes,
      })),
    }, "Carga lógica del sitio registrada con número F1. Todavía no afecta el stock.");
    if (ok) resetDraft();
  }

  async function changeBatchStatus(batch: ReturnBatch, status: ReturnStatus) {
    let notes = batch.rows[0]?.notes || "";
    if (status === "OBSERVADA") {
      const observation = window.prompt("Escribe la observación que debe corregirse:", notes);
      if (observation === null) return;
      notes = observation.trim();
      if (!notes) return setError("La observación es obligatoria.");
    }
    if (status === "RECHAZADA" && !window.confirm(`¿Rechazar la carga ${batch.code} del site ${batch.site}?`)) return;
    await onSave({ action: "equipmentReturnBatchStatus", batchCode: batch.code, status, notes }, "Estado de la carga del sitio actualizado.");
  }

  function beginPhysicalReceipt(batch: ReturnBatch) {
    setReceivingBatch(batch.code);
    setReceiptDrafts(batch.rows.map((record) => {
      const product = products.find((item) => item.id === record.productId);
      return {
        returnId: record.id,
        movementDate: today(),
        document: "",
        grLink: "",
        orderNumber: record.orderNumber,
        project: product?.defaultProject || "",
        origin: "DESINSTALACIÓN DE SITIO",
        coordinatorEntel: "",
        originSite: record.site,
        stockLocation: "MO COMPANY",
        unitMeasure: product?.unit || "UND",
        equipmentStatus: "USADO",
        condition: record.condition || "OPERATIVO",
        unitCost: product?.unitCostCents ? String(product.unitCostCents / 100) : "",
        notes: record.notes || "",
      };
    }));
    window.setTimeout(() => document.getElementById("return-receipt-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function updateReceipt(returnId: number, patch: Partial<ReceiptDraft>) {
    setReceiptDrafts((current) => current.map((receipt) => receipt.returnId === returnId ? { ...receipt, ...patch } : receipt));
  }

  async function confirmPhysicalReceipt(batch: ReturnBatch) {
    if (!window.confirm(`¿Confirmas que los ${batch.rows.length} registros del site ${batch.site} llegaron físicamente? Se generarán ingresos tipo DESINSTALACIÓN.`)) return;
    const ok = await onSave({ action: "equipmentReturnBatchStatus", batchCode: batch.code, status: "RECIBIDA_FISICA", receipts: receiptDrafts }, "Recepción física confirmada. Los equipos ingresaron como DESINSTALACIÓN.");
    if (ok) {
      setReceivingBatch("");
      setReceiptDrafts([]);
    }
  }

  async function exportExcel(batch: ReturnBatch) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(returnExportRows(batch));
    XLSX.utils.book_append_sheet(workbook, sheet, "Devolución por site");
    XLSX.writeFile(workbook, `${batch.code}-${batch.site.replace(/[^A-Z0-9]+/gi, "-")}.xlsx`);
  }

  function exportCsv(batch: ReturnBatch) {
    const exportRows = returnExportRows(batch);
    const headers = Object.keys(exportRows[0] ?? {});
    const content = [headers.map(csvCell).join(","), ...exportRows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n");
    saveBlob(`${batch.code}-${batch.site.replace(/[^A-Z0-9]+/gi, "-")}.csv`, `\uFEFF${content}`, "text/csv;charset=utf-8");
  }

  async function copyCsvColumn(batch: ReturnBatch) {
    const content = returnExportRows(batch).map((row) => row.CSV).join("\n");
    await navigator.clipboard.writeText(content);
  }

  const receivingGroup = batches.find((batch) => batch.code === receivingBatch);

  return <>
    <section className="return-metrics" aria-label="Indicadores de devoluciones">
      <article><span className="metric-icon amber"><ShieldCheck size={20} /></span><div><small>SITIOS POR APROBAR</small><strong>{metrics.approval}</strong></div></article>
      <article><span className="metric-icon blue"><Clock3 size={20} /></span><div><small>APROBADOS SIN LLEGAR</small><strong>{metrics.physical}</strong></div></article>
      <article><span className="metric-icon green"><PackageCheck size={20} /></span><div><small>SITIOS RECIBIDOS</small><strong>{metrics.received}</strong></div></article>
      <article><span className="metric-icon purple"><Clock3 size={20} /></span><div><small>TIEMPO PROMEDIO</small><strong>{metrics.average}</strong></div></article>
    </section>

    <section className="panel return-batch-builder">
      <div className="panel-title"><div><h2>Nueva carga lógica por site</h2><p>Una carga genera un número F1 y puede incluir varias series, lotes y SKU.</p></div><span className="logical-badge">NO AFECTA STOCK</span></div>
      <form onSubmit={submit}>
        <div className="return-batch-header">
          <label className="field"><span>Coordinador F1 *</span><input list="return-f1-coordinators" value={coordinatorF1} onChange={(event) => setCoordinatorF1(event.target.value.toUpperCase())} placeholder="Busca al coordinador" required /><datalist id="return-f1-coordinators">{f1Coordinators.map((coordinator) => <option value={coordinator.name} key={coordinator.id} />)}</datalist></label>
          <label className="field"><span>Site de desmontaje *</span><input value={site} onChange={(event) => setSite(event.target.value.toUpperCase())} placeholder="Código o nombre del site" required /></label>
          <label className="field"><span>Almacén de procedencia</span><input value={warehouse} onChange={(event) => setWarehouse(event.target.value.toUpperCase())} placeholder="RED" /></label>
          <label className="field"><span>N.º Pedido relacionado</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} placeholder="Pedido / código Oracle" /></label>
          <label className="field field-wide"><span>Comentario general</span><input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Referencia de la desinstalación o devolución" /></label>
        </div>
        <datalist id="return-product-options">{products.map((item) => <option value={`${item.sku} — ${item.description}`} key={item.id} />)}</datalist>

        <div className="return-draft-list">
          {rows.map((row, index) => {
            const product = products.find((item) => item.id === row.productId);
            const rowCsv = csvPayload({ item: index + 1, coordinatorF1, warehouse, networkComponent: row.networkComponent, subProject: row.subProject, sourceProject: row.sourceProject, hardwareTask: row.hardwareTask, sku: product?.sku || "", serial: row.serial, quantity: row.quantity, condition: row.condition, volumeM3: row.volumeM3, site });
            return <article className="return-draft-row" key={row.key}>
              <div className="return-row-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{product?.sku || "Fila manual / por imagen"}</strong><small>{product?.description || "Carga una foto o selecciona el SKU"}</small></div>{rows.length > 1 && <button type="button" className="icon-button danger-text" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} aria-label={`Eliminar fila ${index + 1}`}><Trash2 size={16} /></button>}</div>
              <div className="return-row-fields">
                <label className="field"><span>SKU / descripción *</span><input list="return-product-options" value={row.productSearch} onChange={(event) => selectProduct(row, event.target.value)} placeholder="Busca por SKU o descripción" required /><small>{row.productId ? `Coincidencia ${row.matchConfidence}% · ${row.matchMethod.replaceAll("_", " ").toLowerCase()}` : "Selecciona una opción del maestro."}</small></label>
                <label className="field"><span>Serie / Lote *</span><input value={row.serial} onChange={(event) => updateRow(row.key, { serial: event.target.value.toUpperCase() })} placeholder="Serie única o lote" required /></label>
                <label className="field"><span>Part number</span><input value={row.partNumber} onChange={(event) => updateRow(row.key, { partNumber: event.target.value.toUpperCase() })} placeholder="Editable después del OCR" /></label>
                <label className="field"><span>Cantidad *</span><input type="number" min={1} value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} required /></label>
                <label className="field"><span>Componente</span><input value={row.networkComponent} onChange={(event) => updateRow(row.key, { networkComponent: event.target.value.toUpperCase() })} placeholder="Rack / antena / radio" /></label>
                <label className="field"><span>Sub proyecto</span><input value={row.subProject} onChange={(event) => updateRow(row.key, { subProject: event.target.value.toUpperCase() })} /></label>
                <label className="field"><span>Proyecto origen</span><input value={row.sourceProject} onChange={(event) => updateRow(row.key, { sourceProject: event.target.value.toUpperCase() })} /></label>
                <label className="field"><span>Tarea hardware</span><input value={row.hardwareTask} onChange={(event) => updateRow(row.key, { hardwareTask: event.target.value.toUpperCase() })} /></label>
                <label className="field"><span>Largo</span><input value={row.length} onChange={(event) => updateRow(row.key, { length: event.target.value })} placeholder="20" /></label>
                <label className="field"><span>Condición</span><input value={row.condition} onChange={(event) => updateRow(row.key, { condition: event.target.value.toUpperCase() })} /></label>
                <label className="field"><span>Volumen M3</span><input value={row.volumeM3} onChange={(event) => updateRow(row.key, { volumeM3: event.target.value })} placeholder="0.32" /></label>
                <label className="field"><span>Observación de fila</span><input value={row.notes} onChange={(event) => updateRow(row.key, { notes: event.target.value })} /></label>
              </div>
              <div className="return-photo-grid">
                <PhotoBox label="Foto serie · OCR" preview={row.evidencePreview} busy={processingKey === `${row.key}:serie`} onFile={(file) => void attachPhoto(row, "serie", file)} />
                <PhotoBox label="Foto modelo" preview={row.modelPreview} busy={processingKey === `${row.key}:modelo`} onFile={(file) => void attachPhoto(row, "modelo", file)} />
                <PhotoBox label="Foto panorámica" preview={row.panoramicPreview} busy={processingKey === `${row.key}:panoramica`} onFile={(file) => void attachPhoto(row, "panoramica", file)} />
                <PhotoBox label="Etiqueta Entel · opcional" preview={row.entelLabelPreview} busy={processingKey === `${row.key}:entel`} onFile={(file) => void attachPhoto(row, "entel", file)} />
              </div>
              {processingKey === `${row.key}:serie` && <div className="ocr-progress"><LoaderCircle className="spin" size={15} />Reconociendo serie, part number y SKU… {progress}%</div>}
              {row.partNumber && <label className="remember-part compact"><input type="checkbox" checked={row.rememberIdentifier} onChange={(event) => updateRow(row.key, { rememberIdentifier: event.target.checked })} /><span><strong>Recordar Part Number → SKU</strong><small>Mejora las siguientes lecturas.</small></span></label>}
              {row.warnings.map((warning) => <div className="inline-warning" key={warning}><AlertTriangle size={15} />{warning}</div>)}
              <div className="return-csv-preview"><span>CSV</span><code>{rowCsv}</code><button type="button" className="icon-button" onClick={() => void navigator.clipboard.writeText(rowCsv)} aria-label={`Copiar CSV de fila ${index + 1}`}><Copy size={14} /></button></div>
            </article>;
          })}
        </div>
        <div className="return-add-row"><button className="secondary-button" type="button" onClick={() => setRows((current) => [...current, newDraftRow()])}><Plus size={16} />Agregar fila manual</button><small>Las filas seriadas deben mantenerse separadas con su SKU asociado.</small></div>
        {error && <div className="inline-error">{error}</div>}
        <div className="return-submit-row"><span><ScanLine size={16} />Revisa la tabla y las evidencias antes de registrar.</span><button className="primary-button" type="submit" disabled={saving || Boolean(processingKey)}>{saving ? "Guardando…" : "Generar N.º F1 y registrar carga lógica"}</button></div>
      </form>
    </section>

    {receivingGroup && <section className="panel return-receipt-editor" id="return-receipt-editor">
      <div className="panel-title"><div><h2>Ingreso físico · {receivingGroup.code}</h2><p>Completa manualmente cada fila. Al confirmar se registrará como DESINSTALACIÓN y recién sumará stock.</p></div><button className="icon-button" onClick={() => { setReceivingBatch(""); setReceiptDrafts([]); }} aria-label="Cerrar ingreso físico"><X size={18} /></button></div>
      <datalist id="return-entel-coordinators">{entelCoordinators.map((coordinator) => <option value={coordinator.name} key={coordinator.id} />)}</datalist>
      <div className="receipt-row-list">{receivingGroup.rows.map((record) => {
        const receipt = receiptDrafts.find((item) => item.returnId === record.id);
        if (!receipt) return null;
        return <article className="receipt-row-card" key={record.id}>
          <div className="receipt-row-title"><span>{String(record.batchItem).padStart(2, "0")}</span><div><strong>{record.skuSnapshot} · {record.serial}</strong><small>{record.descriptionSnapshot} · Cant. {record.quantity}</small></div></div>
          <div className="receipt-fields">
            <label className="field"><span>Fecha de ingreso *</span><input type="date" value={receipt.movementDate} onChange={(event) => updateReceipt(record.id, { movementDate: event.target.value })} required /></label>
            <label className="field"><span>GR / Acta de ingreso</span><input value={receipt.document} onChange={(event) => updateReceipt(record.id, { document: event.target.value.toUpperCase() })} placeholder="Si queda vacío usará el N.º F1" /></label>
            <label className="field"><span>Link de GR</span><input value={receipt.grLink} onChange={(event) => updateReceipt(record.id, { grLink: event.target.value })} placeholder="SharePoint o URL" /></label>
            <label className="field"><span>N.º Pedido / Cod. Oracle</span><input value={receipt.orderNumber} onChange={(event) => updateReceipt(record.id, { orderNumber: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Coordinador Entel</span><input list="return-entel-coordinators" value={receipt.coordinatorEntel} onChange={(event) => updateReceipt(record.id, { coordinatorEntel: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Proyecto</span><input value={receipt.project} onChange={(event) => updateReceipt(record.id, { project: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Proviene</span><input value={receipt.origin} onChange={(event) => updateReceipt(record.id, { origin: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Site origen</span><input value={receipt.originSite} onChange={(event) => updateReceipt(record.id, { originSite: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Ubicación de stock</span><select value={receipt.stockLocation} onChange={(event) => updateReceipt(record.id, { stockLocation: event.target.value })}><option>MO COMPANY</option><option>F1 - TRÁNSITO</option></select></label>
            <label className="field"><span>Unidad de medida</span><input value={receipt.unitMeasure} onChange={(event) => updateReceipt(record.id, { unitMeasure: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Estado del equipo</span><input value={receipt.equipmentStatus} onChange={(event) => updateReceipt(record.id, { equipmentStatus: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Condición</span><input value={receipt.condition} onChange={(event) => updateReceipt(record.id, { condition: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Costo unitario S/</span><input type="number" min="0" step="0.01" value={receipt.unitCost} onChange={(event) => updateReceipt(record.id, { unitCost: event.target.value })} placeholder="Automático si queda vacío" /></label>
            <label className="field"><span>Observación</span><input value={receipt.notes} onChange={(event) => updateReceipt(record.id, { notes: event.target.value })} /></label>
          </div>
        </article>;
      })}</div>
      <div className="receipt-confirm"><span><AlertTriangle size={16} />Esta acción crea los movimientos y no puede repetirse.</span><button className="primary-button" disabled={saving} onClick={() => void confirmPhysicalReceipt(receivingGroup)}><PackageCheck size={16} />Confirmar llegada física de todo el site</button></div>
    </section>}

    <section className="panel return-history">
      <div className="panel-title"><div><h2>Cargas por site</h2><p>Evidencias, exportables y tiempo desde la carga lógica hasta la recepción física.</p></div></div>
      <div className="return-batch-list">
        {loading ? <div className="empty"><LoaderCircle className="spin" size={22} /><p>Cargando devoluciones…</p></div> : !batches.length ? <div className="empty"><ImageIcon size={24} /><p>Aún no hay cargas lógicas de devolución.</p></div> : batches.map((batch) => <article className="return-batch-card" key={batch.code}>
          <header><div><span className={`return-status ${batch.status.toLowerCase()}`}>{statusLabel(batch.status)}</span><h3>{batch.code}</h3><p>{batch.site} · {batch.coordinatorF1} · {batch.rows.length} fila(s)</p></div><div className="return-batch-clock"><Clock3 size={15} /><strong>{elapsedLabel(batch.rows[0])}</strong><small>{batch.status === "RECIBIDA_FISICA" ? "Proceso cerrado" : "Tiempo activo"}</small></div></header>
          <div className="return-batch-toolbar">
            <button className="secondary-button" onClick={() => void exportExcel(batch)}><FileSpreadsheet size={15} />Excel</button>
            <button className="secondary-button" onClick={() => exportCsv(batch)}><Download size={15} />CSV</button>
            <button className="secondary-button" onClick={() => void copyCsvColumn(batch)}><Copy size={15} />Copiar columna CSV</button>
            <span>Registro lógico: {displayDate(batch.createdAt)} · Almacén: {batch.warehouse}</span>
          </div>
          <div className="table-wrap"><table className="return-site-table"><thead><tr><th>Ítem</th><th>SKU / Descripción</th><th>Serie / Lote</th><th>Cant.</th><th>Condición / M3</th><th>Evidencias</th><th>CSV</th></tr></thead><tbody>{batch.rows.map((record) => <tr key={record.id}>
            <td><strong>{record.batchItem}</strong></td>
            <td><strong>{record.skuSnapshot}</strong><small>{record.descriptionSnapshot}</small></td>
            <td><strong>{record.serial}</strong><small>PN: {record.detectedPartNumber || "—"}</small></td>
            <td><strong>{record.quantity}</strong><small>{record.length ? `Largo: ${record.length}` : ""}</small></td>
            <td><strong>{record.condition}</strong><small>{record.volumeM3 ? `${record.volumeM3} m³` : "Sin volumen"}</small></td>
            <td><div className="return-evidence-links">{record.evidenceImage && <a href={record.evidenceImage} target="_blank" rel="noreferrer">Serie</a>}{record.modelImage && <a href={record.modelImage} target="_blank" rel="noreferrer">Modelo</a>}{record.panoramicImage && <a href={record.panoramicImage} target="_blank" rel="noreferrer">Panorámica</a>}{record.entelLabelImage && <a href={record.entelLabelImage} target="_blank" rel="noreferrer">Entel</a>}</div></td>
            <td><button className="text-button csv-copy-button" onClick={() => void navigator.clipboard.writeText(returnExportRows(batch).find((row) => row.ID === record.batchItem)?.CSV || "")}><Copy size={13} />Copiar fila</button></td>
          </tr>)}</tbody></table></div>
          <footer><div><strong>{batch.orderNumber || "Sin pedido asociado"}</strong><small>{batch.rows[0]?.batchComments || batch.rows[0]?.notes || "Sin observaciones"}</small></div><div className="return-actions">
            {["PENDIENTE_APROBACION", "OBSERVADA"].includes(batch.status) && <button className="secondary-button" disabled={saving} onClick={() => void changeBatchStatus(batch, "APROBADA_PENDIENTE_RECEPCION")}><CheckCircle2 size={14} />Aprobar carga</button>}
            {batch.status === "PENDIENTE_APROBACION" && <button className="text-button warning-text" disabled={saving} onClick={() => void changeBatchStatus(batch, "OBSERVADA")}><AlertTriangle size={14} />Observar</button>}
            {batch.status === "APROBADA_PENDIENTE_RECEPCION" && <button className="primary-button" disabled={saving} onClick={() => beginPhysicalReceipt(batch)}><PackageCheck size={14} />Cargar cuando llegue el físico</button>}
            {!['RECIBIDA_FISICA', 'RECHAZADA'].includes(batch.status) && <button className="text-button danger-text" disabled={saving} onClick={() => void changeBatchStatus(batch, "RECHAZADA")}><XCircle size={14} />Rechazar</button>}
          </div></footer>
        </article>)}
      </div>
    </section>
  </>;
}

function PhotoBox({ label, preview, busy, onFile }: { label: string; preview: string; busy: boolean; onFile: (file?: File) => void }) {
  return <label className={`return-photo-box ${preview ? "has-photo" : ""}`}>
    {preview ? <Image src={preview} alt={label} width={420} height={260} unoptimized /> : <span><Camera size={19} /><strong>{label}</strong><small>JPG, PNG o WEBP</small></span>}
    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => onFile(event.target.files?.[0])} />
    {busy && <b><LoaderCircle className="spin" size={15} />Cargando…</b>}
  </label>;
}
