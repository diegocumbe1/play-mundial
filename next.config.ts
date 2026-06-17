import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Logos de equipos/banderas de API-Football.
      { protocol: "https", hostname: "media.api-sports.io" },
      // Escudos de football-data.org (muchos en formato SVG).
      { protocol: "https", hostname: "crests.football-data.org" },
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
