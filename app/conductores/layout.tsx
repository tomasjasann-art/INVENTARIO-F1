import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./drivers.css";

export const metadata: Metadata = {
  title: "F1 Conductores · Inicio y Final de jornada",
  description: "Registra tu jornada, kilometraje y siete fotografías al Inicio y al Final desde tu celular.",
  applicationName: "F1 Conductores",
  manifest: "/conductores/manifest.webmanifest",
  appleWebApp: { capable: true, title: "F1 Conductores", statusBarStyle: "default" },
  icons: { icon: "/driver-icon-192.png", apple: "/driver-icon-180.png" },
};
export const viewport: Viewport = { themeColor: "#182b43" };

export default function DriversLayout({ children }: { children: ReactNode }) { return children; }
