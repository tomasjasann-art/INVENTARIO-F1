import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kardex F1 Logística",
    short_name: "Kardex F1",
    description: "Ingresos, salidas, stock, trazabilidad, conciliación y auditoría logística F1.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f36c21",
    orientation: "any",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
