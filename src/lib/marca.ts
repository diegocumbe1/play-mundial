/**
 * Marca madre de la plataforma.
 *
 * Existe para que el nombre viva en UN solo sitio. Antes estaba escrito a mano
 * en tres lugares con tres nombres distintos ("Polla Mundial 2026" en el header
 * público, "Play Mundial" en el del panel, "Rifas" en los metadatos), que es
 * justo como se pierde la confianza: el comprador llega por un enlace de
 * WhatsApp y ve una marca que no coincide con la que le compartieron.
 *
 * Ojo con el co-branding: en la página pública de una rifa la estrella es el
 * ORGANIZADOR (su nombre, su premio). La plataforma firma discreta abajo — en
 * el plan gratis esa firma es el motor de difusión.
 */
export const MARCA = {
  /** Nombre corto. Es lo que se dicta por WhatsApp: fácil de oír y escribir. */
  nombre: "Rifamos",
  /** Debajo del nombre, en header y pie. Máximo una línea. */
  tagline: "Tu rifa lista en minutos",
  /** La promesa, para landing y metadatos. */
  promesa:
    "Arma tu rifa, compártela por WhatsApp y lleva el control de quién pagó. Tú cobras, sin comisiones por venta.",
  /** Firma en el flyer y en el pie de la página pública. */
  firma: "Hecho con Rifamos",
} as const;
