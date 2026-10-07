import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { isClerkConfigured } from "./deployment-config";

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
  const content = isClerkConfigured()
    ? <ClerkProvider>{children}</ClerkProvider>
    : children;

  return (
    <html lang="es">
      <body className="antialiased">{content}</body>
    </html>
  );
}
