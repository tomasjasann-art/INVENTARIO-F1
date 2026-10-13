export type GrIngresoDetectedRow = {
  sku: string;
  quantity: number;
};

export type GrIngresoRecognition = {
  movementDate: string;
  document: string;
  orderNumber: string;
  rows: GrIngresoDetectedRow[];
  warnings: string[];
};

type RecognitionInput = {
  fullText: string;
  headerText?: string;
  quantityText?: string;
  fileName?: string;
};

const SKU_PATTERN = /\b[A-Z]{2,6}[A-Z0-9-]*\d{5,14}\b/g;

function normalizeOcr(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|_]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .toUpperCase();
}

function isoDate(value: string) {
  const cleaned = value.replace(/[.]/g, "/");
  const iso = cleaned.match(/\b(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = cleaned.match(/\b([0-3]?\d)[-/]([01]?\d)[-/](20\d{2})\b/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
}

function dateFromText(text: string) {
  const labelled = text.match(/FECHA\s+(?:DE\s+)?(?:EMISION|INGRESO|RECEPCION)[^\d]{0,25}((?:20\d{2}[-/.][01]?\d[-/.][0-3]?\d)|(?:[0-3]?\d[-/.][01]?\d[-/.]20\d{2}))/);
  return isoDate(labelled?.[1] ?? text);
}

function documentFromText(text: string) {
  const labelled = text.match(/(?:GUIA\s+DE\s+REMISION[\s\S]{0,100}?)\b([A-Z]{1,4}\d{1,5})\s*(?:N(?:RO|O)?\s*[°º.]?)?\s*(\d{4,12})\b/);
  const generic = text.match(/\b([A-Z]{1,4}\d{1,5})\s*(?:N(?:RO|O)?\s*[°º.]?)\s*(\d{4,12})\b/);
  const match = labelled ?? generic;
  return match ? `${match[1]}-${match[2]}` : "";
}

function orderFromText(text: string) {
  const match = text.match(/(?:N(?:RO|O)?\.?|NUMERO|N[°º])?\s*(?:DE\s+)?(?:ORDEN\s+DE\s+VENTA|PEDIDO|ORDEN\s+DE\s+COMPRA|COD\.?\s*ORACLE)\s*[:#-]?\s*([A-Z0-9-]{5,20})/);
  return match?.[1]?.replace(/[^A-Z0-9-]/g, "") ?? "";
}

function valuesFromFileName(fileName: string) {
  const name = normalizeOcr(fileName.replace(/\.[^.]+$/, ""));
  const document = name.match(/\b([A-Z]{1,4}\d{1,5})[-_ ]+(\d{4,12})\b/);
  const numberTokens = [...name.matchAll(/\b\d{5,14}\b/g)].map((match) => match[0]);
  const documentNumber = document?.[2] ?? "";
  const orderNumber = numberTokens.findLast((token) => token !== documentNumber) ?? "";
  return {
    document: document ? `${document[1]}-${document[2]}` : "",
    orderNumber,
  };
}

function skuValues(text: string) {
  const matches = normalizeOcr(text).match(SKU_PATTERN) ?? [];
  return [...new Set(matches
    .map((value) => value.replace(/[.,;:]$/, ""))
    .filter((value) => !/^(?:RUC|SUNAT|GUIA|FECHA|TOTAL)/.test(value)))];
}

function quantityValues(text: string) {
  const normalized = normalizeOcr(text);
  const afterHeader = normalized.includes("CANTIDAD") ? normalized.split("CANTIDAD").slice(1).join(" ") : normalized;
  return afterHeader
    .split(/\r?\n/)
    .flatMap((line) => line.match(/\b\d{1,7}\b/g) ?? [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0 && value < 10_000_000 && value < 1900);
}

export function parseGrIngresoRecognition({ fullText, headerText = "", quantityText = "", fileName = "" }: RecognitionInput): GrIngresoRecognition {
  const full = normalizeOcr(fullText);
  const header = normalizeOcr(headerText);
  const fileValues = valuesFromFileName(fileName);
  const movementDate = dateFromText(full);
  const document = fileValues.document || documentFromText(`${header}\n${full}`);
  const orderNumber = fileValues.orderNumber || orderFromText(full);
  const skus = skuValues(full);
  const quantities = quantityValues(quantityText);
  const warnings: string[] = [];

  if (!movementDate) warnings.push("No se detectó la fecha de ingreso.");
  if (!document) warnings.push("No se detectó el número de GR.");
  if (!orderNumber) warnings.push("No se detectó el N° Pedido.");
  if (!skus.length) warnings.push("No se detectaron SKU.");
  if (!quantities.length) warnings.push("No se detectó la cantidad; se colocó 1 para revisión.");
  if (skus.length > 1 && quantities.length !== skus.length) warnings.push("La cantidad de SKU y cantidades no coincide; revisa cada línea.");

  return {
    movementDate,
    document,
    orderNumber,
    rows: (skus.length ? skus : [""]).map((sku, index) => ({
      sku,
      quantity: quantities[index] ?? (quantities.length === 1 && skus.length === 1 ? quantities[0] : 1),
    })),
    warnings,
  };
}
