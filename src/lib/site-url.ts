/** URL pública canónica. Configúrala en producción sin barra final. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://play-mundial.uselynko.com"
).replace(/\/+$/, "");

/**
 * Enlace público de una rifa, SIEMPRE absoluto.
 *
 * Se usa en los mensajes que salen hacia afuera (WhatsApp). No sirve `window.
 * location.origin`: esos mensajes se arman en el HTML del servidor, donde
 * `window` no existe, y el enlace salía relativo (`/r/slug`) — WhatsApp lo
 * manda como texto plano y el comprador no puede abrirlo.
 */
export function urlPublicaRifa(slug: string): string {
  return `${SITE_URL}/r/${slug}`;
}
