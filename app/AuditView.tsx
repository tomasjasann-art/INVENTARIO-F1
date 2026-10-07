"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Search,
  Upload,
} from "lucide-react";
import { DragEvent, useMemo, useState } from "react";

export type AuditImportRow = {
  id: number;
  source: "ENTEL" | "ORACLE";
  fileName: string;
  sheetName: string;
  contractor: string;
  cutoffDate: string;
  rawRowCount: number;
  normalizedRowCount: number;
  totalQuantity: number;
  totalCostCents: number;
  status: "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
};

export type AuditRecord = {
  id: number;
  importId: number;
  source: "ENTEL" | "ORACLE";
  sourceKey: string;
  contractor: string;
  sku: string;
  description: string;
  seriesLot: string;
  quantity: number;
  unitMeasure: string;
  equipmentType: string;
  subinventory: string;
  projectCode: string;
  project: string;
  purchaseOrder: string;
  task: string;
  requester: string;
  site: string;
  totalCostCents: number;
  warehouseEntryDate: string;
  receiptDate: string;
  orderNumber: string;
  ageMonths: number;
  ageBucket: string;
  category: string;
  createdAt: string;
};

type MovementForAudit = {
  sku: string;
  serials: string;
  quantity: number;
  type: "entrada" | "salida" | "devolucion" | "traslado" | "regularizacion" | "baja" | "ajuste";
};

type UploadRecord = Omit<AuditRecord, "id" | "importId" | "source" | "totalCostCents" | "createdAt"> & {
  totalCost: number;
};

type AuditPreview = {
  source: "ENTEL" | "ORACLE";
  fileName: string;
  sheetName: string;
  cutoffDate: string;
  contractor: string;
  rawRowCount: number;
  rows: UploadRecord[];
  totalQuantity: number;
  totalCost: number;
};

type Props = {
  imports: AuditImportRow[];
  records: AuditRecord[];
  movements: MovementForAudit[];
  loading: boolean;
  saving: boolean;
  onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
};

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const number = new Intl.NumberFormat("es-PE");
const AGE_BUCKETS = ["Menor a 6 meses", "Mayor a 6 meses", "Mayor a 1 año"] as const;

function clean(value: unknown) {
  const raw = String(value ?? "").trim();
  const formulaText = raw.match(/^="(.*)"$/);
  return (formulaText?.[1] ?? raw).trim();
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function rowValue(row: Record<string, unknown>, ...names: string[]) {
  const wanted = new Set(names.map(normalizeHeader));
  const item = Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)));
  return item?.[1];
}

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = clean(value).replace(/S\/?\.?/gi, "").replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  return Number(text) || 0;
}

function isoDate(value: unknown, xlsx?: typeof import("xlsx")) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && xlsx) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : "";
}

function normalizeAgeBucket(value: unknown, months: number) {
  const text = normalizeHeader(clean(value));
  if (text.includes("2 ano")) return "Mayor a 1 año";
  if (text.includes("1 ano")) return "Mayor a 1 año";
  if (text.includes("mayor") && text.includes("6 mes")) return "Mayor a 6 meses";
  if (text.includes("menor") || text.includes("igual 5")) return "Menor a 6 meses";
  if (months > 12) return "Mayor a 1 año";
  if (months > 6) return "Mayor a 6 meses";
  return "Menor a 6 meses";
}

function auditAgeBucket(value: string) {
  return value === "Mayor a 2 años" ? "Mayor a 1 año" : value;
}

function mergeText(current: string, next: string) {
  if (!next || current === next) return current || next;
  const values = current.split(" · ");
  if (values.includes(next)) return current;
  return [...values, next].slice(0, 3).join(" · ");
}

function worseAge(current: string, next: string) {
  const rank = new Map<string, number>(AGE_BUCKETS.map((bucket, index) => [bucket, index]));
  return (rank.get(next) ?? 0) > (rank.get(current) ?? 0) ? next : current;
}

