import { normalizeKardexDate } from "./kardex-date";

export type ReturnExcelPhotoKind = "serie" | "modelo" | "panoramica" | "entel";

export type ReturnExcelPhoto = {
  file: File;
  kind: ReturnExcelPhotoKind;
  archivePath: string;
};

export type ReturnExcelRow = {
  excelRow: number;
  returnDate: string;
  coordinatorF1: string;
  warehouse: string;
  comments: string;
  networkComponent: string;
  subProject: string;
  sourceProject: string;
  hardwareTask: string;
  sku: string;
  description: string;
  serial: string;
  itemType: "EQUIPO" | "LOTE" | "";
  orderNumber: string;
  length: string;
  quantity: number;
  condition: string;
  volumeM3: string;
  site: string;
  notes: string;
  photos: Partial<Record<ReturnExcelPhotoKind, ReturnExcelPhoto>>;
  warnings: string[];
};

export type ReturnExcelImport = {
  sheetName: string;
  rows: ReturnExcelRow[];
};

type ArchiveEntry = {
  content?: unknown;
};

type ArchiveWorkbook = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
  files?: Record<string, ArchiveEntry>;
};

type ImagePlacement = {
  excelRow: number;
  excelColumn: number;
  archivePath: string;
  file: File;
  aspectRatio: number;
};

const RELATIONSHIP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const HEADER_ALIASES = {
  id: ["ID", "ITEM", "FILA"],
  returnDate: ["FECHA", "FECHA DEVOLUCION", "FECHA DE DEVOLUCION", "FECHA DE CARGA"],
  coordinatorF1: ["COORDINADOR REDES", "COORDINADOR F1", "CORD F1", "CORDF1"],
  warehouse: ["ALMACEN", "ALMACÉN"],
  comments: ["COMENTARIOS", "COMENTARIO"],
  networkComponent: ["COMPONENTE", "COMENTARIO APLICA PARA LI EL TIPO DE ESTADO"],
  subProject: ["SUBINVENTARIO", "SUBPROYECTO", "SUB PROYECTO"],
  sourceProject: ["PY ORIGEN", "PROYECTO ORIGEN"],
  hardwareTask: ["TAREA HARDWARE", "TAREA_HARDWARE"],
  sku: ["SKU"],
  description: ["DESCRIPCION", "DESCRIPCIÓN", "DESCRIPCION SKU", "DESCRIPCIÓN SKU"],
  serial: ["SERIE LOTE", "SERIE / LOTE", "SERIE/LOTE", "SERIE", "LOTE"],
  itemType: ["TIPO", "TIPO DE REGISTRO", "TIPO DE EQUIPO", "CONTROL"],
  orderNumber: ["SOLICITUD DE DEVOLUCION", "SOLICITUD DE DEVOLUCIÓN", "N PEDIDO", "N° PEDIDO", "NUMERO DE PEDIDO"],
  length: ["LARGO"],
  quantity: ["CANT", "CANTIDAD"],
  condition: ["CONDICION", "CONDICIÓN"],
  volumeM3: ["MT3", "M3"],
  site: ["SITE", "SITIO"],
  entelPhoto: ["OPIONAL ETIQUETA NEXTEL O ENTEL", "ETIQUETA NEXTEL O ENTEL", "ETIQUETA ENTEL"],
  serialPhoto: ["FOTO DE SERIE LEGIBLE EQUIPO", "FOTO SERIE", "FOTO DE SERIE"],
  modelPhoto: ["FOTO DE MODELO LEGIBLE EQUIPO", "FOTO MODELO", "FOTO DE MODELO"],
  panoramicPhoto: ["FOTO PANORAMICA DE EQUIPOS", "FOTO PANORÁMICA DE EQUIPOS", "FOTO PANORAMICA", "FOTO PANORÁMICA"],
  notes: ["OBSERVIACION", "OBSERVACION", "OBSERVACIÓN"],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[°º]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([key, values]) => [key, values.map(normalizeHeader)]),
) as Record<HeaderKey, string[]>;

function findHeaderRow(matrix: unknown[][]) {
  let best = { rowIndex: -1, score: 0 };
  matrix.slice(0, 20).forEach((row, rowIndex) => {
    const values = row.map(normalizeHeader);
    const score = Object.values(NORMALIZED_ALIASES).filter((aliases) => aliases.some((alias) => values.includes(alias))).length;
    if (score > best.score) best = { rowIndex, score };
  });
  if (best.rowIndex < 0 || best.score < 5) throw new Error("No se encontró una cabecera compatible con el formato de devolución.");
  return best.rowIndex;
}

function headerColumns(row: unknown[]) {
  const columns = {} as Partial<Record<HeaderKey, number>>;
  row.forEach((value, index) => {
    const normalized = normalizeHeader(value);
    (Object.keys(NORMALIZED_ALIASES) as HeaderKey[]).forEach((key) => {
      if (columns[key] === undefined && NORMALIZED_ALIASES[key].includes(normalized)) columns[key] = index;
    });
  });
  return columns;
}

