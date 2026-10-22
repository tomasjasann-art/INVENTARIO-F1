export function GET() {
  return Response.json({
    id: "/conductores", name: "F1 Conductores · Control de vehículos", short_name: "F1 Conductores",
    description: "Inicio y Final de jornada, kilometraje y fotografías del vehículo.", lang: "es-PE",
    start_url: "/conductores", scope: "/", display: "standalone", background_color: "#f4f7fb", theme_color: "#182b43",
    icons: [
      { src: "/driver-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/driver-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
