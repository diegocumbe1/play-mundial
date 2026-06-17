import type { MetadataRoute } from "next";

/** Manifest PWA: permite "Agregar a inicio" (requisito de push en iOS). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Polla Mundial 2026",
    short_name: "Polla Mundial",
    description: "Pronostica el marcador exacto de cada partido y gana.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
