import { fleetTimestamp } from "./fleet";

export async function fleetImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try { const image = new Image(); image.src = url; await image.decode(); return image; }
  finally { URL.revokeObjectURL(url); }
}
let logoPromise: Promise<HTMLImageElement> | undefined;
export function fleetLogo() {
  if (!logoPromise) logoPromise = fetch("/f1-services-logo-horizontal.png").then(async response => {
    if (!response.ok) throw new Error("No se pudo cargar el logo F1. Vuelve a intentar.");
    return fleetImage(await response.blob());
  }).catch(error => { logoPromise = undefined; throw error; });
  return logoPromise;
}

export async function watermarkFleetPhoto(blob: Blob, context: { registeredAt: string; plate: string; phase: string; slot: string }) {
  if (!context.plate || !Number.isFinite(Date.parse(context.registeredAt))) throw new Error("No se pudo confirmar la fecha de registro. Vuelve a cargar la foto.");
  const [image, logo] = await Promise.all([fleetImage(blob), fleetLogo()]);
  const width = Math.max(720, Math.min(1800, image.naturalWidth));
  const height = Math.round(image.naturalHeight * width / image.naturalWidth), band = Math.max(110, Math.round(width * .1));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height + band;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo preparar la marca de agua.");
  // Add a footer without covering or cropping any part of the evidence.
  ctx.drawImage(image, 0, 0, width, height);
  ctx.fillStyle = "#142a48"; ctx.fillRect(0, height, width, band);
  ctx.fillStyle = "#fa6818"; ctx.fillRect(0, height, width, 4);
  const panel = Math.round(width * .24), pad = Math.round(width * .015);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, height + 4, panel, band - 4);
  const scale = Math.min((panel - pad * 2) / logo.naturalWidth, (band - pad * 2) / logo.naturalHeight);
  ctx.drawImage(logo, pad, height + (band - logo.naturalHeight * scale) / 2, logo.naturalWidth * scale, logo.naturalHeight * scale);
  ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.round(width * .022) + "px Arial";
  ctx.fillText(context.plate + " · " + context.phase + " · " + context.slot, panel + pad, height + band * .36, width - panel - pad * 2);
  ctx.font = Math.round(width * .019) + "px Arial";
  ctx.fillText("Registro: " + fleetTimestamp(context.registeredAt) + " (Perú)", panel + pad, height + band * .72, width - panel - pad * 2);
  try {
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("No se pudo guardar la marca de agua.")), "image/jpeg", .86));
  } finally { canvas.width = 0; canvas.height = 0; }
}