function aggregate(rows: UploadRecord[]) {
  const grouped = new Map<string, UploadRecord>();
  rows.forEach((row) => {
    const key = `${row.sku.toUpperCase()}::${row.seriesLot.toUpperCase()}`;
    const previous = grouped.get(key);
    if (!previous) {
      grouped.set(key, { ...row, sourceKey: key });
      return;
    }
    grouped.set(key, {
      ...previous,
      quantity: previous.quantity + row.quantity,
      totalCost: previous.totalCost + row.totalCost,
      projectCode: mergeText(previous.projectCode, row.projectCode),
      project: mergeText(previous.project, row.project),
      purchaseOrder: mergeText(previous.purchaseOrder, row.purchaseOrder),
      site: mergeText(previous.site, row.site),
      orderNumber: mergeText(previous.orderNumber, row.orderNumber),
      ageMonths: Math.max(previous.ageMonths, row.ageMonths),
      ageBucket: worseAge(previous.ageBucket, row.ageBucket),
      category: mergeText(previous.category, row.category),
    });
  });
  return [...grouped.values()];
}

async function parseEntel(file: File): Promise<AuditPreview> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const bookIndex = XLSX.read(buffer, { type: "array", bookSheets: true });
  const sheetName = bookIndex.SheetNames.find((name) => /^Matriz_/i.test(name))
    ?? bookIndex.SheetNames.find((name) => normalizeHeader(name).includes("matriz"));
  if (!sheetName) throw new Error("No se encontró la hoja Matriz del Stock Contrata Entel.");

  const workbook = XLSX.read(buffer, { type: "array", sheets: [sheetName], cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"]) throw new Error("La hoja Matriz está vacía.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  let headerRow = -1;
  for (let rowIndex = range.s.r; rowIndex <= Math.min(range.e.r, range.s.r + 24); rowIndex += 1) {
    const values: string[] = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      values.push(normalizeHeader(clean(sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]?.v)));
    }
    if (values.includes("sku") && values.includes("serie/lote") && values.includes("contrata abrev.")) {
      headerRow = rowIndex;
      break;
    }
  }
  if (headerRow < 0) throw new Error("No se encontraron las cabeceras SKU, Serie/Lote y Contrata Abrev. en la Matriz.");

  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRow, defval: "", raw: true });
  const f1Rows = sourceRows.filter((row) => {
    const abbreviated = clean(rowValue(row, "Contrata Abrev."));
    const full = clean(rowValue(row, "Contrata"));
    return normalizeHeader(abbreviated) === "f1 services" || normalizeHeader(full).includes("f1 services");
  });
  const records = f1Rows.map((row) => {
    const sku = clean(rowValue(row, "SKU")).toUpperCase();
    const seriesLot = clean(rowValue(row, "Serie/Lote")).toUpperCase();
    const ageMonths = Math.max(0, Math.round(numeric(rowValue(row, "Meses en Contrata"))));
    return {
      sourceKey: `${sku}::${seriesLot}`,
      contractor: clean(rowValue(row, "Contrata")) || "F1 SERVICES",
      sku,
      description: clean(rowValue(row, "Descripción")),
      seriesLot,
      quantity: Math.max(0, Math.round(numeric(rowValue(row, "Cantidad")))),
      unitMeasure: "UND",
      equipmentType: clean(rowValue(row, "Tipo de Equipo")),
      subinventory: clean(rowValue(row, "SUBINVENTARIO")),
      projectCode: clean(rowValue(row, "Código Proyecto")),
      project: clean(rowValue(row, "Proyecto")),
      purchaseOrder: clean(rowValue(row, "#Orden de Compra")),
      task: clean(rowValue(row, "Tarea")),
      requester: clean(rowValue(row, "Usuario Pedido")),
      site: clean(rowValue(row, "Sitio", "Sitio Asignado", "Sitio - Reservado")),
      totalCost: Math.max(0, numeric(rowValue(row, "Monto Total Soles", "Monto Total", "Costo Total", "Valor Total Soles", "Valor Total"))),
      warehouseEntryDate: isoDate(rowValue(row, "F. Ingreso Almacén"), XLSX),
      receiptDate: isoDate(rowValue(row, "F. Recepción"), XLSX),
      orderNumber: clean(rowValue(row, "Nro Pedido")),
      ageMonths,
      ageBucket: normalizeAgeBucket(rowValue(row, "KPI 2 Permanencia Contrata"), ageMonths),
      category: clean(rowValue(row, "Categoria Final", "Categoría Final")) || "Sin categoría",
    } satisfies UploadRecord;
  }).filter((row) => row.sku && row.seriesLot);
  const rows = aggregate(records);
  const cutoff = sheetName.match(/(\d{4})_(\d{2})_(\d{2})/);
  return {
    source: "ENTEL",
    fileName: file.name,
    sheetName,
    cutoffDate: cutoff ? `${cutoff[1]}-${cutoff[2]}-${cutoff[3]}` : "",
    contractor: "F1 SERVICES & SOLUTIONS S.A.C._20565431634",
    rawRowCount: f1Rows.length,
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalCost: rows.reduce((sum, row) => sum + row.totalCost, 0),
  };
}

