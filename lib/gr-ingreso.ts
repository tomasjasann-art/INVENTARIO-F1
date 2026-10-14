export type GrIngresoDetectedRow = {
  sku: string;
  quantity: number;
  seriesLot: string;
};

export type GrIngresoRecognition = {
  movementDate: string;
  document: string;
  orderNumber: string;
  rows: GrIngresoDetectedRow[];
  warnings: string[];
};

export type GrLayoutPage = {
  tsv: string;
  width: number;
  height: number;
};

type KnownProduct = {
  sku: string;
  category: string;
};

type RecognitionInput = {
  fullText: string;
  headerText?: string;
  quantityText?: string;
  fileName?: string;
  layoutPages?: GrLayoutPage[];
  knownProducts?: KnownProduct[];
};

type OcrWord = {
  lineKey: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
};

type OcrLine = {
  top: number;
  bottom: number;
  words: OcrWord[];
  text: string;
};

type LayoutItem = {
  sku: string;
  quantity: number;
  series: string[];
};

const ENT_SKU_PATTERN = /\b(?:ENT|SKU)[A-Z0-9-]{5,20}\b/g;
const GENERIC_SKU_PATTERN = /\b[A-Z]{2,6}[A-Z0-9-]*\d{5,14}\b/g;
const STOP_TABLE_PATTERN = /PESO\s+BRUTO|CONFORME|OBSERVACION|TRANSPORTISTA|REPRESENTACION\s+IMPRESA/;

function normalizeOcr(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|_]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .toUpperCase();
}

export function normalizeSkuKey(value: string) {
  return normalizeOcr(value).replace(/[^A-Z0-9]/g, "");
}

function ocrComparableSku(value: string) {
  const key = normalizeSkuKey(value);
  if (!key.startsWith("ENT")) return key;
  return `ENT${key.slice(3).replaceAll("O", "0").replaceAll("I", "1").replaceAll("L", "1")}`;
}

