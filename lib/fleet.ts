export const PHOTO_SLOTS = ["Frente", "Posterior", "Lateral izquierdo", "Lateral derecho", "Tablero / kilometraje", "Interior", "Control de recepción y entrega"] as const;
export type FleetPhoto = { slot: string; path: string; url?: string };
export type Vehicle = { id: number; plate: string; ceco: string; usage: string; tenure: string; category: string; type: string; brand: string; model: string; engine: string; chassis: string; color: string; titleDate: string; year: number | null; status: string; target: number; initialKm: number; notes: string };
export type HistoricalSource = { format: "HISTORICO"; formId: string; formStarted: string; formEnded: string; monthLabel: string; collector: string; reportedKm: number | null; file: string; sheet: string; row: number };
export type Assignment = { id: number; vehicleId: number; driverId: number | null; trackingMode: string; responsibleName: string; serviceDate: string; endDate: string; expectedStart: string; expectedEnd: string; coordinator: string; ceco: string; site: string; finalZone: string; notes: string; planStatus: string; reason: string; initialKm: number | null; finalKm: number | null; startedAt: string; endedAt: string; startPhotos: FleetPhoto[]; endPhotos: FleetPhoto[]; startNotes: string; endNotes: string; startRegisteredBy?: string; endRegisteredBy?: string; createdBy: string; updatedAt: string; importKey?: string | null; source?: HistoricalSource | null };
export type ImportChange = { field: string; label: string; before: string | number | null; after: string | number | null };
export type FuelCorrection = { at: string; by: string; changes: ImportChange[] };
export type ExpenseSource = { format: "FUEL_ATIO" | "TOLL_REPORT"; transactionId: string; time: string; station: string; lane: string; voucher: string; voucherDate: string; file: string; sheet: string; row: number; corrections?: FuelCorrection[] };
export type Expense = { id: number; vehicleId: number; assignmentId: number | null; date: string; kind: string; amountCents: number; quantity: number; unit: string; fuel: string; unitPrice: number; odometer: number | null; provider: string; reference: string; collector: string; invoiceId: number | null; maintenanceType: string; nextKm: number | null; attachment: string; notes: string; fingerprint: string; source: ExpenseSource | null; createdBy: string };
export type FleetDocument = { id: number; vehicleId: number; kind: string; provider: string; reference: string; startDate: string; expiryDate: string; attachment: string; notes: string };
export type Invoice = { id: number; provider: string; number: string; issueDate: string; dueDate: string; totalCents: number; attachment: string; notes: string };
export type Payment = { id: number; invoiceId: number; date: string; amountCents: number; reference: string; attachment: string; createdBy: string };
export type Idle = { id: number; vehicleId: number; date: string; minutes: number; notes: string };
export type StationSource = { file: string; page: number; network: string };
export type Station = { id: number; name: string; provider: string; address: string; district: string; city: string; region: string; fuels: string; hours: string; restrictions: string; latitude: number | null; longitude: number | null; verified: boolean; active: boolean; importKey: string | null; source: StationSource | null };
export type FleetUser = { id: number; displayName: string; role: string; username: string; active?: boolean };
export type FleetData = { user: FleetUser; vehicles: Vehicle[]; assignments: Assignment[]; expenses: Expense[]; documents: FleetDocument[]; invoices: Invoice[]; payments: Payment[]; idle: Idle[]; stations: Station[]; drivers: FleetUser[]; coordinators: string[] };

