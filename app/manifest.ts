import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Logística F1 · Equipos y vehículos",
    short_name: "Logística F1",
    description: "Inventario, vehículos y seguimiento de jornadas de Logística F1.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f36c21",
    orientation: "any",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
