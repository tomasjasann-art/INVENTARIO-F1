import type { Expense, ImportChange } from "./fleet";

type FuelRow = Pick<Expense, "vehicleId" | "date" | "amountCents" | "quantity" | "unit" | "fuel" | "unitPrice" | "odometer" | "provider" | "reference" | "source">;
export const FUEL_FIELDS = { vehicleId: "Placa", date: "Fecha", amountCents: "Importe", quantity: "Volumen", unit: "Unidad", fuel: "Combustible", unitPrice: "Precio unitario", odometer: "Odómetro", provider: "Proveedor", reference: "Comprobante / referencia" } as const;

// File name, sheet and row position identify provenance, not a business change.
export function fuelImportValues(row: FuelRow) {
  return { ...Object.fromEntries(Object.keys(FUEL_FIELDS).map(key => [key, row[key as keyof typeof FUEL_FIELDS] ?? null])), time: row.source?.time || "", station: row.source?.station || "", voucher: row.source?.voucher || "", voucherDate: row.source?.voucherDate || "" };
}
export function fuelImportChanges(previous: FuelRow, next: FuelRow): ImportChange[] {
  const before = fuelImportValues(previous), after = fuelImportValues(next);
  const labels: Record<string, string> = { ...FUEL_FIELDS, time: "Hora", station: "Estación", voucher: "Comprobante del proveedor", voucherDate: "Fecha de comprobante" };
  return Object.keys(after).flatMap(field => {
    const oldValue = before[field as keyof typeof before] as string | number | null, newValue = after[field as keyof typeof after] as string | number | null;
    const equal = typeof oldValue === "number" && typeof newValue === "number" ? Math.abs(oldValue - newValue) <= 1e-9 : oldValue === newValue;
    return equal ? [] : [{ field, label: labels[field], before: oldValue, after: newValue }];
  });
}
export function fuelImportPatch(previous: FuelRow, next: FuelRow, actor: string, at: string) {
  const values = Object.fromEntries(Object.keys(FUEL_FIELDS).map(key => [key, next[key as keyof typeof FUEL_FIELDS]])) as Omit<FuelRow, "source">;
  return { ...values, source: { ...next.source!, corrections: [...(previous.source?.corrections || []), { at, by: actor, changes: fuelImportChanges(previous, next) }] } };
}
