import { normalizedPlate, type HistoricalSource, type Vehicle } from "./fleet";
import { IMPORT_LIMIT, importDate, importNumber, type ImportSheet } from "./fleet-import";

const text = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");
const header = (v: unknown) => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export type HistoricalInput = { vehicleId: number; serviceDate: string; responsibleName: string; initialKm: number | null; finalKm: number | null; coordinator: string; ceco: string; site: string; source: HistoricalSource; _plate: string; _row: number; _error: string };

export function parseFleetHistory(sheets: ImportSheet[], vehicles: Pick<Vehicle, "id" | "plate">[], options: { file: string; from: string; to: string; date1904?: boolean }) {
  if (options.from > options.to) throw new Error("El inicio del periodo debe ser anterior al final.");
  const inputs: HistoricalInput[] = [];
  let excluded = 0, tables = 0;
  const plates = new Map(vehicles.map(v => [normalizedPlate(v.plate), v.id]));
  for (const sheet of sheets) {
    const head = sheet.rows.slice(0, 30).findIndex(row => { const h = row.map(header); return h.includes("fecha") && h.includes("kilometrajeinicial") && h.includes("kilometrajefinal") && (h.includes("placadelvehiculo") || h.includes("placa")); });
    if (head < 0) continue;
    tables++;
    const headers = sheet.rows[head].map(header);
    for (let index = head + 1; index < sheet.rows.length; index++) {
      const row = sheet.rows[index];
      if (!row.some(v => text(v))) continue;
      const get = (...names: string[]) => { for (const name of names) { const value = row[headers.indexOf(header(name))]; if (text(value)) return value; } return ""; };
      const serviceDate = importDate(get("Fecha"), options.date1904);
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) && !Number.isNaN(Date.parse(`${serviceDate}T12:00:00Z`)) && new Date(`${serviceDate}T12:00:00Z`).toISOString().slice(0, 10) === serviceDate;
      if (validDate && (serviceDate < options.from || serviceDate > options.to)) { excluded++; continue; }
      const plate = normalizedPlate(get("Placa del Vehiculo", "Placa"));
      const initialKm = importNumber(get("Kilometraje Inicial")), finalKm = importNumber(get("Kilometraje Final"));
      const reportedKm = importNumber(get("Km Recorridos"));
      const responsibleName = text(get("Conductores", "Conductor"));
      const errors: string[] = [];
      if (!validDate) errors.push("Fecha inválida");
      if (!plates.has(plate)) errors.push("Placa no registrada");
      if (!responsibleName) errors.push("Falta conductor");
      if (initialKm === null || finalKm === null || !Number.isFinite(initialKm) || !Number.isFinite(finalKm) || initialKm < 0 || finalKm < initialKm) errors.push("Revisar kilometraje inicial y final");
      if (reportedKm !== null && (!Number.isFinite(reportedKm) || initialKm === null || finalKm === null || Math.abs(finalKm - initialKm - reportedKm) > .1)) errors.push("Km recorridos no coincide con Final menos Inicial");
      inputs.push({ vehicleId: plates.get(plate) || 0, serviceDate, responsibleName, initialKm: Number.isFinite(initialKm) ? initialKm : null, finalKm: Number.isFinite(finalKm) ? finalKm : null, coordinator: text(get("Coordinador")), ceco: text(get("CECO")), site: text(get("SITE")), source: { format: "HISTORICO", formId: text(get("Id")), formStarted: text(get("Hora de inicio")), formEnded: text(get("Hora de finalización")), monthLabel: text(get("Mes")), collector: text(get("COLECTOR")), reportedKm: Number.isFinite(reportedKm) ? reportedKm : null, file: options.file.slice(0, 200), sheet: sheet.name.slice(0, 100), row: index + 1 }, _plate: plate, _row: index + 1, _error: errors.join(" · ") });
    }
  }
  if (!tables) throw new Error("No se reconoce el control anterior. Se requieren Fecha, Placa, Kilometraje Inicial y Kilometraje Final.");
  if (!inputs.length) throw new Error("No hay registros dentro del periodo seleccionado.");
  if (inputs.length > IMPORT_LIMIT) throw new Error(`El archivo supera ${IMPORT_LIMIT} registros.`);
  return { inputs, excluded };
}
