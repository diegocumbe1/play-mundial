/**
 * Códigos de error que cruzan la frontera servidor ↔ cliente.
 *
 * Viven aquí y no en las Server Actions porque un archivo `"use server"` solo
 * puede exportar funciones async: una constante exportada ahí rompe el build
 * entero. Este módulo es neutro, así que lo importan ambos lados.
 */

/** Falta verificar el correo del organizador para tocar números de una rifa. */
export const EMAIL_VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";

/** ¿El error que devolvió una acción es el de "falta verificar el correo"? */
export function esErrorDeVerificacion(error?: string): boolean {
  return Boolean(error?.includes(EMAIL_VERIFICATION_REQUIRED));
}