async function parseOracle(file: File): Promise<AuditPreview> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
  const sheetName = workbook.SheetNames[0];
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "", raw: true });
  const f1Rows = sourceRows.filter((row) => normalizeHeader(clean(rowValue(row, "Contratista"))).includes("f1 services"));
  const records = f1Rows.map((row) => {
    const sku = clean(rowValue(row, "Sku", "SKU")).toUpperCase();
    const seriesLot = clean(rowValue(row, "Serie / Lote", "Serie/Lote")).toUpperCase();
    return {
      sourceKey: `${sku}::${seriesLot}`,
      contractor: clean(rowValue(row, "Contratista")) || "F1 SERVICES",
      sku,
      description: clean(rowValue(row, "Descripción SKU", "Descripción")),
      seriesLot,
      quantity: Math.max(0, Math.round(numeric(rowValue(row, "Cantidad")))),
      unitMeasure: clean(rowValue(row, "Unidad de Medida")) || "UND",
      equipmentType: "",
      subinventory: clean(rowValue(row, "Sub inventario", "Subinventario")),
      projectCode: clean(rowValue(row, "Cod.Proyecto", "Código Proyecto")),
      project: clean(rowValue(row, "Proyecto")),
      purchaseOrder: clean(rowValue(row, "Nro OC", "#Orden de Compra")),
      task: clean(rowValue(row, "Cod.Tarea", "Tarea")),
      requester: clean(rowValue(row, "Solicitante")),
      site: "",
      totalCost: 0,
      warehouseEntryDate: "",
      receiptDate: "",
      orderNumber: "",
      ageMonths: 0,
      ageBucket: "Sin antigüedad",
      category: clean(rowValue(row, "Comentario")) || "Sin categoría",
    } satisfies UploadRecord;
  }).filter((row) => row.sku && row.seriesLot);
  const rows = aggregate(records);
  return {
    source: "ORACLE",
    fileName: file.name,
    sheetName,
    cutoffDate: "",
    contractor: "F1 SERVICES & SOLUTIONS S.A.C._20565431634",
    rawRowCount: f1Rows.length,
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalCost: 0,
  };
}

