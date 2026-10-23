import type { vehicleReport } from "../../lib/fleet-report";
import { Badge, Table } from "./FleetUI";

type Row = ReturnType<typeof vehicleReport>;
const km = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value);

export function MileageComparison({ rows }: { rows: Row[] }) {
  const issues = rows.flatMap(r => r.odometers.issues.map(issue => ({ plate: r.v.plate, ...issue })));
  return <>
    <section className="fl-panel">
      <div className="fl-panel-head"><div><h2>Comparación de kilometraje</h2><p>Operaciones se calcula con jornadas cerradas e históricas; Administración con el odómetro de combustible. Las dos mediciones se conservan para comparar.</p></div></div>
      <Table heads={["Vehículo", "Primera lectura de combustible", "Última lectura de combustible", "Km entre abastecimientos", "Km de jornadas cerradas", "Control"]} rows={rows.map(r => [
        <div key="plate"><strong>{r.v.plate}</strong><small>Base: {r.source === "JORNADAS" ? "jornadas" : "odómetro"}</small></div>,
        r.odometers.first ? <>{km(r.odometers.first.odometer)} km<small>{r.odometers.first.date} {r.odometers.first.source?.time}</small></> : "—",
        r.odometers.last ? <>{km(r.odometers.last.odometer)} km<small>{r.odometers.last.date} {r.odometers.last.source?.time}</small></> : "—",
        km(r.odometers.km), km(r.journeyKm),
        <><Badge>{r.odometers.status}</Badge><small>{r.odometers.readings.length} abastecimientos{r.missing ? " · cierre de jornada pendiente" : ""}</small></>,
      ])} />
      <p className="fl-mileage-note">El recorrido de combustible es el último odómetro menos el primero dentro de las fechas seleccionadas. No cubre los trayectos anteriores ni posteriores a esas lecturas. Las jornadas suman Inicio–Final de los cierres y registros históricos del periodo y pueden cubrir otros horarios. Costo/km y km/gal son estimaciones del periodo; no representan consumo medido entre tanques llenos.</p>
    </section>
    {issues.length > 0 && <section className="fl-panel"><div className="fl-panel-head"><div><h2>Odómetros por revisar</h2><p>En Administración, estos errores dejan los kilómetros pendientes. En Operaciones, las jornadas siguen siendo la base del cálculo. Se conserva el valor original del archivo.</p></div></div>
      <Table heads={["Vehículo", "Fecha / hora", "Lectura anterior", "Lectura reportada", "Motivo", "Archivo / fila"]} rows={issues.map(i => [i.plate, <>{i.reading.date}<small>{i.reading.source?.time}</small></>, i.previous ? <>{km(i.previous.odometer)} km<small>{i.previous.date} {i.previous.source?.time}</small></> : "—", `${km(i.reading.odometer)} km`, i.reason, <>{i.reading.source?.file || "Registro manual"}<small>{i.reading.source ? `${i.reading.source.sheet} · fila ${i.reading.source.row}` : i.reading.reference}</small></>])} />
    </section>}
  </>;
}