function cell(row: unknown[], columns: Partial<Record<HeaderKey, number>>, key: HeaderKey) {
  const index = columns[key];
  return index === undefined ? "" : clean(row[index]);
}

function positiveQuantity(value: unknown) {
  const quantity = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function parseXml(value: string) {
  const document = new DOMParser().parseFromString(value, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("El archivo contiene una estructura XML que no se pudo leer.");
  return document;
}

function firstByLocalName(parent: ParentNode, name: string) {
  return [...parent.querySelectorAll("*")].find((element) => element.localName === name) ?? null;
}

function directChild(parent: Element, name: string) {
  return [...parent.children].find((element) => element.localName === name) ?? null;
}

function relationships(document: Document, sourcePath: string) {
  const map = new Map<string, string>();
  [...document.querySelectorAll("*")].filter((element) => element.localName === "Relationship").forEach((relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) map.set(id, resolveArchivePath(sourcePath, target));
  });
  return map;
}

function resolveArchivePath(sourcePath: string, target: string) {
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const parts = `${sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1)}${target}`.split("/");
  const resolved: string[] = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  });
  return resolved.join("/");
}

function relationshipPath(sourcePath: string) {
  const separator = sourcePath.lastIndexOf("/");
  const directory = sourcePath.slice(0, separator);
  const fileName = sourcePath.slice(separator + 1);
  return `${directory}/_rels/${fileName}.rels`;
}

function archiveBytes(entry?: ArchiveEntry) {
  const content = entry?.content;
  if (content instanceof Uint8Array) return new Uint8Array(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content.slice(0));
  if (Array.isArray(content)) return Uint8Array.from(content);
  throw new Error("No se pudo extraer una imagen incrustada del Excel.");
}

function archiveText(files: Record<string, ArchiveEntry>, path: string) {
  return new TextDecoder().decode(archiveBytes(files[path]));
}

function mimeType(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/png";
}

async function workbookSheetPath(files: Record<string, ArchiveEntry>, sheetName: string) {
  const workbookPath = "xl/workbook.xml";
  const workbookXml = parseXml(archiveText(files, workbookPath));
  const workbookRels = relationships(parseXml(archiveText(files, relationshipPath(workbookPath))), workbookPath);
  const sheet = [...workbookXml.querySelectorAll("*")].find((element) => element.localName === "sheet" && element.getAttribute("name") === sheetName);
  const relationshipId = sheet?.getAttributeNS(RELATIONSHIP_NS, "id") || sheet?.getAttribute("r:id");
  return relationshipId ? workbookRels.get(relationshipId) ?? "" : "";
}

async function imagePlacements(workbook: ArchiveWorkbook, sheetName: string) {
  const files = workbook.files;
  if (!files) return [];
  const sheetPath = await workbookSheetPath(files, sheetName);
  if (!sheetPath || !files[sheetPath]) return [];
  const sheetXml = parseXml(archiveText(files, sheetPath));
  const sheetRelsPath = relationshipPath(sheetPath);
  if (!files[sheetRelsPath]) return [];
  const sheetRels = relationships(parseXml(archiveText(files, sheetRelsPath)), sheetPath);
  const drawing = firstByLocalName(sheetXml, "drawing");
  const drawingRelationshipId = drawing?.getAttributeNS(RELATIONSHIP_NS, "id") || drawing?.getAttribute("r:id");
  const drawingPath = drawingRelationshipId ? sheetRels.get(drawingRelationshipId) : "";
  if (!drawingPath || !files[drawingPath]) return [];
  const drawingRelsPath = relationshipPath(drawingPath);
  if (!files[drawingRelsPath]) return [];
  const drawingXml = parseXml(archiveText(files, drawingPath));
  const drawingRels = relationships(parseXml(archiveText(files, drawingRelsPath)), drawingPath);
  const placements: ImagePlacement[] = [];

  for (const anchor of [...drawingXml.documentElement.children]) {
    if (!anchor.localName.endsWith("Anchor")) continue;
    const from = directChild(anchor, "from");
    const picture = directChild(anchor, "pic");
    const blip = picture ? firstByLocalName(picture, "blip") : null;
    const relationshipId = blip?.getAttributeNS(RELATIONSHIP_NS, "embed") || blip?.getAttribute("r:embed");
    const archivePath = relationshipId ? drawingRels.get(relationshipId) : "";
    if (!from || !archivePath || !files[archivePath]) continue;
    const row = Number(directChild(from, "row")?.textContent ?? "-1");
    const column = Number(directChild(from, "col")?.textContent ?? "-1");
    if (row < 0 || column < 0) continue;
    const type = mimeType(archivePath);
    const bytes = archiveBytes(files[archivePath]);
    const file = new File([bytes], archivePath.split("/").pop() || `imagen-${placements.length + 1}.png`, { type });
    const bitmap = await createImageBitmap(file);
    const aspectRatio = bitmap.width / Math.max(1, bitmap.height);
    bitmap.close();
    placements.push({ excelRow: row + 1, excelColumn: column + 1, archivePath, file, aspectRatio });
  }
  return placements;
}

