import { normalizedPlate, type Vehicle } from "./fleet";

export const IMPORT_LIMIT = 5000;
// Preserve CSV dates, times and identifiers as text; native Excel cell types remain available.
export const FLEET_WORKBOOK_OPTIONS = { type: "array", cellDates: false, raw: true } as const;
export type ImportSheet = { name: string; rows: unknown[][] };
export type ImportOptions = { kind: string; provider: string; unit: string; file: string; date1904?: boolean };
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => String(v ?? "").trim();
export function importNumber(v: unknown): number | null {
  if (v === "" || v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let raw = str(v).replace(/^S\/?\.?\s*/i, "").replace(/\s/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (raw.includes(",")) raw = raw.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}
export function importDate(value: unknown, date1904 = false): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value < 100000) return new Date(Date.UTC(1899, 11, 30) + (Math.floor(value) + (date1904 ? 1462 : 0)) * 86400000).toISOString().slice(0, 10);
  const s = str(value);
  const ymd = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T].*)?$/.exec(s);
  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T].*)?$/.exec(s);
  const parts = ymd ? [ymd[1], ymd[2], ymd[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return s;
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}
export function importTime(value: unknown): string {
  if (typeof value === "number" && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400) % 86400;
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, "0")).join(":");
  }
  const m = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(str(value));
  return m && Number(m[1]) < 24 ? `${m[1].padStart(2, "0")}:${m[2]}:${m[3] || "00"}` : str(value);
}

export function parseFleetImport(sheets: ImportSheet[], vehicles: Pick<Vehicle, "plate" | "id">[], options: ImportOptions) {
  let selected: { sheet: ImportSheet; headerRow: number; format: "FUEL_ATIO" | "TOLL_REPORT" | "TEMPLATE" } | undefined;
  for (const sheet of sheets) {
    for (let index = 0; index < Math.min(30, sheet.rows.length); index++) {
      const h = new Set(sheet.rows[index].map(norm));
      const format = h.has("fechacontrolador") && h.has("codigovehiculo") && h.has("volumendespachado") ? "FUEL_ATIO"
        : h.has("placa") && h.has("fechainicio") && h.has("plaza") && h.has("importe") ? "TOLL_REPORT"
        : h.has("fecha") && h.has("placa") && (h.has("importe") || h.has("total")) ? "TEMPLATE" : null;
      if (format) {
        if (selected) throw new Error("Hay más de una tabla compatible. Carga un archivo con una sola tabla de movimientos.");
        selected = { sheet, headerRow: index, format };
        break;
      }
    }
  }
  if (!selected) throw new Error("No se reconocen las columnas. Usa el reporte de combustible, el reporte de peajes o la plantilla base.");
  const { sheet, headerRow, format } = selected;
  if ((format === "FUEL_ATIO" && options.kind !== "COMBUSTIBLE") || (format === "TOLL_REPORT" && options.kind !== "PEAJE")) throw new Error(`Este archivo corresponde a ${format === "FUEL_ATIO" ? "Combustible" : "Peajes"}. Cambia el tipo de carga.`);
  const headers = sheet.rows[headerRow].map(norm);
  const vehicleIds = new Map(vehicles.map(v => [normalizedPlate(v.plate), v.id]));
  const inputs: Record<string, unknown>[] = [];
  let skippedTotals = 0;
  for (let index = headerRow + 1; index < sheet.rows.length; index++) {
    const row = sheet.rows[index];
    if (!row.some(v => str(v))) continue;
    const get = (...keys: string[]) => { for (const key of keys) { const cell = row[headers.indexOf(norm(key))]; if (str(cell)) return cell; } return ""; };
    const fuelReport = format === "FUEL_ATIO", tollReport = format === "TOLL_REPORT";
    const plate = normalizedPlate(get(...(fuelReport ? ["Codigo Vehiculo", "Patente", "Id Vehiculo"] : ["Placa", "Placa del Vehiculo", "Vehiculo"])));
    const date = importDate(get(...(fuelReport ? ["Fecha Controlador"] : tollReport ? ["Fecha Inicio"] : ["Fecha", "Fecha de consumo"])), options.date1904);
    if (!plate && !date && ["total", "totales", "totalgeneral"].includes(norm(get("Combustible", "Placa", "Fecha", "Plaza")))) { skippedTotals++; continue; }
    const time = importTime(get(tollReport ? "Hora Inicio" : "Hora"));
    const quantity = importNumber(get("Volumen", "Volumen Despachado"));
    const unitPrice = importNumber(get("PrecioUnitario", "Precio unitario Despachado"));
    const originalAmount = importNumber(get("Importe", "Monto Despachado", "Total"));
    const amount = originalAmount === null && quantity !== null && unitPrice !== null ? Math.round(quantity * unitPrice * 100) / 100 : originalAmount;
    const fuel = str(get("Combustible"));
    const voucher = str(get(tollReport ? "Nro Comprobante" : "Numero de Comprobante ERP"));
    const transactionId = str(get("Id Transaccion"));
    const station = str(get(tollReport ? "Plaza" : "Sitio"));
    const lane = str(get("Pista"));
    const source = format === "TEMPLATE" ? null : { format, transactionId, time, station, lane, voucher, voucherDate: tollReport ? importDate(get("Fecha Comprobante"), options.date1904) : "", file: options.file.slice(0, 200), sheet: sheet.name.slice(0, 100), row: index + 1 };
    const reference = fuelReport ? voucher || str(get("Numero de Comprobante", "Número OC")) || transactionId : tollReport ? voucher || `${date} ${time} ${station} ${lane}`.slice(0, 200) : str(get("Referencia", "NroServicio", "Comprobante"));
    const numeric = { amount, quantity: quantity ?? 0, unitPrice: unitPrice ?? 0, odometer: importNumber(get("Odometro")), assignmentId: importNumber(get("AsignacionID")) };
    const bad = Object.entries(numeric).filter(([, v]) => v !== null && !Number.isFinite(v)).map(([key]) => key);
    inputs.push({ vehicleId: vehicleIds.get(plate) || 0, date, kind: options.kind, provider: fuelReport ? options.provider.trim() : str(get(tollReport ? "Red Uso" : "Proveedor")), collector: str(get("Colector", "Plaza")), reference, fuel, ...numeric, unit: str(get("Unidad") || (/GNV/i.test(fuel) ? "M3" : options.unit || "GAL")).toUpperCase().replace("M³", "M3"), invoiceId: null, notes: str(get("Observacion")), source, _plate: plate, _row: index + 1, _error: bad.length ? `Número inválido: ${bad.join(", ")}` : "", autoAssign: format !== "TEMPLATE" });
  }
  if (!inputs.length || inputs.length > IMPORT_LIMIT) throw new Error(`El archivo debe contener entre 1 y ${IMPORT_LIMIT.toLocaleString("es-PE")} movimientos.`);
  return { inputs, format, sheet: sheet.name, skippedTotals };
}
