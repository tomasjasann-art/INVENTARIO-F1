import { isHistorical, distance, gallons, isAdministrative, type Assignment, type Expense, type Vehicle } from "./fleet";

export type DistanceSource = "COMBUSTIBLE" | "JORNADAS";
export type OdometerIssue = { reading: Expense; previous?: Expense; reason: string };

/** Fuel readings are cumulative counters, never distances to add together. */
export function fuelDistance(expenses: Expense[]) {
  const readings = expenses.filter(e => e.kind === "COMBUSTIBLE").toSorted((a, b) => a.date.localeCompare(b.date) || (a.source?.time || "").localeCompare(b.source?.time || "") || a.id - b.id);
  const issues: OdometerIssue[] = [];
  let previous: Expense | undefined;
  for (const reading of readings) {
    if (reading.odometer === null || !Number.isFinite(reading.odometer) || reading.odometer < 0) {
      issues.push({ reading, reason: "Odómetro ausente o inválido" });
      continue;
    }
    if (previous) {
      if (reading.date === previous.date && (!reading.source?.time || !previous.source?.time) && reading.odometer !== previous.odometer) {
        issues.push({ reading, previous, reason: "Falta la hora para ordenar lecturas distintas del mismo día" });
      } else if (reading.odometer < previous.odometer!) {
        issues.push({ reading, previous, reason: "El odómetro disminuye respecto al abastecimiento anterior" });
      }
    }
    previous = reading;
  }
  const first = readings[0], last = readings.at(-1);
  // Two events at the same instant do not establish a measured interval.
  const hasInterval = first && last && (first.date !== last.date || (first.source?.time && last.source?.time && first.source.time !== last.source.time));
  const km = readings.length >= 2 && hasInterval && !issues.length ? last.odometer! - first.odometer! : null;
  return { readings, first, last, issues, km, status: issues.length ? "Revisar odómetros" : km === null ? "Se requieren dos lecturas en momentos distintos" : "Entre primer y último abastecimiento" };
}

export function vehicleReport(vehicle: Vehicle, assignments: Assignment[], expenses: Expense[], source: DistanceSource) {
  const journeys = assignments.filter(a => a.vehicleId === vehicle.id && !isAdministrative(a));
  const closed = journeys.filter(a => (a.endedAt || isHistorical(a)) && a.initialKm !== null && a.finalKm !== null && a.finalKm >= a.initialKm);
  const journeyKm = closed.length ? closed.reduce((sum, a) => sum + distance(a), 0) : null;
  const allExpenses = expenses.filter(e => e.vehicleId === vehicle.id);
  const fuel = allExpenses.filter(e => e.kind === "COMBUSTIBLE");
  const odometers = fuelDistance(fuel);
  const km = source === "COMBUSTIBLE" ? odometers.km : journeyKm;
  const cost = allExpenses.reduce((sum, e) => sum + e.amountCents, 0);
  const gal = fuel.reduce((sum, e) => sum + gallons(e), 0);
  const m3 = fuel.filter(e => e.unit === "M3").reduce((sum, e) => sum + e.quantity, 0);
  const mixed = fuel.some(e => e.unit === "M3");
  return { v: vehicle, km, journeyKm, odometers, source, cost, gal, m3, mixed, fuelCost: fuel.reduce((sum, e) => sum + e.amountCents, 0), costPerKm: km !== null && km > 0 ? cost / km : null, efficiency: !mixed && km !== null && km > 0 && gal > 0 ? km / gal : null, missing: journeys.some(a => a.startedAt && !a.endedAt) };
}

/** The summary uses one distance source per vehicle, never a fallback or a sum of both. */
export function summaryVehicleReport(vehicle: Vehicle, assignments: Assignment[], expenses: Expense[], responsibilityFilter = false) {
  const source = vehicle.usage === "ADMINISTRACION" ? "COMBUSTIBLE" : "JORNADAS";
  const row = vehicleReport(vehicle, assignments, expenses, source);
  // An odometer interval can include travel by other people between the selected refuels.
  if (source === "COMBUSTIBLE" && responsibilityFilter) return { ...row, km: null, costPerKm: null, efficiency: null };
  return row;
}

export function reportTotals(rows: ReturnType<typeof vehicleReport>[]) {
  const comparable = rows.filter(r => r.km !== null);
  const km = comparable.length ? comparable.reduce((sum, r) => sum + r.km!, 0) : null;
  const comparableCost = comparable.reduce((sum, r) => sum + r.cost, 0);
  const liquid = comparable.filter(r => !r.mixed && r.gal > 0);
  const liquidKm = liquid.reduce((sum, r) => sum + r.km!, 0), liquidGal = liquid.reduce((sum, r) => sum + r.gal, 0);
  return { km, comparableCost, excludedCost: rows.filter(r => r.km === null).reduce((sum, r) => sum + r.cost, 0), missing: rows.filter(r => r.km === null).length, cost: rows.reduce((sum, r) => sum + r.cost, 0), costPerKm: km !== null && km > 0 ? comparableCost / km : null, efficiency: liquidKm > 0 && liquidGal > 0 ? liquidKm / liquidGal : null };
}
