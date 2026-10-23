import { DOCUMENT_KINDS, DOCUMENT_LABELS, activeDrivers, limaDate, type FleetData } from "../../lib/fleet";
import type { FieldSpec, FormSpec } from "./FleetForms";
const field = (name: string, label: string, type = "text", required = false): FieldSpec => ({ name, label, type, required });
const choice = (name: string, label: string, values: string[], required = true): FieldSpec => ({ name, label, required, options: values.map(value => ({ value, label: value.replaceAll("_", " ") })) });
export function fleetForms(d: FleetData) {
  const vehicle: FieldSpec = { name: "vehicleId", label: "Placa", required: true, options: d.vehicles.map(v => ({ value: String(v.id), label: `${v.plate} · ${v.brand} ${v.model}` })) };
  const assignment: FieldSpec = { name: "assignmentId", label: "Asignación vinculada", options: d.assignments.map(a => ({ value: String(a.id), label: `${a.serviceDate} · ${d.vehicles.find(v => v.id === a.vehicleId)?.plate} · ${d.drivers.find(u => u.id === a.driverId)?.displayName || a.responsibleName || "Administración / Gerencia"}` })) };
  const invoice: FieldSpec = { name: "invoiceId", label: "Factura de combustible", options: d.invoices.map(i => ({ value: String(i.id), label: `${i.provider} · ${i.number}` })) };
  const date = field("date", "Fecha", "date", true), notes = field("notes", "Observaciones", "textarea"), provider = field("provider", "Proveedor", "text", true);
  const reference = field("reference", "N.º servicio / comprobante", "text", true);
  const forms: Record<string, FormSpec> = {
    vehicle: { title: "Datos del vehículo", action: "vehicle", values: { usage: "OPERACIONES", tenure: "PROPIO", status: "OPERATIVO", initialKm: 0, target: 30 }, fields: [field("plate", "Placa", "text", true), field("ceco", "CECO"), choice("usage", "Uso", ["OPERACIONES", "ADMINISTRACION"]), choice("tenure", "Tenencia", ["PROPIO", "ALQUILADO"]), field("category", "Categoría"), field("type", "Tipo"), field("brand", "Marca"), field("model", "Modelo"), field("engine", "N.º serie de motor"), field("chassis", "Chasis"), field("color", "Color"), field("titleDate", "Fecha de título", "date"), field("year", "Año", "number"), field("initialKm", "Kilometraje inicial de referencia", "number", true), choice("status", "Disponibilidad", ["OPERATIVO", "MANTENIMIENTO", "FUERA_SERVICIO"]), { ...field("target", "Meta km/gal", "number", true), hint: "Aplicable al rendimiento estimado de combustible líquido. GNV se muestra por separado." }, notes] },
    assignment: {
      vehicleCecos: Object.fromEntries(d.vehicles.map(v => [String(v.id), v.ceco])),
      vehicleUsages: Object.fromEntries(d.vehicles.map(v => [String(v.id), v.usage])),
      title: "Asignación diaria", action: "assignment",
      values: { serviceDate: limaDate(), endDate: limaDate(), expectedStart: "08:00", expectedEnd: "18:00", planStatus: "CONFIRMADA" },
      fields: [vehicle, field("serviceDate", "Fecha", "date", true),
        { ...field("endDate", "Fecha de Final / retorno", "date", true), operationsOnly: true },
        { name: "driverId", label: "Conductor / cuenta de acceso", required: true, operationsOnly: true,
          options: activeDrivers(d.drivers).map(u => ({ value: String(u.id), label: `${u.displayName} · ${u.username || u.role}` })),
          hint: "Crea las cuentas desde Conductores y app móvil → Crear o habilitar conductores." },
        { ...field("responsibleName", "Responsable administrativo / gerencia (opcional)"), administrationOnly: true },
        { ...field("expectedStart", "Hora prevista de Inicio", "time", true), operationsOnly: true },
        { ...field("expectedEnd", "Hora prevista de Final", "time", true), operationsOnly: true },
        { name: "coordinator", label: "Coordinador F1", options: [...new Set([...d.coordinators, ...d.assignments.map(a => a.coordinator).filter(Boolean)])].map(c => ({ value: c, label: c })) },
        field("ceco", "CECO"), field("site", "Site inicial de trabajo"), field("finalZone", "Zona final"),
        { ...choice("planStatus", "Estado de asignación", ["CONFIRMADA", "POR_CONFIRMAR", "NO_SALIO", "CANCELADA"]), operationsOnly: true },
        { ...field("reason", "Motivo de no salida / cancelación"), operationsOnly: true, hint: "Obligatorio cuando confirmas que no salió o cancelas." }, notes],
    },
    historyAssignment: { title: "Editar seguimiento histórico", action: "historyAssignment", fields: [vehicle, field("serviceDate", "Fecha", "date", true), field("responsibleName", "Conductor registrado en el archivo", "text", true), field("initialKm", "Kilometraje inicial", "number", true), field("finalKm", "Kilometraje final", "number", true), field("coordinator", "Coordinador"), field("ceco", "CECO"), field("site", "SITE"), field("collector", "Colector / referencia"), notes] },
    document: { title: "Documentación del vehículo", action: "document", uploadPurpose: "document", values: { kind: "SOAT", startDate: limaDate() }, fields: [vehicle, { name: "kind", label: "Documento", required: true, options: DOCUMENT_KINDS.map(value => ({ value, label: DOCUMENT_LABELS[value] })) }, provider, reference, field("startDate", "Inicio de vigencia", "date", true), field("expiryDate", "Vencimiento", "date", true), notes] },
    invoice: { title: "Factura de combustible", action: "invoice", uploadPurpose: "invoice", values: { issueDate: limaDate(), dueDate: limaDate() }, fields: [provider, field("number", "N.º factura", "text", true), field("issueDate", "Fecha de emisión", "date", true), field("dueDate", "Fecha de vencimiento", "date", true), field("amount", "Total factura (S/)", "number", true), notes] },
    payment: { title: "Registrar pago", action: "payment", uploadPurpose: "payment", values: { date: limaDate() }, fields: [{ ...invoice, required: true }, date, field("amount", "Importe pagado (S/)", "number", true), field("reference", "N.º operación", "text", true)] },
    idle: { title: "Ralentí diario · GPS", action: "idle", values: { date: limaDate(), time: "00:00" }, fields: [vehicle, date, { ...field("time", "Horas:minutos", "text", true), hint: "Ejemplo 01:35. Una nueva carga actualiza el dato de esa placa y fecha." }, notes] },
    station: { title: "Punto de abastecimiento", action: "station", values: { verified: false, active: true }, fields: [field("name", "Nombre de estación", "text", true), provider, field("address", "Dirección", "text", true), field("district", "Distrito"), field("city", "Ciudad / provincia"), field("region", "Departamento"), field("fuels", "Combustibles autorizados"), field("hours", "Horario informado por el proveedor"), field("restrictions", "Restricciones / indicaciones", "textarea"), field("latitude", "Latitud", "number"), field("longitude", "Longitud", "number"), { ...field("verified", "Ubicación verificada", "checkbox"), hint: "Solo las coordenadas verificadas se muestran en el mapa." }, field("active", "Punto activo en convenio", "checkbox")] },
    linkAssignment: { title: "Vincular gasto a una jornada", action: "linkAssignment", fields: [{ ...assignment, required: true }] },
    linkInvoice: { title: "Vincular despacho a factura", action: "linkInvoice", fields: [{ ...invoice, required: true }] },
  };
  for (const kind of ["COMBUSTIBLE", "PEAJE", "MANTENIMIENTO"]) {
    forms[kind] = { title: kind === "COMBUSTIBLE" ? "Abastecimiento de combustible" : kind === "PEAJE" ? "Registrar peaje" : "Registrar mantenimiento", action: "expense", uploadPurpose: "expense", values: { kind, date: limaDate(), quantity: 0, unit: "GAL", unitPrice: 0 }, fields: [vehicle, date, assignment, provider, reference, field("amount", "Importe total (S/)", "number", true), ...(kind === "COMBUSTIBLE" ? [field("fuel", "Combustible (gasolina, diésel, GLP, GNV)", "text", true), field("quantity", "Volumen abastecido", "number", true), choice("unit", "Unidad", ["GAL", "L", "M3"]), { ...field("unitPrice", "Precio unitario (S/)", "number"), hint: "Opcional: se calcula como importe / volumen." }, invoice] : []), ...(kind === "PEAJE" ? [field("collector", "Colector / estación de peaje")] : []), ...(kind !== "PEAJE" ? [field("odometer", "Odómetro (km)", "number", true)] : []), ...(kind === "MANTENIMIENTO" ? [field("maintenanceType", "Tipo de mantenimiento", "text", true), field("nextKm", "Próximo mantenimiento (km)", "number")] : []), notes] };
  }
  return forms;
}
