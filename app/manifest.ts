import type { MetadataRoute } from "next";

/** Manifest PWA: permite "Agregar a inicio" (requisito de push en iOS). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rifas — organiza y vende tu rifa",
    short_name: "Rifas",
    description:
      "Crea tu rifa, comparte el enlace en vivo y lleva el control de quién pagó.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1115",
    theme_color: "#0F1115",
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
