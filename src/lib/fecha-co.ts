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

// ---------------------------------------------------------------------------
// Instantes (partidos) en hora de Colombia, SIN Intl.
// ---------------------------------------------------------------------------
// `Intl.DateTimeFormat` da textos distintos en Node y en cada navegador (ICU:
// "11 de nov" vs "11 nov", espacios especiales en "p. m."). En componentes que
// se renderizan en el servidor eso rompe la hidratación de React. Aquí el texto
// se arma a mano: es idéntico en todos lados. Colombia es UTC−5 todo el año.

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Partes de un instante en hora de Colombia. */
function partesCO(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return {
    diaSemana: d.getUTCDay(),
    dia: d.getUTCDate(),
    mes: d.getUTCMonth(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
  };
}

/** "2026-11-12T00:00:00Z" → "mié 11 nov, 7:00 p. m." */
export function formatFechaHoraCO(iso: string): string {
  const p = partesCO(iso);
  const h12 = p.hora % 12 === 0 ? 12 : p.hora % 12;
  const ampm = p.hora < 12 ? "a. m." : "p. m.";
  return `${DIAS_CORTOS[p.diaSemana]} ${p.dia} ${MESES_CORTOS[p.mes]}, ${h12}:${String(p.minuto).padStart(2, "0")} ${ampm}`;
}

/** Día de calendario "YYYY-MM-DD" → "Miércoles 11 nov" (o "11 nov" con `corto`). */
export function formatDiaCO(fecha: string, opts: { corto?: boolean } = {}): string {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const base = `${d} ${MESES_CORTOS[m - 1]}`;
  if (opts.corto) return base;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const nombre = DIAS[dow];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${base}`;
}