export function limaDate(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function normalizedPlate(value: unknown) { return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
export function minutesFromTime(value: string) { const m = /^(\d{1,4}):([0-5]\d)$/.exec(value.trim()); if (!m) throw new Error("Ingresa el ralentí como horas:minutos (ejemplo 01:35)."); return Number(m[1]) * 60 + Number(m[2]); }
export function timeFromMinutes(minutes: number) { return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`; }
export function assignmentStatus(a: Assignment, now = new Date()) {
  if (isHistorical(a)) return "Registro histórico";
  if (isAdministrative(a)) return "Registro administrativo";
  if (["NO_SALIO", "CANCELADA"].includes(a.planStatus)) return a.planStatus === "NO_SALIO" ? "No salió" : "Cancelada";
  if (a.planStatus === "POR_CONFIRMAR" && !a.startedAt) return "Por confirmar";
  if (a.endedAt) return "Finalizada";
  if (a.startedAt) return now > new Date(`${a.endDate || a.serviceDate}T${a.expectedEnd}:00-05:00`) ? "Cierre pendiente" : "En jornada";
  return now > new Date(`${a.serviceDate}T${a.expectedStart}:00-05:00`) ? "Sin Inicio" : "Programada";
}
export const DOCUMENT_KINDS = ["SOAT", "REVISION_TECNICA", "SEGURO", "TARJETA_PROPIEDAD"] as const;
export const DOCUMENT_LABELS: Record<string, string> = { SOAT: "SOAT", REVISION_TECNICA: "Revisión técnica", SEGURO: "Seguro", TARJETA_PROPIEDAD: "Tarjeta de propiedad" };
export type EditableFleetRecord = "assignment" | "document" | "invoice";
export function fleetRecordVersion(kind: EditableFleetRecord, record: Record<string, unknown>) {
  const fields = kind === "assignment" ? ["id", "vehicleId", "driverId", "trackingMode", "responsibleName", "serviceDate", "endDate", "expectedStart", "expectedEnd", "coordinator", "ceco", "site", "finalZone", "notes", "planStatus", "reason", "startedAt", "endedAt", "initialKm", "finalKm", "updatedAt", "source"] : kind === "document" ? ["id", "vehicleId", "kind", "provider", "reference", "startDate", "expiryDate", "attachment", "notes"] : ["id", "provider", "number", "issueDate", "dueDate", "totalCents", "attachment", "notes"];
  return JSON.stringify(fields.map(field => record[field] ?? null));
}
export function documentStatus(d: FleetDocument, today = limaDate()) {
  if (d.kind === "TARJETA_PROPIEDAD") return "Sin vencimiento";
  if (d.expiryDate < today) return "Vencido";
  const days = Math.round((Date.parse(`${d.expiryDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  return days <= 30 ? `Vence en ${days} días` : "Vigente";
}
export function gallons(e: Expense) { return e.kind !== "COMBUSTIBLE" ? 0 : e.unit === "GAL" ? e.quantity : e.unit === "L" ? e.quantity / 3.785411784 : 0; }
export function distance(a: Assignment) { return (a.endedAt || isHistorical(a)) && a.initialKm !== null && a.finalKm !== null ? Math.max(0, a.finalKm - a.initialKm) : 0; }
export function canManageFleet(role: string) { return role === "ADMINISTRADOR" || role === "LOGISTICA"; }
export function isAdministrative(a: Pick<Assignment, "trackingMode">) { return a.trackingMode === "ADMINISTRATIVO"; }
export function isHistorical(a: Pick<Assignment, "trackingMode">) { return a.trackingMode === "HISTORICO"; }
export function historicalValues(a: Pick<Assignment, "vehicleId" | "serviceDate" | "responsibleName" | "initialKm" | "finalKm" | "coordinator" | "ceco" | "site" | "source">) {
  return [a.vehicleId, a.serviceDate, a.responsibleName, a.initialKm, a.finalKm, a.coordinator, a.ceco, a.site, a.source?.collector || ""];
}
export function historicalIdentity(a: Parameters<typeof historicalValues>[0]) {
  return a.source?.formId ? ["HISTORICO_FORM", a.vehicleId, a.source.formId] : ["HISTORICO_FILA", ...historicalValues(a)];
}
export function activeDrivers(users: FleetUser[]) { return users.filter(u => u.role === "CONDUCTOR" && u.active !== false); }
export function expenseIdentity(e: Pick<Expense, "vehicleId" | "date" | "kind" | "provider" | "reference" | "source">) {
  const clean = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
  if (e.source?.format === "FUEL_ATIO") return ["FUEL_ATIO", clean(e.source.transactionId)];
  if (e.source?.format === "TOLL_REPORT") return ["TOLL_REPORT", e.vehicleId, e.date, e.source.time, clean(e.provider), clean(e.source.station), clean(e.source.lane)];
  return [e.vehicleId, e.date, e.kind, e.provider.toUpperCase(), e.reference.toUpperCase()];
}
export function matchingAssignments(e: Pick<Expense, "vehicleId" | "date" | "source">, assignments: Assignment[]) {
  const at = e.source?.time ? `${e.date}T${e.source.time}` : "";
  const local = (value: string) => new Date(Date.parse(value) - 5 * 3600000).toISOString().slice(0, 19);
  return assignments.filter(a => {
    if (isHistorical(a)) return false;
    if (a.vehicleId !== e.vehicleId || a.planStatus !== "CONFIRMADA" || e.date < a.serviceDate || e.date > a.endDate) return false;
    if (isAdministrative(a) || !at) return true;
    const start = a.startedAt ? local(a.startedAt) : `${a.serviceDate}T${a.expectedStart}:00`;
    const end = a.endedAt ? local(a.endedAt) : `${a.endDate}T${a.expectedEnd}:00`;
    return at >= start && at <= end;
  });
}
export function odometerReview(e: Pick<Expense, "kind" | "odometer">, a?: Assignment) {
  if (e.kind !== "COMBUSTIBLE" || e.odometer === null) return "";
  if (!a) return "Sin jornada vinculada";
  if (isHistorical(a)) return e.odometer < (a.initialKm ?? 0) || e.odometer > (a.finalKm ?? Infinity) ? "Revisar: fuera del rango histórico" : "Dentro del rango histórico";
  if (isAdministrative(a)) return "Administración: sin marcación";
  if (a.initialKm === null) return "Inicio pendiente de registrar";
  if (e.odometer < a.initialKm || (a.finalKm !== null && e.odometer > a.finalKm)) return `Revisar: fuera del rango ${a.initialKm}–${a.finalKm ?? "Final pendiente"} km`;
  return a.finalKm === null ? "Final pendiente de registrar" : "Dentro del rango de la jornada";
}
export function journeyWork(a: Pick<Assignment, "coordinator" | "ceco">, phase: "INICIO" | "FINAL", input: { coordinator: string; ceco: string }) {
  const coordinator = (phase === "FINAL" && a.coordinator ? a.coordinator : input.coordinator).trim();
  const ceco = (phase === "FINAL" && a.ceco ? a.ceco : input.ceco).trim();
  if (!coordinator || !ceco) throw new Error("Indica el coordinador y el CECO del trabajo.");
  return { coordinator, ceco };
}
export function stationDistance(s: Station, lat: number, lon: number) {
  if (s.latitude === null || s.longitude === null || !s.verified) return Infinity;
  const rad = Math.PI / 180, dlat = (s.latitude - lat) * rad, dlon = (s.longitude - lon) * rad;
  const v = Math.sin(dlat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(s.latitude * rad) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