function editDistanceAtMostOne(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let differences = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return differences + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

export function resolveKnownSku(value: string, knownSkus: string[]) {
  const key = normalizeSkuKey(value);
  const comparable = ocrComparableSku(value);
  const exact = knownSkus.find((sku) => normalizeSkuKey(sku) === key || ocrComparableSku(sku) === comparable);
  if (exact) return exact;
  if (comparable.length < 8) return "";
  const fuzzy = knownSkus.filter((sku) => {
    const candidate = ocrComparableSku(sku);
    return candidate.slice(0, 3) === comparable.slice(0, 3) && editDistanceAtMostOne(candidate, comparable);
  });
  return fuzzy.length === 1 ? fuzzy[0] : "";
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

function rawSkuValues(text: string) {
  const normalized = normalizeOcr(text);
  const preferred = normalized.match(ENT_SKU_PATTERN) ?? [];
  const matches = preferred.length ? preferred : normalized.match(GENERIC_SKU_PATTERN) ?? [];
  return [...new Set(matches
    .map((value) => value.replace(/[.,;:]$/, ""))
    .filter((value) => !/^(?:RUC|SUNAT|GUIA|FECHA|TOTAL)/.test(value)))];
}

function skuValues(text: string, knownSkus: string[]) {
  return rawSkuValues(text).map((value) => resolveKnownSku(value, knownSkus) || value);
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

function parseTsv(tsv: string) {
  const rows = tsv.split(/\r?\n/).slice(1);
  return rows.flatMap((row): OcrWord[] => {
    const columns = row.split("\t");
    if (columns.length < 12 || columns[0] !== "5") return [];
    const text = columns.slice(11).join("\t").trim();
    if (!text) return [];
    return [{
      lineKey: `${columns[1]}:${columns[2]}:${columns[3]}:${columns[4]}`,
      left: Number(columns[6]) || 0,
      top: Number(columns[7]) || 0,
      width: Number(columns[8]) || 0,
      height: Number(columns[9]) || 0,
      text,
    }];
  });
}

function groupLines(words: OcrWord[]) {
  const groups = new Map<string, OcrWord[]>();
  words.forEach((word) => groups.set(word.lineKey, [...(groups.get(word.lineKey) ?? []), word]));
  return [...groups.values()].map((lineWords): OcrLine => {
    const sorted = lineWords.toSorted((left, right) => left.left - right.left);
    return {
      top: Math.min(...sorted.map((word) => word.top)),
      bottom: Math.max(...sorted.map((word) => word.top + word.height)),
      words: sorted,
      text: normalizeOcr(sorted.map((word) => word.text).join(" ")),
    };
  }).toSorted((left, right) => left.top - right.top);
}

function lineSku(line: OcrLine, knownSkus: string[]) {
  const compactLine = normalizeSkuKey(line.text);
  const knownInLine = knownSkus
    .filter((sku) => compactLine.includes(normalizeSkuKey(sku)))
    .toSorted((left, right) => right.length - left.length)[0];
  if (knownInLine) return knownInLine;
  const raw = rawSkuValues(line.text)[0] ?? "";
  return resolveKnownSku(raw, knownSkus) || raw;
}

function quantityFromLine(line: OcrLine, quantityX: number, pageWidth: number) {
  const candidates = line.words
    .filter((word) => word.left >= Math.max(pageWidth * 0.68, quantityX - pageWidth * 0.035))
    .flatMap((word) => word.text.match(/\b\d{1,7}\b/g) ?? [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0 && value < 10_000_000);
  return candidates.at(-1) ?? 0;
}

function cleanSerial(value: string) {
  return value.toUpperCase().replace(/^[^A-Z0-9]+|[^A-Z0-9-]+$/g, "");
}

function serialValues(line: OcrLine, seriesX: number | null, quantityX: number, sku: string) {
  const labelIndex = line.words.findIndex((word) => /^(?:SERIE|SERIAL|S\/N|SN|LOTE|SERIE\/LOTE)[:.]?$/i.test(word.text));
  let candidates: OcrWord[] = [];
  if (labelIndex >= 0) candidates = line.words.slice(labelIndex + 1);
  else if (seriesX !== null) candidates = line.words.filter((word) => word.left >= seriesX && word.left < quantityX);
  else return [];

  const skuKey = normalizeSkuKey(sku);
  return [...new Set(candidates
    .flatMap((word) => word.text.split(/[,;\s]+/))
    .map(cleanSerial)
    .filter((value) => value.length >= 5 && /\d/.test(value))
    .filter((value) => normalizeSkuKey(value) !== skuKey)
    .filter((value) => !/^20\d{2}[-/]?\d{1,2}[-/]?\d{1,2}$/.test(value)))];
}

function layoutItems(pages: GrLayoutPage[], knownSkus: string[]) {
  const items: LayoutItem[] = [];
  pages.forEach((page) => {
    const lines = groupLines(parseTsv(page.tsv));
    const quantityHeader = lines.find((line) => line.text.includes("CANTIDAD"));
    if (!quantityHeader) return;
    const nearbyHeaders = lines.filter((line) => Math.abs(line.top - quantityHeader.top) <= page.height * 0.06);
    if (!nearbyHeaders.some((line) => /CODIGO|SKU/.test(line.text))) return;
    const headerWords = nearbyHeaders.flatMap((line) => line.words);
    const headerBottom = Math.max(...nearbyHeaders.map((line) => line.bottom));
    const quantityWord = headerWords.find((word) => normalizeOcr(word.text).includes("CANTIDAD"));
    const seriesWord = headerWords.find((word) => /SERIE|SERIAL|LOTE/.test(normalizeOcr(word.text)));
    const quantityX = quantityWord?.left ?? page.width * 0.84;
    const seriesX = seriesWord?.left ?? null;
    let activeItem: LayoutItem | null = null;

    for (const line of lines) {
      if (line.top <= headerBottom) continue;
      if (STOP_TABLE_PATTERN.test(line.text)) break;
      const sku = lineSku(line, knownSkus);
      if (sku) {
        activeItem = {
          sku,
          quantity: quantityFromLine(line, quantityX, page.width) || 1,
          series: serialValues(line, seriesX, quantityX, sku),
        };
        items.push(activeItem);
        continue;
      }
      if (!activeItem) continue;
      const quantity = quantityFromLine(line, quantityX, page.width);
      if (quantity && activeItem.quantity === 1) activeItem.quantity = quantity;
      const series = serialValues(line, seriesX, quantityX, activeItem.sku);
      activeItem.series.push(...series.filter((value) => !activeItem?.series.includes(value)));
    }
  });
  return items;
}

function expandLayoutItems(items: LayoutItem[], knownProducts: KnownProduct[]) {
  const products = new Map(knownProducts.map((product) => [normalizeSkuKey(product.sku), product]));
  return items.flatMap((item): GrIngresoDetectedRow[] => {
    const product = products.get(normalizeSkuKey(item.sku));
    const isLot = product?.category.toUpperCase().includes("LOTE");
    if (!item.series.length) return [{ sku: item.sku, quantity: item.quantity, seriesLot: "" }];
    if (isLot) return [{ sku: item.sku, quantity: item.quantity, seriesLot: item.series.join(", ") }];
    return item.series.map((seriesLot) => ({ sku: item.sku, quantity: 1, seriesLot }));
  });
}

export function parseGrIngresoRecognition({ fullText, headerText = "", quantityText = "", fileName = "", layoutPages = [], knownProducts = [] }: RecognitionInput): GrIngresoRecognition {
  const full = normalizeOcr(fullText);
  const header = normalizeOcr(headerText);
  const fileValues = valuesFromFileName(fileName);
  const movementDate = dateFromText(full);
  const document = fileValues.document || documentFromText(`${header}\n${full}`);
  const orderNumber = fileValues.orderNumber || orderFromText(full);
  const knownSkus = knownProducts.map((product) => product.sku);
  const structuredItems = layoutItems(layoutPages, knownSkus);
  const structuredRows = expandLayoutItems(structuredItems, knownProducts);
  const skus = skuValues(full, knownSkus);
  const quantities = quantityValues(quantityText);
  const fallbackRows = (skus.length ? skus : [""]).map((sku, index) => ({
    sku,
    quantity: quantities[index] ?? (quantities.length === 1 && skus.length === 1 ? quantities[0] : 1),
    seriesLot: "",
  }));
  const rows = structuredRows.length ? structuredRows : fallbackRows;
  const warnings: string[] = [];

  if (!movementDate) warnings.push("No se detectó la fecha de ingreso.");
  if (!document) warnings.push("No se detectó el número de GR.");
  if (!orderNumber) warnings.push("No se detectó el N° Pedido.");
  if (!rows.some((row) => row.sku)) warnings.push("No se detectaron SKU.");
  if (!structuredRows.length && !quantities.length) warnings.push("No se detectó la cantidad; se colocó 1 para revisión.");
  if (!structuredRows.length && skus.length > 1 && quantities.length !== skus.length) warnings.push("La cantidad de SKU y cantidades no coincide; revisa cada línea.");
  const serializedWithoutSeries = rows.filter((row) => {
    const product = knownProducts.find((item) => normalizeSkuKey(item.sku) === normalizeSkuKey(row.sku));
    return product && !product.category.toUpperCase().includes("LOTE") && row.quantity > 1 && !row.seriesLot;
  });
  if (serializedWithoutSeries.length) warnings.push("Hay equipos con cantidad mayor a 1 sin series detectadas; agrega una fila por cada serie.");

  return { movementDate, document, orderNumber, rows, warnings };
}
