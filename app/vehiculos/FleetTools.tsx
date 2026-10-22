"use client";
import { useMemo, useState } from "react";
import { LocateFixed, MapPin, Navigation, Plus, Search } from "lucide-react";
import { stationDistance, type Station } from "../../lib/fleet";
import { filterStations, stationCoordinates, stationLinks, stationPlaces, stationText } from "../../lib/fleet-stations";
import { Badge, Empty } from "./FleetUI";

export function StationsPanel({ stations, manager, onEdit, onAdd }: { stations: Station[]; manager: boolean; onEdit: (s: Record<string, unknown>) => void; onAdd: () => void }) {
  const [search, setSearch] = useState(""), [fuel, setFuel] = useState(""), [region, setRegion] = useState(""), [district, setDistrict] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null), [location, setLocation] = useState<{ lat: number; lon: number } | null>(null), [error, setError] = useState("");
  const filtered = useMemo(() => filterStations(stations, { search, fuel, region, district }, location), [stations, search, fuel, region, district, location]);
  const regions = stationPlaces(stations.map(s => s.region));
  const districts = stationPlaces(stations.filter(s => !region || stationText(s.region) === stationText(region)).map(s => s.district));
  const selected = filtered.find(s => s.id === selectedId) || filtered[0];
  const links = selected ? stationLinks(selected) : null;
  const verified = selected ? stationCoordinates(selected) : false;
  function locate() {
    setError("");
    if (!filtered.some(stationCoordinates)) { setError("Estos puntos tienen dirección del proveedor, pero aún no coordenadas verificadas para calcular cercanía. Busca por distrito y usa Cómo llegar."); return; }
    if (!navigator.geolocation) { setError("Tu dispositivo no ofrece ubicación. Puedes buscar por distrito o ciudad."); return; }
    navigator.geolocation.getCurrentPosition(p => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setError("No se obtuvo la ubicación. Puedes permitirla en el navegador o buscar manualmente."), { timeout: 12000, maximumAge: 60000 });
  }
  return <section className="fl-panel"><div className="fl-panel-head"><div><h2>Abastecimiento en convenio</h2><p>Busca en el listado del proveedor por estación, departamento, distrito o dirección.</p></div>{manager && <button className="fl-btn fl-primary" onClick={onAdd}><Plus size={16} />Agregar punto</button>}</div>
    <div className="fl-station-tools"><label className="fl-search"><Search size={17} /><input aria-label="Buscar punto de abastecimiento" placeholder="Estación, dirección o lugar…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <label className="fl-station-filter">Departamento<select value={region} onChange={e => { setRegion(e.target.value); setDistrict(""); }}><option value="">Todos</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
    <label className="fl-station-filter">Distrito<select value={district} onChange={e => setDistrict(e.target.value)}><option value="">Todos</option>{districts.map(d => <option key={d}>{d}</option>)}</select></label>
    <input className="fl-input" aria-label="Filtrar combustible" placeholder="Combustible registrado…" value={fuel} onChange={e => setFuel(e.target.value)} /><button className="fl-btn" onClick={locate}><LocateFixed size={16} />Cerca de mí</button></div>
    <p className="fl-muted fl-pad" role="status">{filtered.length} de {stations.length} estaciones{location && " · Cercanía disponible solo para coordenadas verificadas"}. El mapa por dirección debe comprobarse antes de viajar. Confirma horarios y disponibilidad de combustible.</p>
    {error && <p className="fl-error" role="alert">{error}</p>}
    {!stations.length ? <Empty text={manager ? "Agrega los puntos del convenio para que los conductores puedan consultarlos." : "Logística aún no ha registrado los puntos de abastecimiento."} /> : <div className="fl-map-layout"><div className="fl-station-list">{filtered.length ? filtered.map(s => { const dist = location ? stationDistance(s, location.lat, location.lon) : Infinity; return <article className={`fl-station-card ${selected?.id === s.id ? "fl-selected" : ""}`} key={s.id}>
      <button aria-label={`Ver mapa de ${s.name}, ${s.district}`} aria-pressed={selected?.id === s.id} onClick={() => setSelectedId(s.id)}><MapPin size={20} /><div><strong>{s.name}</strong><p>{s.address}</p><small>{[s.district, s.city, s.region].filter(Boolean).join(" · ")}</small></div></button>
      <p>{s.provider} · {s.fuels || "Combustibles por confirmar"}</p>{s.hours && <small>Horario: {s.hours}</small>}{s.restrictions && <small>{s.restrictions}</small>}{s.source && <small>Fuente: {s.source.network} · PDF, página {s.source.page}</small>}
      <div className="fl-row-actions"><Badge>{!s.active ? "INACTIVO" : stationCoordinates(s) ? "Coordenadas verificadas" : "Dirección del proveedor"}</Badge>{Number.isFinite(dist) && <small>{dist.toFixed(1)} km en línea recta</small>}<a className="fl-text-btn" target="_blank" rel="noreferrer" href={stationLinks(s).directions}>Cómo llegar</a>{manager && <button className="fl-text-btn" onClick={() => onEdit({ ...s })}>Editar</button>}</div>
    </article>; }) : <Empty text="No hay estaciones que coincidan con tu búsqueda." />}</div>
    <div className="fl-map">{selected && links ? <><iframe key={selected.id} title={`Mapa de ${selected.name}`} loading="lazy" referrerPolicy="no-referrer" src={links.embed} /><div className="fl-map-caption"><div><strong>{selected.name}</strong><small>{selected.address}</small><small>{verified ? "Coordenadas verificadas por Logística" : "Búsqueda por dirección del proveedor · punto exacto por verificar"}</small><a className="fl-text-btn" target="_blank" rel="noreferrer" href={links.search}>Abrir en Google Maps</a></div><a className="fl-btn fl-primary" target="_blank" rel="noreferrer" href={links.directions}><Navigation size={16} />Cómo llegar</a></div></> : <Empty text="Busca o selecciona una estación para ver su mapa." />}</div></div>}
  </section>;
}

export { ImportPanel } from "./FleetImportPanel";
