/** URL pública canónica. Configúrala en producción sin barra final. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-mundial.uselynko.com"
).replace(/\/+$/, "");
