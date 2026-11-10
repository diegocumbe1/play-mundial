/**
 * Números y pesos colombianos SIN Intl.
 *
 * `Intl.NumberFormat` / `toLocaleString` dependen de la versión de ICU de Node
 * y de cada navegador (espacios especiales, agrupación). En componentes que se
 * renderizan en el servidor una diferencia rompe la hidratación de React. Aquí
 * el texto se arma a mano y es idéntico en todos lados, con el mismo formato
 * que daba es-CO: miles con punto, decimales con coma, "$ 200.000" (con espacio
 * no separable, U+00A0, para que nunca se parta en dos líneas).
 */

const NBSP = " ";

/**
 * 1200000 → "1.200.000"; 12.5 con 1 decimal → "12,5". Redondea como Intl.
 * Por defecto hasta 3 decimales, igual que `toLocaleString("es-CO")`.
 */
export function formatMiles(valor: number, decimales = 3): string {
  if (!Number.isFinite(valor)) return String(valor);
  const negativo = valor < 0;
  const factor = 10 ** decimales;
  const redondeado = Math.round(Math.abs(valor) * factor) / factor;
  const [entero, frac = ""] = redondeado.toFixed(decimales).split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Como Intl con maximumFractionDigits: sin ceros sobrantes ("12,5", no "12,50").
  const fraccion = frac.replace(/0+$/, "");
  return `${negativo && redondeado !== 0 ? "-" : ""}${miles}${fraccion ? `,${fraccion}` : ""}`;
}

/** 1200000 → "$ 1.200.000"; -5000 → "-$ 5.000". Sin decimales. */
export function formatCOP(valor: number): string {
  const texto = formatMiles(Math.abs(valor), 0);
  return `${valor < 0 && Math.round(valor) !== 0 ? "-" : ""}$${NBSP}${texto}`;
}
