import { stationDistance, type Station } from "./fleet";

export const stationText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function stationCoordinates(s: Station) {
  return s.verified && s.latitude !== null && s.longitude !== null && Number.isFinite(s.latitude) && Number.isFinite(s.longitude);
}
export function stationAddress(s: Station) {
  const name = /primax/i.test(s.provider) && !/primax/i.test(s.name) ? `PRIMAX ${s.name}` : s.name;
  return [name, s.address, s.district, s.city, s.region, "Perú"].filter(Boolean).join(", ");
}
export function stationLinks(s: Station) {
  const coordinates = stationCoordinates(s), address = stationAddress(s);
  const destination = coordinates ? `${s.latitude},${s.longitude}` : address;
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`,
    search: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    embed: coordinates ? `https://www.openstreetmap.org/export/embed.html?bbox=${s.longitude! - .035}%2C${s.latitude! - .025}%2C${s.longitude! + .035}%2C${s.latitude! + .025}&layer=mapnik&marker=${s.latitude}%2C${s.longitude}` : `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`,
  };
}
export function filterStations(stations: Station[], filters: { search: string; region: string; district: string; fuel: string }, location: { lat: number; lon: number } | null = null) {
  const search = stationText(filters.search), fuel = stationText(filters.fuel);
  return stations.filter(s => stationText([s.name, s.address, s.district, s.city, s.region, s.provider].join(" ")).includes(search)
    && (!filters.region || stationText(s.region) === stationText(filters.region))
    && (!filters.district || stationText(s.district) === stationText(filters.district))
    && (!fuel || stationText(s.fuels).includes(fuel)))
    .sort((a, b) => (location ? stationDistance(a, location.lat, location.lon) - stationDistance(b, location.lat, location.lon) : 0) || a.name.localeCompare(b.name));
}
export function stationPlaces(values: string[]) {
  return [...new Map(values.filter(Boolean).map(value => [stationText(value), value])).values()].sort((a, b) => a.localeCompare(b));
}
