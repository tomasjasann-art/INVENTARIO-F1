import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Logística F1 · Control de Equipos Entel",
    short_name: "Logística F1",
    description: "Plataforma modular de control logístico F1. Módulo activo: Control de Equipos Entel.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f36c21",
    orientation: "any",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
