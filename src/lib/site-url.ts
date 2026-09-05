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
export function urlPublicaRifa(slug: string, numeros?: number[]): string {
  const base = `${SITE_URL}/r/${slug}`;
  if (!numeros || numeros.length === 0) return base;
  // `?n=` hace que la página abra con esos números marcados y el pago a la vista:
  // el comprador no tiene que buscar cuáles eran los suyos.
  return `${base}?n=${[...numeros].sort((a, b) => a - b).join(",")}`;
}
