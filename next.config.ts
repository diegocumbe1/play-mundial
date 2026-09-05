import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las imágenes de la rifa (foto del premio, fondo) y el QR de pago se suben
    // por Server Action, y el tope por defecto es 1 MB: una foto de celular lo
    // pasa y Next responde 413 antes de llegar al código. El cliente ya las
    // reduce (ver `src/lib/imagen.ts`); esto es solo el colchón. Se queda por
    // debajo de los 4,5 MB que admite una función serverless en Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      // Logos de equipos/banderas de API-Football.
      { protocol: "https", hostname: "media.api-sports.io" },
      // Escudos de football-data.org (muchos en formato SVG).
      { protocol: "https", hostname: "crests.football-data.org" },
      // Escudos/banderas de flashscore (vivo, bracket).
      { protocol: "https", hostname: "static.flashscore.com" },
    ],
    // football-data.org sirve escudos como SVG; next/image los rechaza por
    // defecto. Las URLs son de un dominio confiable y de solo lectura.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
  async headers() {
    return [
      {
        // El service worker no debe cachearse: servir siempre la última versión.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
