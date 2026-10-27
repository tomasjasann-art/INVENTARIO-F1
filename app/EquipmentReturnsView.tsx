"use client";

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  FolderOpen,
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
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import { parseEquipmentReturnExcel } from "../lib/equipment-return-excel";
import { normalizeEquipmentIdentifier, recognizeEquipmentReturn } from "../lib/equipment-return-recognition";

type ReturnStatus = "PENDIENTE_APROBACION" | "OBSERVADA" | "APROBADA_PENDIENTE_RECEPCION" | "RECIBIDA_FISICA" | "RECHAZADA";
type PhotoKind = "serie" | "modelo" | "panoramica" | "entel";

const PHOTO_KINDS: PhotoKind[] = ["serie", "modelo", "panoramica", "entel"];
const DEFAULT_RETURN_CONDITIONS = [
  "USADO OPERATIVO",
  "USADO NO OPERATIVO",
  "OPERATIVO",
  "INOPERATIVO",
  "NUEVO",
  "DAÑADO",
  "PARA REPARACIÓN",
];

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
  dismantlingContractorDocument: string;
  dismantlingContractorName: string;
  orderNumber: string;
  site: string;
  warehouse: string;
  batchComments: string;
  entryDate: string;
  networkComponent: string;
  subProject: string;
  sourceProject: string;
  hardwareTask: string;
  serial: string;
  itemType: "EQUIPO" | "LOTE";
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

type ReturnSupplier = {
  id: number;
  documentType: "RUC" | "DNI";
  documentNumber: string;
  businessName: string;
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
  suppliers: ReturnSupplier[];
  returns: EquipmentReturnRecord[];
  loading: boolean;
  saving: boolean;
  onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
};

type DraftRow = {
  key: string;
  site: string;
  coordinatorF1: string;
  contractorDocument: string;
  contractorName: string;
  productId: number | null;
  productSearch: string;
  serial: string;
  itemType: "EQUIPO" | "LOTE";
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
  entryDate: string;
  createdAt: string;
};

function newDraftRow(key = crypto.randomUUID()): DraftRow {
  return {
    key,
    site: "",
    coordinatorF1: "",
    contractorDocument: "",
    contractorName: "",
    productId: null,
    productSearch: "",
    serial: "",
    itemType: "EQUIPO",
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
  if (status === "PENDIENTE_APROBACION") return "Pendiente de envío";
  if (status === "APROBADA_PENDIENTE_RECEPCION") return "En tránsito · pendiente almacén";
  if (status === "RECIBIDA_FISICA") return "Recibida en almacén";
  if (status === "OBSERVADA") return "Observada";
  return "Rechazada";
}

function elapsedLabel(record: EquipmentReturnRecord) {
  const startValue = record.status === "PENDIENTE_APROBACION" || record.status === "OBSERVADA"
    ? record.logicalRegisteredAt || record.createdAt
    : record.approvedAt || record.logicalRegisteredAt || record.createdAt;
  const start = new Date(startValue).getTime();
  const end = record.physicallyReceivedAt ? new Date(record.physicallyReceivedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const totalHours = Math.max(0, Math.floor((end - start) / 3_600_000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days ? `${days} d ${hours} h` : `${Math.max(1, totalHours)} h`;
}

function transitHours(record: EquipmentReturnRecord) {
  const start = new Date(record.approvedAt || record.logicalRegisteredAt || record.createdAt).getTime();
  const end = record.physicallyReceivedAt ? new Date(record.physicallyReceivedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 3_600_000));
}

function transitSlaLabel(hours: number) {
  if (hours >= 96) {
    const overdueHours = hours - 96;
    const days = Math.floor(overdueHours / 24);
    const remainder = overdueHours % 24;
    return days ? `Vencido por ${days} d ${remainder} h` : `Vencido por ${Math.max(1, remainder)} h`;
  }
  const remainingHours = 96 - hours;
  const days = Math.floor(remainingHours / 24);
  const remainder = remainingHours % 24;
  return days ? `Quedan ${days} d ${remainder} h` : `Quedan ${Math.max(1, remainder)} h`;
}

function displayDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(date);
}

function displayDay(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeZone: "America/Lima" }).format(date);
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
  contractorDocument: string;
  contractorName: string;
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
  return [values.item, values.coordinatorF1, values.contractorDocument, values.contractorName, values.warehouse, values.networkComponent, values.subProject, values.sourceProject, values.hardwareTask, values.sku, values.serial, values.quantity, values.condition, values.volumeM3, values.site].map(csvCell).join(",");
}

function photoKindFromName(fileName: string) {
  const name = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(serie|serial|ssnn|(^|[^a-z])sn([^a-z]|$))/.test(name)) return "serie" as const;
  if (/(modelo|model|part|sku|(^|[^a-z])pn([^a-z]|$))/.test(name)) return "modelo" as const;
  if (/(panoram|general|equipo)/.test(name)) return "panoramica" as const;
  if (/(entel|etiqueta|label)/.test(name)) return "entel" as const;
  return null;
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function imageFile(blob: Blob, prefix = "excel") {
  return new File([blob], `${prefix}-${Date.now()}.${imageExtension(blob.type)}`, { type: blob.type || "image/png" });
}

async function imageFromClipboardEvent(event: ClipboardEvent<HTMLElement>) {
  const directFile = [...event.clipboardData.files].find((file) => file.type.startsWith("image/"));
  if (directFile) return directFile;
  const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"));
  const itemFile = imageItem?.getAsFile();
  if (itemFile) return itemFile;
  const html = event.clipboardData.getData("text/html");
  const dataImage = html.match(/<img[^>]+src=["'](data:image\/(?:png|jpeg|webp);base64,[^"']+)["']/i)?.[1];
  if (!dataImage) return null;
  const response = await fetch(dataImage);
  return imageFile(await response.blob());
}

async function imageFromSystemClipboard() {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => /^image\/(png|jpeg|webp)$/i.test(type));
    if (!imageType) continue;
    return imageFile(await item.getType(imageType));
  }
  return null;
}

