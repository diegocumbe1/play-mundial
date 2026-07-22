/**
 * Arma un enlace de WhatsApp con mensaje prellenado.
 *
 * Normaliza el número: si viene con 10 dígitos (formato local colombiano) le
 * antepone el indicativo 57. Si ya trae indicativo, se respeta.
 */
export function waLink(telefono: string, texto: string): string {
  const digitos = telefono.replace(/\D/g, "");
  const numero = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
