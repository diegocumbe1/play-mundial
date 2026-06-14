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
};

export default nextConfig;
