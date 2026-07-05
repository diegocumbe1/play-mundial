import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

/** Rutas públicas que deben aparecer en los buscadores. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/jugar`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/resultados`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/comunidad`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terminos`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