function assignPhotos(placements: ImagePlacement[], columns: Partial<Record<HeaderKey, number>>) {
  const photos: Partial<Record<ReturnExcelPhotoKind, ReturnExcelPhoto>> = {};
  const assigned = new Set<ImagePlacement>();
  const excelColumn = (key: HeaderKey) => columns[key] === undefined ? -1 : (columns[key] as number) + 1;
  const byColumn = (key: HeaderKey) => placements.filter((placement) => placement.excelColumn === excelColumn(key));
  const serialCandidates = byColumn("serialPhoto");
  const modelCandidates = byColumn("modelPhoto");
  const panoramicCandidates = byColumn("panoramicPhoto");
  const entelCandidates = byColumn("entelPhoto");

  function assign(kind: ReturnExcelPhotoKind, placement?: ImagePlacement) {
    if (!placement || assigned.has(placement)) return;
    assigned.add(placement);
    photos[kind] = { file: placement.file, kind, archivePath: placement.archivePath };
  }

  if (serialCandidates.length > 1 && !modelCandidates.length) {
    const ordered = serialCandidates.toSorted((left, right) => right.aspectRatio - left.aspectRatio);
    assign("serie", ordered[0]);
    assign("modelo", ordered[1]);
  } else {
    assign("serie", serialCandidates[0]);
    assign("modelo", modelCandidates[0]);
  }
  assign("panoramica", panoramicCandidates[0]);
  assign("entel", entelCandidates[0]);

  const preferredOrder: ReturnExcelPhotoKind[] = ["serie", "modelo", "panoramica", "entel"];
  placements.filter((placement) => !assigned.has(placement)).forEach((placement) => {
    const missing = preferredOrder.find((kind) => !photos[kind]);
    if (missing) assign(missing, placement);
  });
  return photos;
}

export async function parseEquipmentReturnExcel(file: File): Promise<ReturnExcelImport> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Usa el formato Excel .xlsx para conservar las fotografías incrustadas.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, bookFiles: true }) as ArchiveWorkbook;
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El Excel no contiene hojas para importar.");
  const sheet = workbook.Sheets[sheetName] as Parameters<typeof XLSX.utils.sheet_to_json>[0];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const headerRowIndex = findHeaderRow(matrix);
  const columns = headerColumns(matrix[headerRowIndex]);
  const placements = await imagePlacements(workbook, sheetName);
  const placementsByRow = new Map<number, ImagePlacement[]>();
  placements.forEach((placement) => placementsByRow.set(placement.excelRow, [...(placementsByRow.get(placement.excelRow) ?? []), placement]));
  const lastExcelRow = Math.max(matrix.length, ...placements.map((placement) => placement.excelRow));
  const rows: ReturnExcelRow[] = [];

  for (let excelRow = headerRowIndex + 2; excelRow <= lastExcelRow; excelRow += 1) {
    const values = matrix[excelRow - 1] ?? [];
    const rowPlacements = placementsByRow.get(excelRow) ?? [];
    const hasValues = values.some((value) => clean(value));
    if (!hasValues && !rowPlacements.length) continue;
    const id = cell(values, columns, "id");
    const sku = cell(values, columns, "sku");
    const serial = cell(values, columns, "serial");
    const itemTypeValue = normalizeHeader(cell(values, columns, "itemType"));
    const itemType = itemTypeValue.includes("LOTE") ? "LOTE" : itemTypeValue.includes("EQUIPO") || itemTypeValue.includes("SERIE") ? "EQUIPO" : "";
    const site = cell(values, columns, "site");
    if (!id && !sku && !serial && !site && !rowPlacements.length) continue;
    const photos = assignPhotos(rowPlacements, columns);
    const warnings: string[] = [];
    if (!photos.serie) warnings.push("El Excel no incluye una foto de serie en esta fila.");
    if (!photos.modelo) warnings.push("El Excel no incluye una foto de modelo en esta fila.");
    if (!photos.panoramica) warnings.push("El Excel no incluye una foto panorámica en esta fila.");
    rows.push({
      excelRow,
      returnDate: normalizeKardexDate(columns.returnDate === undefined ? "" : values[columns.returnDate]),
      coordinatorF1: cell(values, columns, "coordinatorF1"),
      warehouse: cell(values, columns, "warehouse"),
      comments: cell(values, columns, "comments"),
      networkComponent: cell(values, columns, "networkComponent"),
      subProject: cell(values, columns, "subProject"),
      sourceProject: cell(values, columns, "sourceProject"),
      hardwareTask: cell(values, columns, "hardwareTask"),
      sku,
      description: cell(values, columns, "description"),
      serial,
      itemType,
      orderNumber: cell(values, columns, "orderNumber"),
      length: cell(values, columns, "length"),
      quantity: positiveQuantity(columns.quantity === undefined ? 1 : values[columns.quantity]),
      condition: cell(values, columns, "condition") || "USADO OPERATIVO",
      volumeM3: cell(values, columns, "volumeM3"),
      site,
      notes: cell(values, columns, "notes"),
      photos,
      warnings,
    });
  }
  if (!rows.length) throw new Error("No se encontraron filas de devolución para importar.");
  return { sheetName, rows };
}