async function preparePhoto(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una imagen JPG, PNG o WEBP.");
  if (file.size > 10_000_000) throw new Error("La imagen supera 10 MB.");
  const bitmap = await createImageBitmap(file);
  const ocrScale = Math.min(3, Math.max(1, 2400 / Math.max(bitmap.width, bitmap.height)));
  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = Math.max(1, Math.round(bitmap.width * ocrScale));
  ocrCanvas.height = Math.max(1, Math.round(bitmap.height * ocrScale));
  const ocrContext = ocrCanvas.getContext("2d");
  if (ocrContext) {
    ocrContext.imageSmoothingEnabled = true;
    ocrContext.imageSmoothingQuality = "high";
    ocrContext.filter = "grayscale(1) contrast(1.55)";
    ocrContext.drawImage(bitmap, 0, 0, ocrCanvas.width, ocrCanvas.height);
  }
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

function combineOcrCanvases(canvases: HTMLCanvasElement[]) {
  if (!canvases.length) return null;
  const width = Math.max(...canvases.map((canvas) => canvas.width));
  const height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
  const combined = document.createElement("canvas");
  combined.width = width;
  combined.height = height;
  const context = combined.getContext("2d");
  if (context) context.fillStyle = "#ffffff";
  context?.fillRect(0, 0, width, height);
  let top = 0;
  canvases.forEach((canvas) => {
    context?.drawImage(canvas, 0, top);
    top += canvas.height;
  });
  return combined;
}

function returnExportRows(batch: ReturnBatch) {
  return batch.rows.map((record) => ({
    ID: record.batchItem,
    "N.º F1": batch.code,
    "Fecha de ingreso": record.entryDate,
    "Coordinador F1": record.coordinatorF1,
    "RUC Contrata": record.dismantlingContractorDocument,
    "Contrata que desmontó": record.dismantlingContractorName,
    Almacén: record.warehouse,
    Comentario: record.batchComments,
    Componente: record.networkComponent,
    "Sub proyecto": record.subProject,
    "Proyecto origen": record.sourceProject,
    "Tarea hardware": record.hardwareTask,
    SKU: record.skuSnapshot,
    Descripción: record.descriptionSnapshot,
    "Serie / Lote": record.serial,
    "Tipo de registro": record.itemType,
    Largo: record.length,
    Cantidad: record.quantity,
    Condición: record.condition,
    "M3": record.volumeM3,
    Site: record.site,
    Observación: record.notes,
    Estado: statusLabel(record.status),
    CSV: csvPayload({
      item: record.batchItem,
      coordinatorF1: record.coordinatorF1,
      contractorDocument: record.dismantlingContractorDocument,
      contractorName: record.dismantlingContractorName,
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
    "Foto serie": record.evidenceImage,
    "Foto modelo": record.modelImage,
    "Foto panorámica": record.panoramicImage,
    "Etiqueta Entel": record.entelLabelImage,
  }));
}

export default function EquipmentReturnsView({ products, productIdentifiers, movements, coordinators, suppliers, returns, loading, saving, onSave }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => [newDraftRow("draft-initial")]);
  const [coordinatorF1, setCoordinatorF1] = useState("");
  const [site, setSite] = useState("");
  const [warehouse, setWarehouse] = useState("RED");
  const [orderNumber, setOrderNumber] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [comments, setComments] = useState("");
  const [processingKey, setProcessingKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [excelImportStatus, setExcelImportStatus] = useState("");
  const [excelDragging, setExcelDragging] = useState(false);
  const [error, setError] = useState("");
  const [receivingBatch, setReceivingBatch] = useState("");
  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([]);
  const entryTableRef = useRef<HTMLTableElement>(null);
  const entryTableScrollRef = useRef<HTMLDivElement>(null);
  const entryTableTopScrollRef = useRef<HTMLDivElement>(null);
  const [entryTableWidth, setEntryTableWidth] = useState(0);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const table = entryTableRef.current;
    const viewport = entryTableScrollRef.current;
    if (!table || !viewport) return;
    const updateWidth = () => setEntryTableWidth(Math.max(table.scrollWidth, viewport.clientWidth));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(table);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [rows.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((current) => current + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      const sites = [...new Set(sorted.map((row) => row.site).filter(Boolean))];
      const batchCoordinators = [...new Set(sorted.map((row) => row.coordinatorF1).filter(Boolean))];
      return {
        code,
        rows: sorted,
        status: sorted[0]?.status ?? "PENDIENTE_APROBACION",
        site: sites.length > 2 ? `${sites[0]} +${sites.length - 1} sites` : sites.join(" · ") || "SIN SITE",
        coordinatorF1: batchCoordinators.length > 2 ? `${batchCoordinators[0]} +${batchCoordinators.length - 1}` : batchCoordinators.join(" · ") || "—",
        warehouse: sorted[0]?.warehouse || "RED",
        orderNumber: sorted[0]?.orderNumber || "",
        entryDate: sorted[0]?.entryDate || "",
        createdAt: sorted[0]?.logicalRegisteredAt || sorted[0]?.createdAt || "",
      };
    }).toSorted((left, right) => Math.max(...right.rows.map((row) => row.id)) - Math.max(...left.rows.map((row) => row.id)));
  }, [returns]);
  const metrics = useMemo(() => {
    const received = batches.filter((batch) => batch.status === "RECIBIDA_FISICA");
    const receivedRows = received.flatMap((batch) => batch.rows).filter((record) => record.physicallyReceivedAt);
    const averageHours = receivedRows.length
      ? Math.round(receivedRows.reduce((sum, record) => sum + transitHours(record), 0) / receivedRows.length)
      : 0;
    return {
      approval: batches.filter((batch) => ["PENDIENTE_APROBACION", "OBSERVADA"].includes(batch.status)).length,
      physical: batches.filter((batch) => batch.status === "APROBADA_PENDIENTE_RECEPCION").length,
      received: received.length,
      average: averageHours >= 24 ? `${Math.round(averageHours / 24)} días` : `${averageHours} h`,
    };
  }, [batches]);
  const coordinatorFollowUp = useMemo(() => {
    void clockTick;
    const groups = new Map<string, EquipmentReturnRecord[]>();
    returns.filter((record) => record.status === "APROBADA_PENDIENTE_RECEPCION").forEach((record) => {
      const coordinator = record.coordinatorF1.trim().toUpperCase() || "SIN COORDINADOR";
      groups.set(coordinator, [...(groups.get(coordinator) ?? []), record]);
    });
    return [...groups.entries()].map(([coordinator, records]) => {
      const oldest = records.toSorted((left, right) => transitHours(right) - transitHours(left))[0];
      const hours = oldest ? transitHours(oldest) : 0;
      return {
        coordinator,
        rows: records.reduce((sum, record) => sum + record.quantity, 0),
        batches: new Set(records.map((record) => record.batchCode || record.returnCode)).size,
        sites: new Set(records.map((record) => record.site).filter(Boolean)).size,
        hours,
        overdue: hours >= 96,
      };
    }).toSorted((left, right) => Number(right.overdue) - Number(left.overdue) || right.hours - left.hours);
  }, [clockTick, returns]);
  const conditionOptions = useMemo(() => [...new Set([
    ...DEFAULT_RETURN_CONDITIONS,
    ...returns.map((record) => record.condition),
    ...returns.map((record) => record.receiptCondition),
    ...rows.map((row) => row.condition),
    ...receiptDrafts.map((receipt) => receipt.condition),
  ].map((value) => value.trim().toUpperCase()).filter(Boolean))].toSorted(), [receiptDrafts, returns, rows]);
  const bulkPreview = useMemo(() => {
    const identifierCounts = new Map<string, number>();
    rows.forEach((row) => {
      const serialKey = normalizeEquipmentIdentifier(row.serial);
      const rowSite = (row.site || site).trim().toUpperCase().replace(/\s+/g, " ");
      const controlKey = row.itemType === "LOTE" ? `LOTE:${row.productId ?? 0}:${rowSite}:${serialKey}` : `EQUIPO:${serialKey}`;
      if (serialKey) identifierCounts.set(controlKey, (identifierCounts.get(controlKey) ?? 0) + 1);
    });
    const ready = rows.filter((row) => {
      const serialKey = normalizeEquipmentIdentifier(row.serial);
      const rowSite = (row.site || site).trim().toUpperCase().replace(/\s+/g, " ");
      const controlKey = row.itemType === "LOTE" ? `LOTE:${row.productId ?? 0}:${rowSite}:${serialKey}` : `EQUIPO:${serialKey}`;
      const validQuantity = row.itemType === "LOTE" || row.quantity === 1;
      const rowCoordinator = (row.coordinatorF1 || coordinatorF1).trim();
      const contractor = suppliers.find((item) => item.active && item.documentType === "RUC" && item.documentNumber === row.contractorDocument);
      return Boolean(row.productId) && Boolean(rowSite) && Boolean(rowCoordinator) && Boolean(contractor) && serialKey.length >= 5 && identifierCounts.get(controlKey) === 1 && validQuantity;
    }).length;
    return { total: rows.length, ready, review: rows.length - ready };
  }, [coordinatorF1, rows, site, suppliers]);

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

  async function attachPhoto(row: DraftRow, kind: PhotoKind, file?: File) {
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
          coordinatorF1: row.coordinatorF1 || recognized.coordinatorF1?.toUpperCase() || "",
          rawOcrText: text,
          serial: recognized.serial,
          partNumber: recognized.partNumber,
          productId: recognized.productId,
          productSearch: product ? `${product.sku} — ${product.description}` : "",
          itemType: product?.category.toUpperCase() === "LOTE" ? "LOTE" : "EQUIPO",
          sourceMovementId: recognized.sourceMovementId,
          matchMethod: recognized.matchMethod,
          matchConfidence: recognized.matchConfidence,
          warnings: recognized.warnings,
        });
        if (!orderNumber && recognized.orderNumber) setOrderNumber(recognized.orderNumber);
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

  async function attachPhotoFolder(row: DraftRow, selectedFiles: File[]) {
    const files = selectedFiles.filter((file) => file.type.startsWith("image/")).slice(0, 4);
    if (!files.length) return setError("La carpeta no contiene fotografías JPG, PNG o WEBP.");
    const assigned = new Set<PhotoKind>();
    const assignments = files.map((file) => {
      const inferred = photoKindFromName(file.name);
      const kind = inferred && !assigned.has(inferred) ? inferred : PHOTO_KINDS.find((candidate) => !assigned.has(candidate));
      if (kind) assigned.add(kind);
      return { file, kind };
    }).filter((entry): entry is { file: File; kind: PhotoKind } => Boolean(entry.kind));
    for (const assignment of assignments) await attachPhoto(row, assignment.kind, assignment.file);
  }

  function selectProduct(row: DraftRow, value: string) {
    const sku = value.split("—")[0].trim().toUpperCase();
    const product = products.find((item) => item.sku.toUpperCase() === sku || `${item.sku} — ${item.description}` === value);
    updateRow(row.key, {
      productSearch: value,
      productId: product?.id ?? null,
      itemType: product?.category.toUpperCase() === "LOTE" ? "LOTE" : "EQUIPO",
      matchMethod: product ? "MANUAL" : row.matchMethod,
      matchConfidence: product ? 100 : 0,
    });
  }

  function updateContractorDocument(row: DraftRow, value: string) {
    const document = value.replace(/\D/g, "").slice(0, 11);
    const supplier = suppliers.find((item) => item.active && item.documentType === "RUC" && item.documentNumber === document);
    const contractorWarnings = row.warnings.filter((warning) => ![
      "Completa el RUC de la contrata",
      "El RUC de la contrata no está",
      "La contrata está inactiva",
    ].some((prefix) => warning.startsWith(prefix)));
    const registeredSupplier = suppliers.find((item) => item.documentType === "RUC" && item.documentNumber === document);
    updateRow(row.key, {
      contractorDocument: document,
      contractorName: supplier?.businessName.toUpperCase() || "",
      warnings: document.length === 11 && !registeredSupplier
        ? [...contractorWarnings, "El RUC de la contrata no está en Empresas y personas."]
        : registeredSupplier && !registeredSupplier.active
          ? [...contractorWarnings, "La contrata está inactiva en Empresas y personas."]
          : contractorWarnings,
    });
  }

  function resetDraft() {
    setRows([newDraftRow()]);
    setCoordinatorF1("");
    setSite("");
    setWarehouse("RED");
    setOrderNumber("");
    setEntryDate(today());
    setComments("");
    setProgress(0);
    setExcelImportStatus("");
    setExcelDragging(false);
    setError("");
  }

  async function downloadBulkTemplate() {
    const XLSX = await import("xlsx");
    const headers = [
      "ID", "Fecha de Ingreso", "Coordinador F1", "RUC Contrata", "Almacén", "Comentarios", "Componente", "Subproyecto", "Proyecto Origen",
      "Tarea Hardware", "SKU", "Descripción", "Serie/Lote", "Tipo de Registro", "Solicitud de Devolución", "Largo", "Cantidad",
      "Condición", "M3", "Site", "Observación", "Foto de Serie Legible Equipo", "Foto de Modelo Legible Equipo",
      "Foto Panorámica de Equipos", "Opcional Etiqueta Entel",
    ];
    const example = [
      1, today(), "COORDINADOR F1", "20123456789", "RED", "DEVOLUCIÓN DE SITE", "RACK", "SUBPROYECTO", "PROYECTO ORIGEN",
      "TAREA", "ENT960000001", "DESCRIPCIÓN DEL EQUIPO", "SERIE001", "EQUIPO", "PEDIDO-001", 20, 1,
      "USADO OPERATIVO", 0.32, "SITE-001", "OBSERVACIÓN", "PEGAR FOTO", "PEGAR FOTO", "PEGAR FOTO", "OPCIONAL",
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    sheet["!cols"] = headers.map((header) => ({ wch: Math.min(36, Math.max(12, header.length + 3)) }));
    sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}2` };
    const instructions = XLSX.utils.aoa_to_sheet([
      ["PLANTILLA DE CARGA MASIVA DE DEVOLUCIONES"],
      ["Regla", "Detalle"],
      ["Una fila por serie", "Los equipos seriados deben ir en líneas independientes con su SKU asociado."],
      ["Tipo de registro", "Selecciona EQUIPO para una serie individual (cantidad 1) o LOTE cuando una misma identificación representa varias unidades."],
      ["Fecha", "Completa la Fecha de Ingreso. Si todas las filas pertenecen a una carga, se usará la primera fecha encontrada."],
      ["Fotos", "Pega cada foto como imagen dentro de su columna y alineada con la fila correspondiente."],
      ["Lotes", "Para lotes indica Serie/Lote y la cantidad total de esa línea."],
      ["Contrata", "Indica únicamente el RUC de la contrata que realizó el desmontaje. La razón social se completará automáticamente desde el maestro Empresas y personas."],
      ["RUC no registrado", "La fila quedará por revisar. Registra o activa primero el RUC en Empresas y personas; no se aceptarán razones sociales escritas manualmente."],
      ["Revisión", "La carga se mostrará primero en pantalla para corregir SKU, serie, condición y evidencias."],
      ["Stock", "La carga lógica no suma stock. El stock se actualiza recién al confirmar la llegada física."],
      ["Límite", "Máximo 100 líneas por archivo y por site."],
    ]);
    instructions["!cols"] = [{ wch: 20 }, { wch: 105 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Devoluciones");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instrucciones");
    XLSX.writeFile(workbook, "plantilla-carga-masiva-devoluciones-f1.xlsx", { compression: true });
  }

  async function importExcel(file?: File) {
    if (!file || processingKey) return;
    setProcessingKey("excel-import");
    setProgress(1);
    setError("");
    setExcelImportStatus(`Leyendo ${file.name}…`);
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    let activeRowIndex = 0;
    let totalRows = 1;
    try {
      const imported = await parseEquipmentReturnExcel(file);
      if (imported.rows.length > 100) throw new Error(`El archivo contiene ${imported.rows.length} filas. El máximo por carga y por site es 100.`);
      totalRows = imported.rows.length;
      const draftRows = imported.rows.map((source) => {
        const product = products.find((item) => normalizeEquipmentIdentifier(item.sku) === normalizeEquipmentIdentifier(source.sku))
          ?? products.find((item) => source.description && normalizeEquipmentIdentifier(item.description) === normalizeEquipmentIdentifier(source.description));
        const supplier = suppliers.find((item) => item.documentType === "RUC" && item.documentNumber === source.contractorDocument);
        const itemType = source.itemType || (product?.category.toUpperCase() === "LOTE" ? "LOTE" : "EQUIPO");
        return {
          ...newDraftRow(),
          site: source.site.toUpperCase(),
          coordinatorF1: source.coordinatorF1.toUpperCase(),
          contractorDocument: source.contractorDocument,
          contractorName: supplier?.active ? supplier.businessName.toUpperCase() : "",
          productId: product?.id ?? null,
          productSearch: product ? `${product.sku} — ${product.description}` : source.sku,
          serial: source.serial.toUpperCase(),
          itemType,
          quantity: source.quantity,
          networkComponent: source.networkComponent.toUpperCase(),
          subProject: source.subProject.toUpperCase(),
          sourceProject: source.sourceProject.toUpperCase(),
          hardwareTask: source.hardwareTask.toUpperCase(),
          length: source.length,
          condition: source.condition.toUpperCase(),
          volumeM3: source.volumeM3,
          matchMethod: product ? "SKU_VISIBLE" : "MANUAL",
          matchConfidence: product ? 100 : 0,
          notes: source.notes,
          warnings: [...source.warnings,
            ...(!source.contractorDocument ? ["Completa el RUC de la contrata que realizó el desmontaje."] : []),
            ...(source.contractorDocument && !supplier ? ["El RUC de la contrata no está en Empresas y personas."] : []),
            ...(supplier && !supplier.active ? ["La contrata está inactiva en Empresas y personas."] : []),
          ],
        } satisfies DraftRow;
      });

      setRows(draftRows);
      const firstWithCoordinator = imported.rows.find((row) => row.coordinatorF1)?.coordinatorF1;
      const firstWithSite = imported.rows.find((row) => row.site)?.site;
      const firstWithWarehouse = imported.rows.find((row) => row.warehouse)?.warehouse;
      const firstWithOrder = imported.rows.find((row) => row.orderNumber)?.orderNumber;
      const firstWithEntryDate = imported.rows.find((row) => row.entryDate)?.entryDate;
      const firstWithComments = imported.rows.find((row) => row.comments)?.comments;
      if (firstWithCoordinator) setCoordinatorF1(firstWithCoordinator.toUpperCase());
      if (firstWithSite) setSite(firstWithSite.toUpperCase());
      if (firstWithWarehouse) setWarehouse(firstWithWarehouse.toUpperCase());
      if (firstWithOrder) setOrderNumber(firstWithOrder.toUpperCase());
      if (firstWithEntryDate) setEntryDate(firstWithEntryDate);
      if (firstWithComments) setComments(firstWithComments);

      const needsOcr = imported.rows.some((source, index) => {
        const draft = draftRows[index];
        return (!draft.serial || !draft.productId) && Boolean(source.photos.serie || source.photos.modelo);
      });
      if (needsOcr) {
        const { createWorker, PSM } = await import("tesseract.js");
        worker = await createWorker("eng", 1, {
          logger: (message) => {
            if (message.status !== "recognizing text") return;
            const rowProgress = Math.max(0, Math.min(1, message.progress));
            setProgress(Math.round(((activeRowIndex + rowProgress) / totalRows) * 100));
          },
        });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
      }

      let readyRows = 0;
      const preparedPhotoCache = new Map<string, Awaited<ReturnType<typeof preparePhoto>>>();
      const storedPhotoCache = new Map<string, string>();
      for (const [index, source] of imported.rows.entries()) {
        activeRowIndex = index;
        const draft = draftRows[index];
        setExcelImportStatus(`Procesando fila ${index + 1} de ${imported.rows.length} · Excel ${source.excelRow}…`);
        const preparedPhotos: Partial<Record<PhotoKind, Awaited<ReturnType<typeof preparePhoto>>>> = {};
        const rowWarnings = [...source.warnings];
        try {
          for (const kind of PHOTO_KINDS) {
            const photo = source.photos[kind];
            if (!photo) continue;
            const cached = preparedPhotoCache.get(photo.archivePath);
            const prepared = cached ?? await preparePhoto(photo.file);
            preparedPhotoCache.set(photo.archivePath, prepared);
            preparedPhotos[kind] = prepared;
          }
          updateRow(draft.key, {
            evidencePreview: preparedPhotos.serie?.evidence ?? "",
            modelPreview: preparedPhotos.modelo?.evidence ?? "",
            panoramicPreview: preparedPhotos.panoramica?.evidence ?? "",
            entelLabelPreview: preparedPhotos.entel?.evidence ?? "",
          });

          let ocrText = "";
          let recognized: ReturnType<typeof recognizeEquipmentReturn> | null = null;
          if (worker && (!draft.serial || !draft.productId)) {
            const combined = combineOcrCanvases([preparedPhotos.serie?.ocrCanvas, preparedPhotos.modelo?.ocrCanvas].filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas)));
            if (combined) {
              const result = await worker.recognize(combined);
              ocrText = result.data.text || "";
              recognized = recognizeEquipmentReturn({ text: ocrText, products, identifiers: productIdentifiers, movements });
            }
          }
          const spreadsheetProduct = draft.productId ? products.find((item) => item.id === draft.productId) : undefined;
          const recognizedProduct = recognized?.productId ? products.find((item) => item.id === recognized.productId) : undefined;
          const product = spreadsheetProduct ?? recognizedProduct;
          const serial = draft.serial || recognized?.serial || "";
          if (source.sku && !spreadsheetProduct) rowWarnings.push(`El SKU ${source.sku} no coincide con el maestro; confirma el equipo.`);
          if (!serial) rowWarnings.push("No se reconoció la serie/lote; debes escribirla manualmente.");
          if (!product) rowWarnings.push("No se pudo relacionar el equipo con el maestro SKU.");
          const storedPhotos = await Promise.all(PHOTO_KINDS.map(async (kind) => {
            const prepared = preparedPhotos[kind];
            if (!prepared) return [kind, ""] as const;
            try {
              const archivePath = source.photos[kind]?.archivePath ?? "";
              const cached = archivePath ? storedPhotoCache.get(archivePath) : "";
              const storedImage = cached || await uploadPreparedImage(draft, kind, prepared.evidence);
              if (archivePath) storedPhotoCache.set(archivePath, storedImage);
              return [kind, storedImage] as const;
            } catch (caught) {
              rowWarnings.push(caught instanceof Error ? caught.message : `No se pudo almacenar la foto ${kind}.`);
              return [kind, ""] as const;
            }
          }));
          const stored = Object.fromEntries(storedPhotos) as Record<PhotoKind, string>;
          const recognitionWarnings = (recognized?.warnings ?? []).filter((warning) => {
            if (serial && warning.startsWith("No se detectó claramente la serie")) return false;
            if (product && (warning.startsWith("No hubo una relación única") || warning.startsWith("El part number coincide"))) return false;
            return true;
          });
          updateRow(draft.key, {
            coordinatorF1: draft.coordinatorF1 || recognized?.coordinatorF1?.toUpperCase() || "",
            productId: product?.id ?? null,
            productSearch: product ? `${product.sku} — ${product.description}` : source.sku,
            serial,
            itemType: source.itemType || (product?.category.toUpperCase() === "LOTE" ? "LOTE" : "EQUIPO"),
            partNumber: recognized?.partNumber || "",
            sourceMovementId: recognized?.sourceMovementId ?? null,
            matchMethod: spreadsheetProduct ? "SKU_VISIBLE" : recognized?.matchMethod ?? "MANUAL",
            matchConfidence: spreadsheetProduct ? 100 : recognized?.matchConfidence ?? 0,
            rawOcrText: ocrText,
            evidenceImage: stored.serie,
            modelImage: stored.modelo,
            panoramicImage: stored.panoramica,
            entelLabelImage: stored.entel,
            warnings: [...new Set([...rowWarnings, ...recognitionWarnings])],
          });
          if (!firstWithOrder && recognized?.orderNumber) setOrderNumber(recognized.orderNumber);
          if (!firstWithCoordinator && recognized?.coordinatorF1) setCoordinatorF1(recognized.coordinatorF1);
          if (serial && product) readyRows += 1;
        } catch (caught) {
          rowWarnings.push(caught instanceof Error ? caught.message : "No se pudo procesar completamente esta fila.");
          updateRow(draft.key, { warnings: [...new Set(rowWarnings)] });
        }
        setProgress(Math.round(((index + 1) / imported.rows.length) * 100));
      }
      const reviewRows = imported.rows.length - readyRows;
      setExcelImportStatus(`${file.name}: ${imported.rows.length} filas cargadas · ${readyRows} listas · ${reviewRows} por revisar.`);
    } catch (caught) {
      setExcelImportStatus("");
      setError(caught instanceof Error ? caught.message : "No se pudo importar el Excel de devolución.");
    } finally {
      await worker?.terminate();
      setProcessingKey("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (processingKey) return setError("Espera a que termine la lectura o carga de fotografías.");
    if (!entryDate) return setError("Selecciona la fecha de ingreso.");
    const missingCoordinatorIndex = rows.findIndex((row) => !(row.coordinatorF1 || coordinatorF1).trim());
    if (missingCoordinatorIndex >= 0) return setError(`Fila ${missingCoordinatorIndex + 1}: selecciona el Coordinador F1 o ingresa uno predeterminado.`);
    const invalidContractorDocumentIndex = rows.findIndex((row) => !/^\d{11}$/.test(row.contractorDocument));
    if (invalidContractorDocumentIndex >= 0) return setError(`Fila ${invalidContractorDocumentIndex + 1}: completa el RUC de 11 dígitos de la contrata que realizó el desmontaje.`);
    const missingContractorIndex = rows.findIndex((row) => !suppliers.some((item) => item.active && item.documentType === "RUC" && item.documentNumber === row.contractorDocument));
    if (missingContractorIndex >= 0) return setError(`Fila ${missingContractorIndex + 1}: el RUC no existe o está inactivo en Empresas y personas.`);
    const missingSiteIndex = rows.findIndex((row) => !(row.site || site).trim());
    if (missingSiteIndex >= 0) return setError(`Fila ${missingSiteIndex + 1}: completa el site o ingresa un site predeterminado.`);
    const invalidIndex = rows.findIndex((row) => !row.productId || normalizeEquipmentIdentifier(row.serial).length < 5);
    if (invalidIndex >= 0) return setError(`Fila ${invalidIndex + 1}: selecciona el SKU y completa una Serie/Lote válida.`);
    const invalidEquipmentQuantityIndex = rows.findIndex((row) => row.itemType === "EQUIPO" && row.quantity !== 1);
    if (invalidEquipmentQuantityIndex >= 0) return setError(`Fila ${invalidEquipmentQuantityIndex + 1}: un equipo seriado debe tener cantidad 1. Selecciona LOTE si la identificación agrupa varias unidades.`);
    const seenControls = new Set<string>();
    const duplicateIndex = rows.findIndex((row) => {
      const serialKey = normalizeEquipmentIdentifier(row.serial);
      const rowSite = (row.site || site).trim().toUpperCase().replace(/\s+/g, " ");
      const controlKey = row.itemType === "LOTE" ? `LOTE:${row.productId}:${rowSite}:${serialKey}` : `EQUIPO:${serialKey}`;
      if (seenControls.has(controlKey)) return true;
      seenControls.add(controlKey);
      return false;
    });
    if (duplicateIndex >= 0) {
      const repeated = rows[duplicateIndex];
      return setError(repeated.itemType === "LOTE"
        ? `Fila ${duplicateIndex + 1}: el lote está repetido para el mismo SKU dentro del site ${(repeated.site || site).trim().toUpperCase()}.`
        : `Fila ${duplicateIndex + 1}: la serie del equipo está repetida dentro de esta carga.`);
    }
    const ok = await onSave({
      action: "equipmentReturnBatchCreate",
      coordinatorF1,
      orderNumber,
      entryDate,
      site,
      warehouse,
      comments,
      rows: rows.map((row) => ({
        site: (row.site || site).trim().toUpperCase(),
        coordinatorF1: (row.coordinatorF1 || coordinatorF1).trim().toUpperCase(),
        contractorDocument: row.contractorDocument,
        contractorName: suppliers.find((item) => item.active && item.documentType === "RUC" && item.documentNumber === row.contractorDocument)?.businessName.toUpperCase() || "",
        productId: row.productId,
        serial: row.serial,
        itemType: row.itemType,
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
    if (status === "APROBADA_PENDIENTE_RECEPCION" && !window.confirm(`¿Confirmas que la carga ${batch.code} ya fue enviada? Desde este momento inicia el seguimiento de 4 días hasta el almacén.`)) return;
    if (status === "RECHAZADA" && !window.confirm(`¿Rechazar la carga ${batch.code}?`)) return;
    await onSave({ action: "equipmentReturnBatchStatus", batchCode: batch.code, status, notes }, status === "APROBADA_PENDIENTE_RECEPCION" ? "Envío registrado. Se inició el seguimiento de 4 días hasta el almacén." : "Estado de la carga actualizado.");
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
    if (!window.confirm(`¿Confirmas que los ${batch.rows.length} registros llegaron físicamente al almacén? Recién ahora se generarán ingresos tipo DESINSTALACIÓN en el Kardex.`)) return;
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
    sheet["!cols"] = [
      { wch: 7 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 25 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 24 },
      { wch: 10 }, { wch: 11 }, { wch: 22 }, { wch: 10 }, { wch: 22 }, { wch: 28 },
      { wch: 18 }, { wch: 55 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 },
    ];
    if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
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
      <article><span className="metric-icon amber"><ShieldCheck size={20} /></span><div><small>CARGAS POR ENVIAR</small><strong>{metrics.approval}</strong></div></article>
      <article><span className="metric-icon blue"><Clock3 size={20} /></span><div><small>ENVÍOS SIN LLEGAR</small><strong>{metrics.physical}</strong></div></article>
      <article><span className="metric-icon green"><PackageCheck size={20} /></span><div><small>RECIBIDOS EN ALMACÉN</small><strong>{metrics.received}</strong></div></article>
      <article><span className="metric-icon purple"><Clock3 size={20} /></span><div><small>TIEMPO PROMEDIO DE TRÁNSITO</small><strong>{metrics.average}</strong></div></article>
    </section>

    <section className="panel return-follow-up">
      <div className="panel-title"><div><h2>Seguimiento por Coordinador F1</h2><p>Tiempo desde que se marca el envío hasta su recepción física. Plazo máximo: 4 días.</p></div><span className="logical-badge">SLA 4 DÍAS</span></div>
      <div className="return-follow-up-grid">
        {!coordinatorFollowUp.length ? <div className="empty"><CheckCircle2 size={22} /><p>No hay devoluciones en tránsito pendientes de llegar al almacén.</p></div> : coordinatorFollowUp.map((item) => <article className={item.overdue ? "is-overdue" : "is-on-time"} key={item.coordinator}>
          <header><div><strong>{item.coordinator}</strong><small>{item.batches} envío(s) · {item.sites} site(s) · {item.rows} unidad(es)</small></div><span>{item.overdue ? "VENCIDO" : "EN PLAZO"}</span></header>
          <div><Clock3 size={16} /><strong>{item.hours >= 24 ? `${Math.floor(item.hours / 24)} d ${item.hours % 24} h` : `${Math.max(1, item.hours)} h`}</strong><small>{transitSlaLabel(item.hours)}</small></div>
        </article>)}
      </div>
    </section>

    <section className="panel return-batch-builder">
      <div className="panel-title"><div><h2>Nueva carga lógica de devolución</h2><p>Una carga genera un número F1 y puede incluir distintos sites, coordinadores, series, lotes y SKU.</p></div><span className="logical-badge">NO AFECTA STOCK</span></div>
      <form onSubmit={submit}>
        <div
          className={`return-excel-import ${excelDragging ? "is-dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setExcelDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setExcelDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExcelDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setExcelDragging(false);
            const selected = [...event.dataTransfer.files].find((file) => file.name.toLowerCase().endsWith(".xlsx"));
            if (!selected) return setError("Arrastra un archivo Excel con extensión .xlsx.");
            void importExcel(selected);
          }}
        >
          <span className="return-excel-icon"><FileSpreadsheet size={22} /></span>
          <div><strong>Carga masiva de devoluciones</strong><small>Arrastra tu Excel o selecciónalo. Importa hasta 100 líneas con sus fotos incrustadas y permite corregirlas antes de registrar.</small>{excelImportStatus && <><p>{excelImportStatus}</p><div className="return-bulk-preview"><span><b>{bulkPreview.total}</b> filas</span><span className="ready"><b>{bulkPreview.ready}</b> listas</span><span className={bulkPreview.review ? "review" : "ready"}><b>{bulkPreview.review}</b> por revisar</span></div></>}</div>
          <div className="return-excel-actions"><button type="button" className="secondary-button" disabled={Boolean(processingKey)} onClick={() => void downloadBulkTemplate()}><Download size={15} />Descargar plantilla</button><label className={`secondary-button ${processingKey === "excel-import" ? "is-busy" : ""}`}><FileSpreadsheet size={15} />{processingKey === "excel-import" ? `Procesando ${progress}%` : "Seleccionar Excel"}<input type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(processingKey)} onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; void importExcel(selected); }} /></label></div>
          {processingKey === "excel-import" && <div className="return-excel-progress" aria-label={`Importación ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
        </div>
        <div className="return-batch-header">
          <label className="field"><span>Coordinador F1 predeterminado</span><input list="return-f1-coordinators" value={coordinatorF1} onChange={(event) => setCoordinatorF1(event.target.value.toUpperCase())} placeholder="Se usa si la fila viene vacía" /><datalist id="return-f1-coordinators">{f1Coordinators.map((coordinator) => <option value={coordinator.name} key={coordinator.id} />)}</datalist></label>
          <label className="field"><span>Site predeterminado</span><input value={site} onChange={(event) => setSite(event.target.value.toUpperCase())} placeholder="Se usa si la fila no tiene site" /></label>
          <label className="field"><span>Almacén de procedencia</span><input value={warehouse} onChange={(event) => setWarehouse(event.target.value.toUpperCase())} placeholder="RED" /></label>
          <label className="field"><span>Fecha de ingreso *</span><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required /></label>
          <label className="field"><span>N.º Pedido relacionado</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} placeholder="Pedido / código Oracle" /></label>
          <label className="field field-wide"><span>Comentario general</span><input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Referencia de la desinstalación o devolución" /></label>
        </div>
        <datalist id="return-product-options">{products.map((item) => <option value={`${item.sku} — ${item.description}`} key={item.id} />)}</datalist>
        <datalist id="return-condition-options">{conditionOptions.map((condition) => <option value={condition} key={condition} />)}</datalist>

        <div className="return-table-top-scroll" ref={entryTableTopScrollRef} onScroll={(event) => { const target = entryTableScrollRef.current; if (target && target.scrollLeft !== event.currentTarget.scrollLeft) target.scrollLeft = event.currentTarget.scrollLeft; }} aria-label="Desplazamiento horizontal superior de la tabla"><div style={{ width: `${entryTableWidth}px` }} /></div>
        <div className="table-wrap return-entry-table-wrap" ref={entryTableScrollRef} onScroll={(event) => { const target = entryTableTopScrollRef.current; if (target && target.scrollLeft !== event.currentTarget.scrollLeft) target.scrollLeft = event.currentTarget.scrollLeft; }}>
          <table className="return-entry-table" ref={entryTableRef}>
            <thead><tr><th>#</th><th>Site *</th><th>Coordinador F1 *</th><th>Contrata que desmontó *</th><th>Componente</th><th>Subproyecto</th><th>Proyecto origen</th><th>Tarea hardware</th><th>SKU / descripción *</th><th>Serie / Lote *</th><th>Tipo *</th><th>Part number</th><th>Cant.</th><th>Largo</th><th>Condición</th><th>M3</th><th>Observación</th><th>CSV</th><th>Evidencias fotográficas</th><th>Control</th></tr></thead>
            <tbody>{rows.map((row, index) => {
              const product = products.find((item) => item.id === row.productId);
              const effectiveSite = (row.site || site).trim().toUpperCase();
              const effectiveCoordinator = (row.coordinatorF1 || coordinatorF1).trim().toUpperCase();
              const matchedCoordinator = coordinators.find((item) => item.organization === "F1" && normalizeEquipmentIdentifier(item.name) === normalizeEquipmentIdentifier(effectiveCoordinator));
              const matchedSupplier = suppliers.find((item) => item.documentType === "RUC" && item.documentNumber === row.contractorDocument);
              const rowCsv = csvPayload({ item: index + 1, coordinatorF1: effectiveCoordinator, contractorDocument: row.contractorDocument, contractorName: row.contractorName, warehouse, networkComponent: row.networkComponent, subProject: row.subProject, sourceProject: row.sourceProject, hardwareTask: row.hardwareTask, sku: product?.sku || "", serial: row.serial, quantity: row.quantity, condition: row.condition, volumeM3: row.volumeM3, site: effectiveSite });
              return <tr key={row.key}>
                <td className="return-row-number"><strong>{index + 1}</strong></td>
                <td><input className="table-input" aria-label={`Site fila ${index + 1}`} value={row.site} onChange={(event) => updateRow(row.key, { site: event.target.value.toUpperCase() })} placeholder={site || "Código o nombre"} /></td>
                <td><input className="table-input" aria-label={`Coordinador F1 fila ${index + 1}`} list="return-f1-coordinators" value={row.coordinatorF1} onChange={(event) => updateRow(row.key, { coordinatorF1: event.target.value.toUpperCase() })} placeholder={coordinatorF1 || "Seleccionar"} />{effectiveCoordinator && !matchedCoordinator && <span className="return-table-warning"><Plus size={12} />Nuevo: se agregará al maestro F1</span>}{matchedCoordinator && !matchedCoordinator.active && <span className="return-table-warning"><AlertTriangle size={12} />Inactivo: actívalo en Configuración</span>}</td>
                <td className="return-contractor-cell"><input className="table-input" aria-label={`RUC contrata fila ${index + 1}`} inputMode="numeric" maxLength={11} value={row.contractorDocument} onChange={(event) => updateContractorDocument(row, event.target.value)} placeholder="RUC de 11 dígitos" required /><input className="table-input" aria-label={`Razón social contrata fila ${index + 1}`} value={matchedSupplier?.active ? matchedSupplier.businessName : ""} placeholder="Razón social automática" readOnly />{matchedSupplier?.active && <small>Razón social tomada del maestro</small>}{matchedSupplier && !matchedSupplier.active && <span className="return-table-warning"><AlertTriangle size={12} />Proveedor inactivo</span>}{row.contractorDocument.length === 11 && !matchedSupplier && <span className="return-table-warning"><AlertTriangle size={12} />RUC no registrado en Empresas y personas</span>}</td>
                <td><input className="table-input" aria-label={`Componente fila ${index + 1}`} value={row.networkComponent} onChange={(event) => updateRow(row.key, { networkComponent: event.target.value.toUpperCase() })} placeholder="Rack / antena" /></td>
                <td><input className="table-input" aria-label={`Subproyecto fila ${index + 1}`} value={row.subProject} onChange={(event) => updateRow(row.key, { subProject: event.target.value.toUpperCase() })} /></td>
                <td><input className="table-input" aria-label={`Proyecto origen fila ${index + 1}`} value={row.sourceProject} onChange={(event) => updateRow(row.key, { sourceProject: event.target.value.toUpperCase() })} /></td>
                <td><input className="table-input" aria-label={`Tarea hardware fila ${index + 1}`} value={row.hardwareTask} onChange={(event) => updateRow(row.key, { hardwareTask: event.target.value.toUpperCase() })} /></td>
                <td className="return-product-cell"><input className="table-input" aria-label={`SKU o descripción fila ${index + 1}`} list="return-product-options" value={row.productSearch} onChange={(event) => selectProduct(row, event.target.value)} placeholder="Buscar SKU o descripción" required /><strong>{product?.description || "Selecciona del maestro"}</strong><small>{row.productId ? `Coincidencia ${row.matchConfidence}% · ${row.matchMethod.replaceAll("_", " ").toLowerCase()}` : "Pendiente de seleccionar"}</small>{row.warnings.map((warning) => <span className="return-table-warning" key={warning}><AlertTriangle size={12} />{warning}</span>)}</td>
                <td><input className="table-input serial-input" aria-label={`Serie o lote fila ${index + 1}`} value={row.serial} onChange={(event) => updateRow(row.key, { serial: event.target.value.toUpperCase() })} placeholder="Serie única o lote" required /></td>
                <td className="return-item-type-cell"><select className="table-input" aria-label={`Tipo de registro fila ${index + 1}`} value={row.itemType} onChange={(event) => updateRow(row.key, { itemType: event.target.value as DraftRow["itemType"] })}><option value="EQUIPO">Equipo</option><option value="LOTE">Lote</option></select>{row.itemType === "EQUIPO" && row.quantity > 1 && <span className="return-table-warning"><AlertTriangle size={12} />Equipo requiere cantidad 1</span>}{row.itemType === "LOTE" && <small>Cantidad agrupada por lote</small>}</td>
                <td className="return-part-cell"><input className="table-input" aria-label={`Part number fila ${index + 1}`} value={row.partNumber} onChange={(event) => updateRow(row.key, { partNumber: event.target.value.toUpperCase() })} placeholder="Editable" />{row.partNumber && <label><input type="checkbox" checked={row.rememberIdentifier} onChange={(event) => updateRow(row.key, { rememberIdentifier: event.target.checked })} />Recordar PN → SKU</label>}</td>
                <td><input className="table-input numeric-input" aria-label={`Cantidad fila ${index + 1}`} type="number" min={1} value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} required /></td>
                <td><input className="table-input numeric-input" aria-label={`Largo fila ${index + 1}`} value={row.length} onChange={(event) => updateRow(row.key, { length: event.target.value })} placeholder="20" /></td>
                <td className="return-condition-cell"><input className="table-input" aria-label={`Condición fila ${index + 1}`} list="return-condition-options" value={row.condition} onChange={(event) => updateRow(row.key, { condition: event.target.value.toUpperCase() })} /><small>Elige o escribe otra; se guardará al registrar.</small></td>
                <td><input className="table-input numeric-input" aria-label={`Volumen fila ${index + 1}`} value={row.volumeM3} onChange={(event) => updateRow(row.key, { volumeM3: event.target.value })} placeholder="0.32" /></td>
                <td><textarea className="table-input" aria-label={`Observación fila ${index + 1}`} value={row.notes} onChange={(event) => updateRow(row.key, { notes: event.target.value })} rows={3} /></td>
                <td><div className="return-table-csv"><code>{rowCsv}</code><button type="button" className="icon-button" onClick={() => void navigator.clipboard.writeText(rowCsv)} aria-label={`Copiar CSV de fila ${index + 1}`}><Copy size={14} /></button></div></td>
                <td className="return-table-photo-cell"><div className="return-photo-grid">
                  <PhotoBox label="Serie · OCR" preview={row.evidencePreview} busy={processingKey === `${row.key}:serie`} onFile={(file) => void attachPhoto(row, "serie", file)} onError={setError} />
                  <PhotoBox label="Modelo" preview={row.modelPreview} busy={processingKey === `${row.key}:modelo`} onFile={(file) => void attachPhoto(row, "modelo", file)} onError={setError} />
                  <PhotoBox label="Panorámica" preview={row.panoramicPreview} busy={processingKey === `${row.key}:panoramica`} onFile={(file) => void attachPhoto(row, "panoramica", file)} onError={setError} />
                  <PhotoBox label="Etiqueta Entel" preview={row.entelLabelPreview} busy={processingKey === `${row.key}:entel`} onFile={(file) => void attachPhoto(row, "entel", file)} onError={setError} />
                </div><FolderPhotoPicker busy={processingKey.startsWith(`${row.key}:`)} onFiles={(files) => void attachPhotoFolder(row, files)} />{processingKey === `${row.key}:serie` && <div className="ocr-progress"><LoaderCircle className="spin" size={14} />Leyendo SN… {progress}%</div>}</td>
                <td>{rows.length > 1 && <button type="button" className="icon-button danger-text" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} aria-label={`Eliminar fila ${index + 1}`}><Trash2 size={16} /></button>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="return-add-row"><button className="secondary-button" type="button" onClick={() => setRows((current) => [...current, { ...newDraftRow(), site, coordinatorF1 }])}><Plus size={16} />Agregar fila manual</button><small>Las filas seriadas deben mantenerse separadas con su SKU asociado. Cada fila puede tener un site y coordinador diferentes.</small></div>
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
            <label className="field"><span>Condición</span><input list="return-condition-options" value={receipt.condition} onChange={(event) => updateReceipt(record.id, { condition: event.target.value.toUpperCase() })} /><small>Selecciona una guardada o escribe una nueva.</small></label>
            <label className="field"><span>Costo unitario S/</span><input type="number" min="0" step="0.01" value={receipt.unitCost} onChange={(event) => updateReceipt(record.id, { unitCost: event.target.value })} placeholder="Automático si queda vacío" /></label>
            <label className="field"><span>Observación</span><input value={receipt.notes} onChange={(event) => updateReceipt(record.id, { notes: event.target.value })} /></label>
          </div>
        </article>;
      })}</div>
      <div className="receipt-confirm"><span><AlertTriangle size={16} />Esta acción crea los movimientos del Kardex y no puede repetirse.</span><button className="primary-button" disabled={saving} onClick={() => void confirmPhysicalReceipt(receivingGroup)}><PackageCheck size={16} />Confirmar llegada física al almacén</button></div>
    </section>}

    <section className="panel return-history">
      <div className="panel-title"><div><h2>Cargas de devolución</h2><p>Evidencias, exportables y seguimiento desde el envío hasta la recepción física en almacén.</p></div></div>
      <div className="return-batch-list">
        {loading ? <div className="empty"><LoaderCircle className="spin" size={22} /><p>Cargando devoluciones…</p></div> : !batches.length ? <div className="empty"><ImageIcon size={24} /><p>Aún no hay cargas lógicas de devolución.</p></div> : batches.map((batch) => <article className="return-batch-card" key={batch.code}>
          <header><div><span className={`return-status ${batch.status.toLowerCase()}`}>{statusLabel(batch.status)}</span><h3>{batch.code}</h3><p>{batch.site} · {batch.coordinatorF1} · {batch.rows.length} fila(s)</p></div><div className="return-batch-clock"><Clock3 size={15} /><strong>{elapsedLabel(batch.rows[0])}</strong><small>{batch.status === "RECIBIDA_FISICA" ? "Proceso cerrado" : batch.status === "APROBADA_PENDIENTE_RECEPCION" ? transitSlaLabel(transitHours(batch.rows[0])) : "Pendiente de envío"}</small></div></header>
          <div className="return-batch-toolbar">
            <button className="secondary-button" onClick={() => void exportExcel(batch)}><FileSpreadsheet size={15} />Excel</button>
            <button className="secondary-button" onClick={() => exportCsv(batch)}><Download size={15} />CSV</button>
            <button className="secondary-button" onClick={() => void copyCsvColumn(batch)}><Copy size={15} />Copiar columna CSV</button>
            <span>Fecha ingreso: {displayDay(batch.entryDate)} · Registro lógico: {displayDate(batch.createdAt)} · Almacén: {batch.warehouse}</span>
          </div>
          <div className="table-wrap"><table className="return-site-table"><thead><tr><th>Ítem</th><th>Site</th><th>Coordinador F1</th><th>Contrata que desmontó</th><th>SKU / Descripción</th><th>Serie / Lote</th><th>Cant.</th><th>Condición / M3</th><th>CSV</th><th>Evidencias fotográficas</th></tr></thead><tbody>{batch.rows.map((record) => <tr key={record.id}>
            <td><strong>{record.batchItem}</strong></td>
            <td><strong>{record.site}</strong></td>
            <td><strong>{record.coordinatorF1}</strong></td>
            <td><strong>{record.dismantlingContractorName || "—"}</strong><small>{record.dismantlingContractorDocument || "Sin RUC"}</small></td>
            <td><strong>{record.skuSnapshot}</strong><small>{record.descriptionSnapshot}</small></td>
            <td><strong>{record.serial}</strong><small>PN: {record.detectedPartNumber || "—"}</small></td>
            <td><strong>{record.quantity}</strong><small>{record.length ? `Largo: ${record.length}` : ""}</small></td>
            <td><strong>{record.condition}</strong><small>{record.volumeM3 ? `${record.volumeM3} m³` : "Sin volumen"}</small></td>
            <td><button className="text-button csv-copy-button" onClick={() => void navigator.clipboard.writeText(returnExportRows(batch).find((row) => row.ID === record.batchItem)?.CSV || "")}><Copy size={13} />Copiar fila</button></td>
            <td><div className="return-report-photos"><EvidenceThumb label="Serie" src={record.evidenceImage} /><EvidenceThumb label="Modelo" src={record.modelImage} /><EvidenceThumb label="Panorámica" src={record.panoramicImage} /><EvidenceThumb label="Entel" src={record.entelLabelImage} /></div></td>
          </tr>)}</tbody></table></div>
          <footer><div><strong>{batch.orderNumber || "Sin pedido asociado"}</strong><small>{batch.rows[0]?.batchComments || batch.rows[0]?.notes || "Sin observaciones"}</small></div><div className="return-actions">
            {["PENDIENTE_APROBACION", "OBSERVADA"].includes(batch.status) && <button className="secondary-button" disabled={saving} onClick={() => void changeBatchStatus(batch, "APROBADA_PENDIENTE_RECEPCION")}><CheckCircle2 size={14} />Marcar enviado</button>}
            {batch.status === "PENDIENTE_APROBACION" && <button className="text-button warning-text" disabled={saving} onClick={() => void changeBatchStatus(batch, "OBSERVADA")}><AlertTriangle size={14} />Observar</button>}
            {batch.status === "APROBADA_PENDIENTE_RECEPCION" && <button className="primary-button" disabled={saving} onClick={() => beginPhysicalReceipt(batch)}><PackageCheck size={14} />Registrar llegada a almacén</button>}
            {!['RECIBIDA_FISICA', 'RECHAZADA'].includes(batch.status) && <button className="text-button danger-text" disabled={saving} onClick={() => void changeBatchStatus(batch, "RECHAZADA")}><XCircle size={14} />Rechazar</button>}
          </div></footer>
        </article>)}
      </div>
    </section>
  </>;
}

function PhotoBox({ label, preview, busy, onFile, onError }: { label: string; preview: string; busy: boolean; onFile: (file?: File) => void; onError: (message: string) => void }) {
  const [dragging, setDragging] = useState(false);

  function acceptDroppedFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    onFile([...event.dataTransfer.files].find((file) => file.type.startsWith("image/")));
  }

  async function acceptPastedFile(event: ClipboardEvent<HTMLLabelElement>) {
    event.preventDefault();
    try {
      const file = await imageFromClipboardEvent(event) || await imageFromSystemClipboard();
      if (!file) throw new Error("Excel no entregó una imagen compatible.");
      onFile(file);
    } catch {
      onError("No se pudo leer la foto de Excel. Selecciona la imagen dentro de Excel —no solo la celda—, presiona Ctrl+C y luego usa “Pegar desde Excel”.");
    }
  }

  async function pasteFromExcel() {
    try {
      const file = await imageFromSystemClipboard();
      if (!file) throw new Error("No hay una imagen compatible en el portapapeles.");
      onFile(file);
    } catch {
      onError("No se pudo leer la foto de Excel. Selecciona la imagen dentro de Excel —no solo la celda—, presiona Ctrl+C, permite el acceso al portapapeles y vuelve a intentarlo.");
    }
  }

  return <div className="return-photo-slot">
    <label
      className={`return-photo-box ${preview ? "has-photo" : ""} ${dragging ? "is-dragging" : ""}`}
      tabIndex={0}
      aria-label={`${label}. Arrastra una foto, pega con Control V o selecciona un archivo.`}
      onPaste={(event) => void acceptPastedFile(event)}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={acceptDroppedFile}
    >
      {preview ? <Image src={preview} alt={label} width={420} height={260} unoptimized /> : <span><Camera size={18} /><strong>{label}</strong><small>Arrastra · Ctrl+V · clic</small></span>}
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      {busy && <b><LoaderCircle className="spin" size={15} />Cargando…</b>}
    </label>
    <button type="button" className="return-paste-excel" disabled={busy} onClick={() => void pasteFromExcel()}><ClipboardPaste size={12} />Pegar desde Excel</button>
  </div>;
}

function FolderPhotoPicker({ busy, onFiles }: { busy: boolean; onFiles: (files: File[]) => void }) {
  return <label className={`return-folder-picker ${busy ? "is-busy" : ""}`}>
    <FolderOpen size={14} /><span><strong>Seleccionar carpeta</strong><small>Asigna hasta 4 fotos por nombre o por orden.</small></span>
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      {...{ webkitdirectory: "", directory: "" }}
      disabled={busy}
      onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }}
    />
  </label>;
}

function EvidenceThumb({ label, src }: { label: string; src: string }) {
  if (!src) return <span className="return-report-photo empty-photo"><ImageIcon size={15} /><small>{label}</small></span>;
  return <a className="return-report-photo" href={src} target="_blank" rel="noreferrer" title={`Abrir foto ${label}`}><Image src={src} alt={`Foto ${label}`} width={120} height={78} unoptimized /><small>{label}</small></a>;
}
