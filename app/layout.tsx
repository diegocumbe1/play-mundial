import type { Metadata } from "next";
import { Bebas_Neue, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";

// Cuerpo y UI: limpia, legible (fuente variable).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Títulos: condensada y deportiva, estilo marcador de estadio (peso único).
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${bebas.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-polla-dark min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
