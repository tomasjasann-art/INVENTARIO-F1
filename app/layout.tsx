import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { isClerkConfigured } from "./deployment-config";

export const metadata: Metadata = {
  title: "Logística F1 · Control de Equipos Entel",
  description: "Plataforma modular para solicitudes, inventario, trazabilidad, conciliación y auditoría logística.",
  applicationName: "Logística F1",
  appleWebApp: { capable: true, title: "Logística F1", statusBarStyle: "black-translucent" },
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (() => {
            let preference;
            try { preference = localStorage.getItem("f1-theme"); } catch {}
            const theme = preference === "dark" || preference === "light"
              ? preference
              : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
            document.documentElement.dataset.f1Theme = theme;
            document.documentElement.style.colorScheme = theme;
          })();
        ` }} />
      </head>
      <body className="antialiased">{content}</body>
    </html>
  );
}
