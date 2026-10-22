import { assignmentStatus, isAdministrative, limaDate, type FleetData, type Vehicle } from "./fleet";
import { reportTotals, vehicleReport, type DistanceSource } from "./fleet-report";

export function monthOffset(month: string, offset = 0) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Selecciona un mes válido.");
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 15)).toISOString().slice(0, 7);
}
export const monthLabel = (month: string) => new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthOffset(month)}-15T12:00:00Z`));
export const percentChange = (current: number | null, previous: number | null) => current === null || previous === null || previous <= 0 ? null : (current / previous - 1) * 100;

export function monthlySnapshot(data: FleetData, vehicles: Vehicle[], month: string, source: DistanceSource, today: string, target: number) {
  const key = monthOffset(month), monthEnd = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const end = monthEnd < today ? monthEnd : today;
  const includes = (date: string) => date.startsWith(key) && date <= end;
  const assignments = data.assignments.filter(a => includes(a.serviceDate));
  const expenses = data.expenses.filter(e => includes(e.date));
  const rows = vehicles.map(v => vehicleReport(v, assignments, expenses, source)).filter(r => r.cost || r.odometers.readings.length || r.journeyKm !== null || assignments.some(a => a.vehicleId === r.v.id));
  const totals = reportTotals(rows);
  const liquid = rows.filter(r => r.efficiency !== null);
  const comparableIds = rows.filter(r => r.km !== null).map(r => r.v.id).sort((a, b) => a - b).join(",");
  const liquidIds = liquid.map(r => r.v.id).sort((a, b) => a - b).join(",");
  return { month: key, end, partial: monthEnd > today && key === today.slice(0, 7), rows, totals, assignments, comparableIds, liquidIds, compliance: totals.efficiency === null ? null : totals.efficiency / target * 100, fuelCount: expenses.filter(e => e.kind === "COMBUSTIBLE" && vehicles.some(v => v.id === e.vehicleId)).length, costs: ["COMBUSTIBLE", "PEAJE", "MANTENIMIENTO"].map(kind => { const entries = expenses.filter(e => e.kind === kind && vehicles.some(v => v.id === e.vehicleId)); return { kind, count: entries.length, amount: entries.reduce((sum, e) => sum + e.amountCents, 0) }; }) };
}

export function monthlyReport(data: FleetData, vehicles: Vehicle[], month: string, source: DistanceSource, target: number, now = new Date()) {
  if (!Number.isFinite(target) || target <= 0) throw new Error("La meta debe ser mayor a cero.");
  const today = limaDate(now);
  const months = [-3, -2, -1, 0].map(offset => monthlySnapshot(data, vehicles, monthOffset(month, offset), source, today, target));
  const current = months[3], previous = months[2];
  const complete = !current.partial && current.month < today.slice(0, 7);
  const sameCoverage = complete && current.comparableIds !== "" && current.comparableIds === previous.comparableIds;
  const sameLiquid = complete && current.liquidIds !== "" && current.liquidIds === previous.liquidIds;
  const changes = { km: sameCoverage ? percentChange(current.totals.km, previous.totals.km) : null, costPerKm: sameCoverage ? percentChange(current.totals.costPerKm, previous.totals.costPerKm) : null, efficiency: sameLiquid ? percentChange(current.totals.efficiency, previous.totals.efficiency) : null };
  const pending = current.assignments.filter(a => vehicles.some(v => v.id === a.vehicleId) && !isAdministrative(a) && ["Sin Inicio", "Cierre pendiente"].includes(assignmentStatus(a, now)));
  const eligible = current.rows.filter(r => r.efficiency !== null);
  const below = eligible.filter(r => r.efficiency! < (r.v.target || target)).sort((a, b) => a.efficiency! / (a.v.target || target) - b.efficiency! / (b.v.target || target));
  const above = eligible.filter(r => r.efficiency! >= (r.v.target || target));
  const invalid = current.rows.filter(r => r.odometers.issues.length);
  const strengths: string[] = [], risks: string[] = [], recommendations: string[] = [];
  if (above.length) strengths.push(`${above.length} unidad(es) alcanzan su meta de rendimiento estimado: ${above.map(r => r.v.plate).join(", ")}.`);
  if (changes.efficiency !== null && changes.efficiency > 0) strengths.push(`El rendimiento estimado aumentó ${changes.efficiency.toFixed(1)}% frente al mes anterior, con las mismas unidades comparables.`);
  if (changes.costPerKm !== null && changes.costPerKm < 0) strengths.push(`El costo por km disminuyó ${Math.abs(changes.costPerKm).toFixed(1)}% frente al mes anterior, con las mismas unidades comparables.`);
  if (invalid.length) { risks.push(`Odómetros por revisar en ${invalid.map(r => r.v.plate).join(", ")}.`); recommendations.push("Validar las lecturas observadas del proveedor antes de cerrar la evaluación de eficiencia."); }
  if (current.totals.missing) risks.push(`${current.totals.missing} unidad(es) con actividad sin base válida de kilómetros para el cálculo seleccionado.`);
  if (below.length) { risks.push(`${below.length} unidad(es) por debajo de su meta de rendimiento estimado.`); recommendations.push(`Revisar abastecimientos, mantenimiento y condiciones de uso de ${below.map(r => r.v.plate).join(", ")}, antes de atribuir causas.`); }
  if (pending.length) { risks.push(`${pending.length} marcación(es) pendientes de Inicio o Final.`); recommendations.push("Completar las marcaciones pendientes y contrastar los odómetros con las evidencias del conductor."); }
  const missingCosts = current.costs.filter(c => c.count === 0);
  if (missingCosts.length) recommendations.push("Revisar la cobertura de combustible, peajes y mantenimiento; los conceptos sin registros quedan pendientes de confirmar.");
  if (!current.rows.length) risks.push("No hay actividad registrada para este mes y los filtros seleccionados.");
  recommendations.push("Contrastar el recorrido entre abastecimientos con las jornadas cerradas y revisar el ralentí registrado en el GPS.");
  const vehicleIds = new Set(vehicles.map(v => v.id));
  const idle = data.idle.filter(i => vehicleIds.has(i.vehicleId) && i.date.startsWith(current.month) && i.date <= current.end);
  return { ...current, months, changes, pending, below, above, invalid, strengths, risks, recommendations, focus: below[0] || null, idleMinutes: idle.length ? idle.reduce((sum, i) => sum + i.minutes, 0) : null };
}