function displayDate(value: string) {
  if (!value) return "Sin fecha de corte";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export default function AuditView({ imports, records, movements, loading, saving, onSave }: Props) {
  const [preview, setPreview] = useState<Partial<Record<"ENTEL" | "ORACLE", AuditPreview>>>({});
  const [parsing, setParsing] = useState<"ENTEL" | "ORACLE" | "">("");
  const [dragging, setDragging] = useState<"ENTEL" | "ORACLE" | "">("");
  const [localError, setLocalError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [age, setAge] = useState("TODAS");

  const latestEntel = imports.find((item) => item.source === "ENTEL");
  const latestOracle = imports.find((item) => item.source === "ORACLE");
  const entelRows = useMemo(() => records.filter((row) => row.source === "ENTEL"), [records]);
  const oracleRows = useMemo(() => records.filter((row) => row.source === "ORACLE"), [records]);

  const kardexStock = useMemo(() => {
    const map = new Map<string, number>();
    movements.forEach((movement) => {
      const serials = movement.serials.split(/[,;\n]/).map((item) => item.trim().toUpperCase()).filter(Boolean);
      if (!serials.length) return;
      const sign = movement.type === "salida" || movement.type === "baja" ? -1 : movement.type === "traslado" ? 0 : 1;
      const quantity = serials.length > 1 ? 1 : movement.quantity;
      serials.forEach((serial) => {
        const key = `${movement.sku.toUpperCase()}::${serial}`;
        map.set(key, (map.get(key) ?? 0) + sign * quantity);
      });
    });
    return map;
  }, [movements]);

  const comparison = useMemo(() => {
    const entelMap = new Map(entelRows.map((row) => [row.sourceKey, row]));
    const oracleMap = new Map(oracleRows.map((row) => [row.sourceKey, row]));
    return [...new Set([...entelMap.keys(), ...oracleMap.keys()])].map((key) => {
      const entel = entelMap.get(key);
      const oracle = oracleMap.get(key);
      const entelQuantity = entel?.quantity ?? 0;
      const oracleQuantity = oracle?.quantity ?? 0;
      const rowStatus = entel && oracle
        ? entelQuantity === oracleQuantity ? "Coincide" : "Diferencia cantidad"
        : entel ? "Solo Entel" : "Solo Oracle";
      const expected = oracleQuantity || entelQuantity;
      const f1Quantity = kardexStock.get(key) ?? 0;
      return {
        key,
        sku: entel?.sku ?? oracle?.sku ?? "",
        description: entel?.description ?? oracle?.description ?? "",
        seriesLot: entel?.seriesLot ?? oracle?.seriesLot ?? "",
        entelQuantity,
        oracleQuantity,
        f1Quantity,
        delta: oracleQuantity - entelQuantity,
        status: rowStatus,
        f1Status: f1Quantity === expected ? "Coincide F1" : f1Quantity === 0 ? "Sin registro F1" : "Diferencia F1",
        costCents: entel?.totalCostCents ?? 0,
        ageBucket: auditAgeBucket(entel?.ageBucket ?? "Sin antigüedad"),
        ageMonths: entel?.ageMonths ?? 0,
        category: entel?.category ?? "Solo Oracle",
        project: entel?.project ?? oracle?.project ?? "",
        orderNumber: entel?.orderNumber ?? "",
        requester: entel?.requester ?? oracle?.requester ?? "",
      };
    }).sort((a, b) => {
      const order = { "Diferencia cantidad": 0, "Solo Entel": 1, "Solo Oracle": 2, Coincide: 3 } as Record<string, number>;
      return order[a.status] - order[b.status] || b.costCents - a.costCents;
    });
  }, [entelRows, oracleRows, kardexStock]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return comparison.filter((row) =>
      (status === "TODOS" || row.status === status)
      && (age === "TODAS" || row.ageBucket === age)
      && (!normalized || [row.sku, row.description, row.seriesLot, row.project, row.orderNumber, row.requester, row.category].join(" ").toLowerCase().includes(normalized)),
    );
  }, [comparison, query, status, age]);

  const ageTotals = useMemo(() => AGE_BUCKETS.map((bucket) => {
    const matches = entelRows.filter((row) => auditAgeBucket(row.ageBucket) === bucket);
    return {
      bucket,
      items: matches.length,
      quantity: matches.reduce((sum, row) => sum + row.quantity, 0),
      costCents: matches.reduce((sum, row) => sum + row.totalCostCents, 0),
    };
  }), [entelRows]);

  const categoryTotals = useMemo(() => {
    const grouped = new Map<string, { quantity: number; costCents: number }>();
    entelRows.forEach((row) => {
      const current = grouped.get(row.category) ?? { quantity: 0, costCents: 0 };
      current.quantity += row.quantity;
      current.costCents += row.totalCostCents;
      grouped.set(row.category, current);
    });
    return [...grouped.entries()].sort((a, b) => b[1].costCents - a[1].costCents);
  }, [entelRows]);

  async function handleFile(source: "ENTEL" | "ORACLE", file?: File) {
    if (!file) return;
    setLocalError("");
    const lower = file.name.toLowerCase();
    if (source === "ENTEL" && !lower.endsWith(".xlsx")) {
      setLocalError("Stock Contrata debe cargarse en formato .xlsx.");
      return;
    }
    if (source === "ORACLE" && !lower.endsWith(".csv")) {
      setLocalError("El export de Oracle debe cargarse en formato .csv.");
      return;
    }
    setParsing(source);
    try {
      const result = source === "ENTEL" ? await parseEntel(file) : await parseOracle(file);
      if (!result.rows.length) throw new Error("El archivo no contiene filas de F1 SERVICES con SKU y Serie/Lote.");
      setPreview((current) => ({ ...current, [source]: result }));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    } finally {
      setParsing("");
    }
  }

  function drop(source: "ENTEL" | "ORACLE", event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging("");
    void handleFile(source, event.dataTransfer.files?.[0]);
  }

  async function importPreview(source: "ENTEL" | "ORACLE") {
    const item = preview[source];
    if (!item) return;
    const ok = await onSave({
      action: "auditImport",
      source: item.source,
      fileName: item.fileName,
      sheetName: item.sheetName,
      contractor: item.contractor,
      cutoffDate: item.cutoffDate,
      rawRowCount: item.rawRowCount,
      rows: item.rows,
    }, `${source === "ENTEL" ? "Stock Contrata Entel" : "Export Oracle"} cargado correctamente.`);
    if (ok) setPreview((current) => ({ ...current, [source]: undefined }));
  }

  function exportDifferences() {
    const rows = filteredRows;
    const header = ["Estado", "SKU", "Serie/Lote", "Cantidad Entel", "Cantidad Oracle", "Diferencia", "Stock F1", "Control F1", "KPI antigüedad", "Costo Entel", "Categoría", "Proyecto", "N° Pedido"];
    const data = rows.map((row) => [row.status, row.sku, row.seriesLot, row.entelQuantity, row.oracleQuantity, row.delta, row.f1Quantity, row.f1Status, row.ageBucket, row.costCents / 100, row.category, row.project, row.orderNumber]);
    const csv = [header, ...data].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-filtrada-entel-oracle-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const matched = comparison.filter((row) => row.status === "Coincide").length;
  const different = comparison.filter((row) => row.status === "Diferencia cantidad").length;
  const onlyEntel = comparison.filter((row) => row.status === "Solo Entel").length;
  const onlyOracle = comparison.filter((row) => row.status === "Solo Oracle").length;

  return <>
    <section className="audit-source-grid">
      <AuditUploadCard source="ENTEL" title="Stock Contrata Entel" subtitle="Se toma únicamente F1 SERVICES desde la hoja Matriz." accept=".xlsx" latest={latestEntel} preview={preview.ENTEL} parsing={parsing === "ENTEL"} dragging={dragging === "ENTEL"} saving={saving} onFile={(file) => void handleFile("ENTEL", file)} onDrop={(event) => drop("ENTEL", event)} onDrag={(active) => setDragging(active ? "ENTEL" : "")} onImport={() => void importPreview("ENTEL")} />
      <AuditUploadCard source="ORACLE" title="Export de Oracle" subtitle="Valida el stock que Oracle mantiene asignado a F1." accept=".csv" latest={latestOracle} preview={preview.ORACLE} parsing={parsing === "ORACLE"} dragging={dragging === "ORACLE"} saving={saving} onFile={(file) => void handleFile("ORACLE", file)} onDrop={(event) => drop("ORACLE", event)} onDrag={(active) => setDragging(active ? "ORACLE" : "")} onImport={() => void importPreview("ORACLE")} />
    </section>

    {localError && <div className="error-banner"><AlertTriangle size={18} /><span>{localError}</span><button onClick={() => setLocalError("")} aria-label="Cerrar error">×</button></div>}

    <section className="audit-kpi-grid">
      <article className="audit-total-card"><small>COBRO TOTAL ENTEL · F1</small><strong>{money.format((latestEntel?.totalCostCents ?? 0) / 100)}</strong><span>{number.format(latestEntel?.totalQuantity ?? 0)} unidades · {number.format(latestEntel?.normalizedRowCount ?? 0)} combinaciones</span></article>
      {ageTotals.map((item, index) => <article className={`audit-age-card age-${index}`} key={item.bucket}><small>{item.bucket.toUpperCase()}</small><strong>{money.format(item.costCents / 100)}</strong><span>{number.format(item.quantity)} unidades · {number.format(item.items)} series/lotes</span></article>)}
    </section>

    <section className="panel audit-reconcile-panel">
      <div className="panel-title"><div><h2>Cruce Entel vs Oracle vs Kardex F1</h2><p>El costo se toma de “Monto Total Soles” del último Stock Contrata; el KPI de “KPI 2 Permanencia Contrata” y “Meses en Contrata”.</p></div><button className="secondary-button" onClick={exportDifferences} disabled={!filteredRows.length}><Download size={16} />Exportar filtrados</button></div>
      <div className="audit-match-metrics">
        <span className="match"><b>{number.format(matched)}</b> coinciden</span>
        <span className="difference"><b>{number.format(different)}</b> con diferencia</span>
        <span className="entel"><b>{number.format(onlyEntel)}</b> solo Entel</span>
        <span className="oracle"><b>{number.format(onlyOracle)}</b> solo Oracle</span>
      </div>
      <div className="audit-filters">
        <label className="field"><span>Buscar</span><div className="audit-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SKU, serie/lote, proyecto, pedido o solicitante..." /></div></label>
        <label className="field"><span>Resultado del cruce</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="TODOS">Todos</option><option>Coincide</option><option>Diferencia cantidad</option><option>Solo Entel</option><option>Solo Oracle</option></select></label>
        <label className="field"><span>KPI de antigüedad</span><select value={age} onChange={(event) => setAge(event.target.value)}><option value="TODAS">Todas</option>{AGE_BUCKETS.map((bucket) => <option key={bucket}>{bucket}</option>)}</select></label>
        <div className="audit-filter-result"><strong>{number.format(filteredRows.length)}</strong><small>resultados visibles</small></div>
      </div>
      <div className="table-wrap audit-table-wrap"><table className="audit-table"><thead><tr><th>Resultado</th><th>SKU / Equipo</th><th>Serie / Lote</th><th>Entel</th><th>Oracle</th><th>Diferencia</th><th>Kardex F1</th><th>KPI antigüedad</th><th className="align-right">Costo Entel</th><th>Categoría / Proyecto</th></tr></thead><tbody>{loading ? <tr><td colSpan={10}><div className="audit-empty">Cargando cortes de auditoría...</div></td></tr> : !latestEntel || !latestOracle ? <tr><td colSpan={10}><div className="audit-empty">Carga ambos archivos para generar el cruce Entel–Oracle.</div></td></tr> : !filteredRows.length ? <tr><td colSpan={10}><div className="audit-empty">No hay resultados para los filtros seleccionados.</div></td></tr> : filteredRows.slice(0, 750).map((row) => <tr key={row.key}><td><span className={`audit-status ${row.status === "Coincide" ? "match" : row.status === "Diferencia cantidad" ? "difference" : row.status === "Solo Entel" ? "entel" : "oracle"}`}>{row.status}</span></td><td><strong>{row.sku}</strong><small>{row.description}</small></td><td><strong>{row.seriesLot}</strong><small>{row.orderNumber || row.requester || "Sin pedido"}</small></td><td><strong>{number.format(row.entelQuantity)}</strong><small>unidades</small></td><td><strong>{number.format(row.oracleQuantity)}</strong><small>unidades</small></td><td><strong className={row.delta === 0 ? "positive" : "negative"}>{row.delta > 0 ? "+" : ""}{number.format(row.delta)}</strong></td><td><strong>{number.format(row.f1Quantity)}</strong><small className={row.f1Status === "Coincide F1" ? "positive" : "negative"}>{row.f1Status}</small></td><td><strong>{row.ageBucket}</strong><small>{row.ageMonths ? `${row.ageMonths} meses` : "Solo Oracle"}</small></td><td className="align-right"><strong>{money.format(row.costCents / 100)}</strong></td><td><strong>{row.category}</strong><small>{row.project || "Sin proyecto"}</small></td></tr>)}</tbody></table></div>
      {filteredRows.length > 750 && <p className="audit-limit-note">Se muestran los primeros 750 resultados. Usa los filtros o exporta las diferencias para revisar el detalle completo.</p>}
    </section>

    <section className="panel audit-category-panel">
      <div className="panel-title"><div><h2>Cobro Entel por categoría final</h2><p>Distribución del último Stock Contrata cargado para F1.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Categoría final</th><th className="align-right">Series/Lotes</th><th className="align-right">Cantidad</th><th className="align-right">Costo</th></tr></thead><tbody>{!categoryTotals.length ? <tr><td colSpan={4}><div className="audit-empty">Carga el Stock Contrata para ver las categorías.</div></td></tr> : categoryTotals.map(([category, total]) => <tr key={category}><td><strong>{category}</strong></td><td className="align-right">{number.format(entelRows.filter((row) => row.category === category).length)}</td><td className="align-right">{number.format(total.quantity)}</td><td className="align-right"><strong>{money.format(total.costCents / 100)}</strong></td></tr>)}</tbody></table></div>
    </section>
  </>;
}

function AuditUploadCard({ source, title, subtitle, accept, latest, preview, parsing, dragging, saving, onFile, onDrop, onDrag, onImport }: {
  source: "ENTEL" | "ORACLE";
  title: string;
  subtitle: string;
  accept: string;
  latest?: AuditImportRow;
  preview?: AuditPreview;
  parsing: boolean;
  dragging: boolean;
  saving: boolean;
  onFile: (file?: File) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onDrag: (active: boolean) => void;
  onImport: () => void;
}) {
  return <article className="panel audit-source-card">
    <div className="audit-source-head"><span><FileSpreadsheet size={21} /></span><div><small>{source}</small><h2>{title}</h2><p>{subtitle}</p></div>{latest && <CheckCircle2 size={20} className="audit-source-ready" />}</div>
    <label className={`audit-drop-zone ${dragging ? "drag-active" : ""}`} onDragOver={(event) => { event.preventDefault(); onDrag(true); }} onDragLeave={() => onDrag(false)} onDrop={onDrop}>
      <input type="file" accept={accept} onChange={(event) => onFile(event.target.files?.[0])} />
      {parsing ? <LoaderCircle size={25} className="spin" /> : <Upload size={24} />}
      <strong>{parsing ? "Leyendo y consolidando filas F1..." : `Arrastra ${accept} o haz clic para seleccionar`}</strong>
      <span>El archivo original no se modifica.</span>
    </label>
    {preview ? <div className="audit-preview-box"><div><strong>{preview.fileName}</strong><small>{number.format(preview.rawRowCount)} líneas F1 → {number.format(preview.rows.length)} combinaciones únicas</small><small>{number.format(preview.totalQuantity)} unidades{source === "ENTEL" ? ` · ${money.format(preview.totalCost)}` : ""}</small></div><button className="primary-button" disabled={saving} onClick={onImport}>{saving ? "Guardando..." : "Confirmar carga"}</button></div> : latest ? <div className="audit-latest"><div><small>ÚLTIMO CORTE</small><strong>{latest.fileName}</strong><span>{displayDate(latest.cutoffDate || latest.createdAt)} · {number.format(latest.rawRowCount)} líneas F1</span></div><div><small>CONSOLIDADO</small><strong>{number.format(latest.totalQuantity)} unidades</strong><span>{number.format(latest.normalizedRowCount)} SKU + Serie/Lote{source === "ENTEL" ? ` · ${money.format(latest.totalCostCents / 100)}` : ""}</span></div></div> : <p className="audit-no-source">Todavía no hay un corte {source} cargado.</p>}
  </article>;
}
