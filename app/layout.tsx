import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kardex F1 Logística",
  description: "Control de ingresos, salidas, stock y trazabilidad logística.",
  applicationName: "Kardex F1",
  appleWebApp: { capable: true, title: "Kardex F1", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
