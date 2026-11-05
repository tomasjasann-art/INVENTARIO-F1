import { assignmentStatus, distance, fleetTimestamp, PHOTO_SLOTS, type JourneyReportData } from "./fleet";
import { fleetImage } from "./fleet-photo-watermark";

type Pdf = {
  setFont(name: string, style: string): void; setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void; setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void; line(x: number, y: number, x2: number, y2: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  text(value: string | string[], x: number, y: number, options?: { align: "right" | "center" }): void;
  splitTextToSize(value: string, width: number): string[];
  addImage(data: string, format: string, x: number, y: number, width: number, height: number): void;
  addPage(): void; setPage(page: number): void; getNumberOfPages(): number;
  setProperties(properties: { title: string; author: string }): void; save(filename: string): void;
};
export type PdfConstructor = new (options: { unit: string; format: string; compress: boolean }) => Pdf;
export type ReportImage = { data: string; width: number; height: number };
let pdfPromise: Promise<PdfConstructor> | undefined;
function pdfConstructor() {
  const loaded = (window as Window & { jspdf?: { jsPDF: PdfConstructor } }).jspdf?.jsPDF;
  if (loaded) return Promise.resolve(loaded);
  if (!pdfPromise) pdfPromise = new Promise<PdfConstructor>((resolve, reject) => {
    const script = document.createElement("script"), timer = setTimeout(() => { script.remove(); reject(new Error("No se pudo cargar el generador PDF. Vuelve a intentar.")); }, 20000);
    script.src = "/vendor/jspdf-4.2.1.umd.min.js";
    script.onload = () => {
      clearTimeout(timer);
      const pdf = (window as Window & { jspdf?: { jsPDF: PdfConstructor } }).jspdf?.jsPDF;
      if (pdf) resolve(pdf); else { script.remove(); reject(new Error("El generador PDF no está disponible.")); }
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("No se pudo cargar el generador PDF.")); };
    document.head.appendChild(script);
  }).catch(error => { pdfPromise = undefined; throw error; });
  return pdfPromise;
}
async function reportImage(url: string): Promise<ReportImage> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new Error("Imagen no disponible.");
  const image = await fleetImage(await response.blob()), width = Math.min(1600, image.naturalWidth), height = Math.round(image.naturalHeight * width / image.naturalWidth);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  try {
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No se pudo procesar la evidencia.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
    return { data: canvas.toDataURL("image/jpeg", .85), width, height };
  } finally { canvas.width = 0; canvas.height = 0; }
}
const clean = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replaceAll("→", " / ").trim() || "Sin registro";

export async function createJourneyPdf(report: JourneyReportData, Constructor: PdfConstructor, loadImage: (url: string) => Promise<ReportImage> = reportImage) {
  const doc = new Constructor({ unit: "mm", format: "a4", compress: true }), a = report.assignment;
  const logo = await loadImage("/f1-services-logo-horizontal.png");
  doc.setProperties({ title: "Jornada " + report.vehicle.plate + " - " + a.serviceDate, author: "Logística F1" });
  function header(title: string) {
    doc.addImage(logo.data, "JPEG", 14, 10, 38, 38 * logo.height / logo.width);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 42, 72); doc.text(title, 58, 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(report.vehicle.plate + " · " + a.serviceDate + " · Jornada #" + a.id, 58, 23);
    doc.setDrawColor(250, 104, 24); doc.setLineWidth(.7); doc.line(14, 30, 196, 30);
  }
  function page(title: string) { doc.addPage(); header(title); }
  header("Recepción y entrega del vehículo");
  let y = 40;
  function ensure(height: number) { if (y + height > 278) { page("Detalle de la jornada"); y = 40; } }
  function field(label: string, value: unknown) {
    ensure(13); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(82, 99, 121); doc.text(label.toUpperCase(), 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 42, 72);
    for (const line of doc.splitTextToSize(clean(value), 180)) { ensure(5); doc.text(line, 14, y); y += 4.5; }
    y += 4;
  }
  field("Conductor", report.driverName); field("Vehículo", report.vehicle.plate + " · " + report.vehicle.brand + " " + report.vehicle.model);
  field("Estado", assignmentStatus(a)); field("Coordinador / CECO", clean(a.coordinator) + " / " + clean(a.ceco));
  field("Site inicial", a.site); field("Zona final de entrega", a.finalZone);
  field("Kilometraje inicial / final / recorrido", clean(a.initialKm) + " / " + clean(a.finalKm) + " / " + (a.endedAt || a.trackingMode === "HISTORICO" ? distance(a) + " km" : "Cierre pendiente"));
  field("Inicio (hora de Perú)", fleetTimestamp(a.startedAt)); field("Final (hora de Perú)", fleetTimestamp(a.endedAt));
  field("Observaciones / fallas al Inicio", a.startNotes || "Sin observaciones registradas.");
  field("Observaciones / fallas al Final", a.endNotes || "Sin observaciones registradas.");
  if (a.notes) field("Indicaciones de trabajo", a.notes);
  for (const phase of [
    { title: "Inicio - recepción", photos: report.startPhotos },
    { title: "Final - entrega", photos: report.endPhotos },
  ]) {
    if (!phase.photos.length) continue;
    for (let i = 0; i < PHOTO_SLOTS.length; i++) {
      if (i % 4 === 0) page(phase.title);
      const photo = phase.photos.find(p => p.slot === PHOTO_SLOTS[i]), x = 14 + (i % 2) * 94, top = 40 + Math.floor((i % 4) / 2) * 118;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(20, 42, 72); doc.text((i + 1) + ". " + PHOTO_SLOTS[i], x, top);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.text(photo?.registeredAt ? fleetTimestamp(photo.registeredAt) + " (Perú)" : "Foto anterior: sin hora individual registrada", x, top + 5);
      doc.setDrawColor(220, 227, 235); doc.setLineWidth(.2); doc.rect(x, top + 9, 88, 101);
      if (photo) {
        if (!photo.url) throw new Error("No se pudo descargar " + phase.title + ": " + PHOTO_SLOTS[i] + ". Actualiza y vuelve a intentar.");
        let image: ReportImage;
        try { image = await loadImage(photo.url); }
        catch { throw new Error("No se pudo descargar " + phase.title + ": " + PHOTO_SLOTS[i] + ". Revisa la conexión y vuelve a intentar."); }
        const scale = Math.min(86 / image.width, 99 / image.height), w = image.width * scale, h = image.height * scale;
        doc.addImage(image.data, "JPEG", x + (88 - w) / 2, top + 10 + (99 - h) / 2, w, h);
      } else { doc.setFontSize(8); doc.text("Sin fotografía registrada", x + 44, top + 60, { align: "center" }); }
    }
  }
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 113, 130);
    doc.text("Logística F1 · Emitido: " + fleetTimestamp(report.generatedAt) + " (Perú)", 14, 290);
    doc.text(i + " / " + count, 196, 290, { align: "right" });
  }
  return doc;
}
export async function downloadJourneyPdf(report: JourneyReportData) {
  const Constructor = await pdfConstructor(), doc = await createJourneyPdf(report, Constructor);
  doc.save("Jornada_F1_" + report.vehicle.plate.replace(/[^A-Z0-9]/gi, "") + "_" + report.assignment.serviceDate + ".pdf");
}
