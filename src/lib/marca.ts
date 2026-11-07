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
  nombre: "Play Mundial",
  /** Debajo del nombre, en header y pie. Máximo una línea. */
  tagline: "Rifas y torneos en un solo lugar",
  /** La promesa, para landing y metadatos. */
  promesa:
    "Organiza rifas y torneos, compártelos por WhatsApp y lleva el control de quién pagó. Tú cobras, sin comisiones por venta.",
  /** Firma en el flyer y en el pie de la página pública. */
  firma: "Hecho con Play Mundial",
} as const;

/**
 * Símbolo de la marca: una "P" cuyo hueco es un triángulo de play. Trazo en un
 * lienzo de 64x64, con regla `evenodd` para que el triángulo quede calado.
 * `app/icon.svg` es estático y repite este trazo: si cambia, actualizar ambos.
 */
export const MARCA_SIMBOLO_PATH =
  "M16.5 10H35A15 15 0 0 1 35 40H26V51.5Q26 54 23.5 54H16.5Q14 54 14 51.5V12.5Q14 10 16.5 10ZM25 19.5Q25 17 27.2 18.18L37.8 23.82Q40 25 37.8 26.18L27.2 31.82Q25 33 25 30.5Z";
