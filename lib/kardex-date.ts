function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeKardexDate(value: unknown, fallback = ""): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.floor(value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) return fallback;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) ?? fallback;
  }

  const shortMatch = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (shortMatch) {
    const first = Number(shortMatch[1]);
    const second = Number(shortMatch[2]);
    const year = Number(shortMatch[3]);
    const [month, day] = first > 12 ? [second, first] : [first, second];
    return isoDate(year, month, day) ?? fallback;
  }

  return fallback;
}

export function kardexDate(value: unknown): Date | null {
  const normalized = normalizeKardexDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
