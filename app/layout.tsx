import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Toaster } from "@/components/ui/sonner";
import { getIdioma } from "@/lib/idioma-server";

// Cuerpo y UI: limpia, legible (fuente variable).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Títulos: condensada y deportiva, estilo marcador de estadio (peso único).
// `fallback` condensado + `adjustFontFallback` reducen el "salto/zoom" en la
// primera carga: antes de que cargue Bebas se usa una fuente de ancho parecido.
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polla Mundial 2026",
  description:
    "Pronostica. Compite. Gana. El que más acierte el marcador exacto se lleva el premio del Mundial 2026.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0f",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const idioma = await getIdioma();

  return (
    <html
      lang={idioma}
      className={`dark ${inter.variable} ${bebas.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Padding inferior en mobile para que la barra fija no tape el contenido. */}
      <body className="bg-polla-dark flex min-h-full flex-col pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] sm:pb-0">
        <PullToRefresh />
        {children}
        <BottomNav idioma={idioma} />
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
