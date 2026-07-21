/**
 * Formateo de fechas de rifa a prueba de zona horaria.
 *
 * Las fechas de rifa son "de calendario" (día del sorteo/lotería), NO instantes.
 * Usar `new Date(iso).toLocaleDateString()` las corre un día en Colombia (UTC−5),
 * porque "2026-08-19" se interpreta como medianoche UTC. Aquí trabajamos con el
 * texto `YYYY-MM-DD` directo, sin `Date`, así siempre muestra el día correcto sin
 * importar el servidor ni el navegador.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-08-19..." → "19 de agosto de 2026" (o "19 de agosto" sin año). */
export function formatFechaCO(
  iso: string | null | undefined,
  opts: { conAnio?: boolean } = {},
): string | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return null;
  const base = `${d} de ${MESES[m - 1]}`;
  return opts.conAnio === false ? base : `${base} de ${y}`;
}
