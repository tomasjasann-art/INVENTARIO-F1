export type ReturnRecognitionProduct = {
  id: number;
  sku: string;
  description: string;
};

export type ReturnRecognitionIdentifier = {
  productId: number;
  identifier: string;
  normalizedIdentifier: string;
  active: boolean;
};

export type ReturnRecognitionMovement = {
  id: number;
  productId: number;
  type: string;
  serials: string;
  orderNumber: string;
  coordinatorF1: string;
};

export type ReturnRecognitionResult = {
  serial: string;
  partNumber: string;
  productId: number | null;
  orderNumber: string;
  coordinatorF1: string;
  sourceMovementId: number | null;
  matchMethod: "HISTORIAL_SERIE" | "PART_NUMBER_GUARDADO" | "PART_NUMBER_DESCRIPCION" | "SKU_VISIBLE" | "MANUAL";
  matchConfidence: number;
  warnings: string[];
};

export function normalizeEquipmentIdentifier(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanToken(value: string) {
  return value.toUpperCase().replace(/^[^A-Z0-9]+|[^A-Z0-9._/-]+$/g, "");
}

function usefulIdentifier(value: string) {
  const normalized = normalizeEquipmentIdentifier(value);
  return normalized.length >= 5 && /\d/.test(normalized) ? normalized : "";
}

function labelledValue(text: string, labels: RegExp) {
  const lines = text.toUpperCase().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(new RegExp(`(?:${labels.source})\\s*(?:N[°ºO.]*)?\\s*[:#=-]?\\s*([A-Z0-9][A-Z0-9._\\/-]{4,})`, "i"));
    if (match?.[1]) return cleanToken(match[1]);
  }
  return "";
}

function serialTokens(value: string) {
  return value.split(/[,;\n]/).map((item) => normalizeEquipmentIdentifier(item)).filter(Boolean);
}

function fallbackSerial(text: string, excluded: Set<string>) {
  const candidates = text.toUpperCase().match(/[A-Z0-9][A-Z0-9._/-]{7,}/g) ?? [];
  return candidates
    .map(cleanToken)
    .filter((value) => {
      const normalized = normalizeEquipmentIdentifier(value);
      return normalized.length >= 8 && /[A-Z]/.test(normalized) && /\d/.test(normalized) && !excluded.has(normalized);
    })
    .toSorted((left, right) => normalizeEquipmentIdentifier(right).length - normalizeEquipmentIdentifier(left).length)[0] ?? "";
}

function descriptionIdentifiers(description: string) {
  const direct = description.toUpperCase().match(/[A-Z0-9][A-Z0-9._/-]{4,}/g) ?? [];
  const joined = description.toUpperCase().match(/[A-Z]{1,8}[ -]?\d[A-Z0-9 -]{3,20}/g) ?? [];
  return [...new Set([...direct, ...joined].map(usefulIdentifier).filter(Boolean))];
}

type Candidate = {
  productId: number;
  identifier: string;
  method: ReturnRecognitionResult["matchMethod"];
  score: number;
};

function bestCandidate(candidates: Candidate[]) {
  const sorted = candidates.toSorted((left, right) => right.score - left.score || right.identifier.length - left.identifier.length);
  if (!sorted.length) return { candidate: null, ambiguous: false };
  const best = sorted[0];
  const ambiguous = sorted.some((candidate, index) => index > 0 && candidate.productId !== best.productId && candidate.score === best.score);
  return { candidate: ambiguous ? null : best, ambiguous };
}

export function recognizeEquipmentReturn({
  text,
  products,
  identifiers,
  movements,
}: {
  text: string;
  products: ReturnRecognitionProduct[];
  identifiers: ReturnRecognitionIdentifier[];
  movements: ReturnRecognitionMovement[];
}): ReturnRecognitionResult {
  const upperText = text.toUpperCase();
  const compactText = normalizeEquipmentIdentifier(text);
  const explicitPartNumberValue = labelledValue(upperText, /P\/?N|PART(?:\s*(?:NO|NUMBER|N[°º]))?|PARTNUMBER|MODELO?|MODEL/);
  const explicitPartNumber = usefulIdentifier(explicitPartNumberValue) ? explicitPartNumberValue : "";
  const excludedSerials = new Set(products.map((product) => normalizeEquipmentIdentifier(product.sku)));
  if (explicitPartNumber) excludedSerials.add(normalizeEquipmentIdentifier(explicitPartNumber));
  const serial = labelledValue(upperText, /S\/?N|SERIAL(?:\s*(?:NO|NUMBER))?|SERIE/) || fallbackSerial(upperText, excludedSerials);
  const serialKey = normalizeEquipmentIdentifier(serial);
  const warnings: string[] = [];

  const historicalMatches = serialKey
    ? movements
      .filter((movement) => serialTokens(movement.serials).includes(serialKey))
      .toSorted((left, right) => right.id - left.id)
    : [];
  const historical = historicalMatches.find((movement) => ["salida", "baja"].includes(movement.type)) ?? historicalMatches[0];
  if (historical) {
    return {
      serial,
      partNumber: explicitPartNumber,
      productId: historical.productId,
      orderNumber: historical.orderNumber,
      coordinatorF1: historical.coordinatorF1,
      sourceMovementId: historical.id,
      matchMethod: "HISTORIAL_SERIE",
      matchConfidence: 100,
      warnings,
    };
  }

  const haystack = `${serialKey}${compactText}`;
  const candidates: Candidate[] = [];
  identifiers.filter((identifier) => identifier.active).forEach((identifier) => {
    const normalized = usefulIdentifier(identifier.normalizedIdentifier || identifier.identifier);
    if (!normalized || !haystack.includes(normalized)) return;
    candidates.push({
      productId: identifier.productId,
      identifier: normalized,
      method: "PART_NUMBER_GUARDADO",
      score: 900 + normalized.length,
    });
  });
  products.forEach((product) => {
    descriptionIdentifiers(product.description).forEach((identifier) => {
      if (!haystack.includes(identifier)) return;
      candidates.push({
        productId: product.id,
        identifier,
        method: "PART_NUMBER_DESCRIPCION",
        score: 700 + identifier.length,
      });
    });
    const sku = usefulIdentifier(product.sku);
    if (sku && compactText.includes(sku)) {
      candidates.push({ productId: product.id, identifier: sku, method: "SKU_VISIBLE", score: 500 + sku.length });
    }
  });

  const { candidate, ambiguous } = bestCandidate(candidates);
  if (!serial) warnings.push("No se detectó claramente la serie; debes escribirla antes de guardar.");
  if (ambiguous) warnings.push("El part number coincide con más de un SKU. Selecciona el equipo manualmente.");
  if (!candidate) warnings.push("No hubo una relación única con el maestro. Selecciona el SKU y confirma el part number.");
  const product = candidate ? products.find((item) => item.id === candidate.productId) : undefined;
  const partNumber = explicitPartNumber || candidate?.identifier || "";

  return {
    serial,
    partNumber,
    productId: product?.id ?? null,
    orderNumber: "",
    coordinatorF1: "",
    sourceMovementId: null,
    matchMethod: candidate?.method ?? "MANUAL",
    matchConfidence: candidate ? Math.min(96, candidate.method === "PART_NUMBER_GUARDADO" ? 95 : candidate.method === "PART_NUMBER_DESCRIPCION" ? 88 : 82) : 0,
    warnings,
  };
}
