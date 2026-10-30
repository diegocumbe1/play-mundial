import type { ReglasTorneo } from "@/lib/torneo-reglas";
import type { Encuentro, FaseEncuentro } from "@/types";

/**
 * Fixture y tabla de posiciones — núcleo PURO (sin I/O).
 *
 * - Grupos por siembra en serpiente y todos contra todos (método del círculo).
 * - Resultado de un partido a partir de sus sets.
 * - Tabla calculada (nunca guardada) con los puntos y el desempate de las reglas.
 * - Llaves de eliminación directa a partir de los clasificados.
 */

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export const ORDEN_FASES: FaseEncuentro[] = [
  "grupos",
  "octavos",
  "cuartos",
  "semifinal",
  "tercer_puesto",
  "final",
];

export function labelFase(fase: FaseEncuentro): string {
  const mapa: Record<FaseEncuentro, string> = {
    grupos: "Fase de grupos",
    octavos: "Octavos de final",
    cuartos: "Cuartos de final",
    semifinal: "Semifinales",
    tercer_puesto: "Tercer puesto",
    final: "Final",
  };
  return mapa[fase];
}

/** Primera fase de eliminación según cuántos equipos clasifican. */
export function faseEliminatoria(clasificados: number): FaseEncuentro {
  if (clasificados > 8) return "octavos";
  if (clasificados > 4) return "cuartos";
  if (clasificados > 2) return "semifinal";
  return "final";
}

/** La fase que sigue en la llave. */
export function siguienteFase(fase: FaseEncuentro): FaseEncuentro | null {
  if (fase === "octavos") return "cuartos";
  if (fase === "cuartos") return "semifinal";
  if (fase === "semifinal") return "final";
  return null;
}

// ---------------------------------------------------------------------------
// Grupos y cruces
// ---------------------------------------------------------------------------
/**
 * Reparte equipos en grupos de `porGrupo` como máximo, en serpiente
 * (A B C D D C B A…) para que los cabezas de serie queden separados.
 */
export function armarGrupos<T>(equipos: T[], porGrupo = 4): { nombre: string; equipos: T[] }[] {
  const cantidad = Math.max(1, Math.ceil(equipos.length / porGrupo));
  const grupos = Array.from({ length: cantidad }, (_, i) => ({
    nombre: String.fromCharCode(65 + i),
    equipos: [] as T[],
  }));
  equipos.forEach((e, i) => {
    const vuelta = Math.floor(i / cantidad);
    const pos = i % cantidad;
    grupos[vuelta % 2 === 0 ? pos : cantidad - 1 - pos].equipos.push(e);
  });
  return grupos;
}

/** Todos contra todos (método del círculo): una lista de jornadas con sus cruces. */
export function todosContraTodos<T>(equipos: T[]): [T, T][][] {
  const lista: (T | null)[] = [...equipos];
  if (lista.length % 2 === 1) lista.push(null); // descansa quien cae con null
  const n = lista.length;
  const jornadas: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const cruces: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i];
      const b = lista[n - 1 - i];
      if (a != null && b != null) cruces.push([a, b]);
    }
    jornadas.push(cruces);
    // Rota todos menos el primero.
    lista.splice(1, 0, lista.pop()!);
  }
  return jornadas;
}

/**
 * Cruces de la primera ronda de eliminación: 1° de un grupo contra 2° de otro,
 * evitando que se repita un cruce de la fase de grupos.
 */
export function crucesEliminatoria<T>(
  primeros: T[],
  segundos: T[],
): [T, T][] {
  const n = primeros.length;
  return primeros.map((p, i) => [p, segundos[(n - 1 - i + n) % n]] as [T, T]);
}

// ---------------------------------------------------------------------------
// Resultados y tabla
// ---------------------------------------------------------------------------
export interface ResultadoPartido {
  setsA: number;
  setsB: number;
  puntosA: number;
  puntosB: number;
  ganador: "a" | "b" | null;
}

/** Sets y puntos de cada lado. Gana quien tenga más sets (solo si finalizó). */
export function resultadoPartido(
  e: Pick<Encuentro, "sets" | "estado" | "ganador_id" | "equipo_a_id">,
): ResultadoPartido {
  let setsA = 0;
  let setsB = 0;
  let puntosA = 0;
  let puntosB = 0;
  for (const [a, b] of e.sets) {
    puntosA += a;
    puntosB += b;
    if (a > b) setsA += 1;
    else if (b > a) setsB += 1;
  }
  let ganador: "a" | "b" | null = null;
  if (e.estado === "finalizado" || e.estado === "wo") {
    if (e.ganador_id) ganador = e.ganador_id === e.equipo_a_id ? "a" : "b";
    else if (setsA !== setsB) ganador = setsA > setsB ? "a" : "b";
  }
  return { setsA, setsB, puntosA, puntosB, ganador };
}

export interface FilaTabla {
  equipoId: string;
  pj: number;
  pg: number;
  pp: number;
  setsFavor: number;
  setsContra: number;
  puntosFavor: number;
  puntosContra: number;
  pts: number;
}

const cociente = (a: number, b: number) => (b === 0 ? (a > 0 ? Infinity : 0) : a / b);

/**
 * Tabla de un grupo. Puntos de tabla según las reglas (victoria / derrota /
 * W.O.) y desempate: puntos, partidos ganados, cociente de sets, cociente de
 * puntos y, entre dos empatados, quién ganó el partido entre ellos.
 */
export function calcularTabla(
  equipoIds: string[],
  encuentros: Pick<Encuentro, "equipo_a_id" | "equipo_b_id" | "sets" | "estado" | "ganador_id">[],
  tabla: ReglasTorneo["tabla"],
): FilaTabla[] {
  const filas = new Map<string, FilaTabla>(
    equipoIds.map((id) => [
      id,
      { equipoId: id, pj: 0, pg: 0, pp: 0, setsFavor: 0, setsContra: 0, puntosFavor: 0, puntosContra: 0, pts: 0 },
    ]),
  );
  const jugados = encuentros.filter(
    (e) => (e.estado === "finalizado" || e.estado === "wo") && e.equipo_a_id && e.equipo_b_id,
  );

  for (const e of jugados) {
    const a = filas.get(e.equipo_a_id!);
    const b = filas.get(e.equipo_b_id!);
    if (!a || !b) continue;
    const r = resultadoPartido(e);
    a.pj += 1;
    b.pj += 1;
    a.setsFavor += r.setsA;
    a.setsContra += r.setsB;
    b.setsFavor += r.setsB;
    b.setsContra += r.setsA;
    a.puntosFavor += r.puntosA;
    a.puntosContra += r.puntosB;
    b.puntosFavor += r.puntosB;
    b.puntosContra += r.puntosA;
    const [gana, pierde] = r.ganador === "a" ? [a, b] : [b, a];
    gana.pg += 1;
    gana.pts += tabla.victoria;
    pierde.pp += 1;
    pierde.pts += e.estado === "wo" ? tabla.wo : tabla.derrota;
  }

  const ganoEntreEllos = (x: string, y: string): number => {
    const e = jugados.find(
      (m) =>
        (m.equipo_a_id === x && m.equipo_b_id === y) ||
        (m.equipo_a_id === y && m.equipo_b_id === x),
    );
    if (!e) return 0;
    const r = resultadoPartido(e);
    const ganadorId = r.ganador === "a" ? e.equipo_a_id : e.equipo_b_id;
    return ganadorId === x ? -1 : 1;
  };

  return [...filas.values()].sort(
    (x, y) =>
      y.pts - x.pts ||
      y.pg - x.pg ||
      cociente(y.setsFavor, y.setsContra) - cociente(x.setsFavor, x.setsContra) ||
      cociente(y.puntosFavor, y.puntosContra) - cociente(x.puntosFavor, x.puntosContra) ||
      ganoEntreEllos(x.equipoId, y.equipoId),
  );
}

// ---------------------------------------------------------------------------
// Simulación (solo demos)
// ---------------------------------------------------------------------------
/** Generador pseudoaleatorio con semilla: la misma demo da siempre lo mismo. */
export function rngConSemilla(semilla: string): () => number {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Marcador válido de un set según las reglas (con diferencia de 2 si aplica). */
function setSimulado(objetivo: number, reglas: ReglasTorneo["juego"], rng: () => number): [number, number] {
  const perdedor = Math.floor(rng() * (objetivo - 4)) + 4;
  let ganador = objetivo;
  let p = perdedor;
  if (reglas.diferencia_dos && p >= objetivo - 1) {
    p = objetivo - 1 + Math.floor(rng() * 3); // 20-22, 21-23…
    ganador = p + 2;
  }
  return rng() < 0.5 ? [ganador, p] : [p, ganador];
}

/** Sets completos de un partido simulado (respeta mejor de N y set decisivo). */
export function simularPartido(reglas: ReglasTorneo["juego"], rng: () => number): [number, number][] {
  const necesarios = Math.ceil(reglas.sets / 2);
  const sets: [number, number][] = [];
  let a = 0;
  let b = 0;
  while (a < necesarios && b < necesarios) {
    const decisivo = reglas.sets > 1 && sets.length === reglas.sets - 1;
    const s = setSimulado(decisivo ? reglas.puntos_decisivo : reglas.puntos_set, reglas, rng);
    sets.push(s);
    if (s[0] > s[1]) a += 1;
    else b += 1;
  }
  return sets;
}

/** Partido a medio jugar: sets cerrados + el set en curso sin terminar. */
export function simularEnVivo(reglas: ReglasTorneo["juego"], rng: () => number): [number, number][] {
  const sets = reglas.sets > 1 ? [setSimulado(reglas.puntos_set, reglas, rng)] : [];
  const tope = reglas.puntos_set - 3;
  sets.push([Math.floor(rng() * tope) + 2, Math.floor(rng() * tope) + 2]);
  return sets;
}

// ---------------------------------------------------------------------------
// Validación de resultados
// ---------------------------------------------------------------------------
/** ¿Este set está terminado según las reglas? */
function setTerminado(
  [a, b]: [number, number],
  objetivo: number,
  juego: ReglasTorneo["juego"],
): boolean {
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (juego.tope_puntos && alto >= juego.tope_puntos) return alto > bajo;
  if (alto < objetivo) return false;
  return juego.diferencia_dos ? alto - bajo >= 2 : alto > bajo;
}

/** ¿El marcador del set es posible? (no se pasó de puntos sin razón) */
function setPosible(
  [a, b]: [number, number],
  objetivo: number,
  juego: ReglasTorneo["juego"],
): boolean {
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (a < 0 || b < 0) return false;
  if (juego.tope_puntos && alto > juego.tope_puntos) return false;
  if (alto <= objetivo) return true;
  // Por encima del objetivo solo se llega con alargue: ganando por exactamente 2.
  return juego.diferencia_dos && alto - bajo <= 2 && bajo >= objetivo - 1;
}

/**
 * Revisa el marcador por sets. Con `finalizar`, exige que el partido esté
 * terminado (alguien ganó los sets necesarios y no sobran sets). Sin
 * `finalizar` (en vivo), el último set puede estar en curso.
 * Devuelve el problema en palabras del organizador, o null si está bien.
 */
export function validarSets(
  sets: [number, number][],
  juego: ReglasTorneo["juego"],
  finalizar: boolean,
): string | null {
  const necesarios = Math.ceil(juego.sets / 2);
  let a = 0;
  let b = 0;
  for (const [i, s] of sets.entries()) {
    const decisivo = juego.sets > 1 && i === juego.sets - 1;
    const objetivo = decisivo ? juego.puntos_decisivo : juego.puntos_set;
    const n = i + 1;
    if (a >= necesarios || b >= necesarios) {
      return `El partido ya estaba definido antes del set ${n}.`;
    }
    if (!setPosible(s, objetivo, juego)) {
      return `El set ${n} (${s[0]}-${s[1]}) no es posible: se juega a ${objetivo}${juego.diferencia_dos ? " con diferencia de 2" : ""}.`;
    }
    const ultimo = i === sets.length - 1;
    if (!setTerminado(s, objetivo, juego)) {
      if (finalizar || !ultimo) return `El set ${n} (${s[0]}-${s[1]}) no está terminado.`;
      continue;
    }
    if (s[0] > s[1]) a += 1;
    else b += 1;
  }
  if (sets.length > juego.sets) return `El partido es a máximo ${juego.sets} sets.`;
  if (finalizar && a < necesarios && b < necesarios) {
    return `Para terminar, un equipo debe ganar ${necesarios} set${necesarios > 1 ? "s" : ""}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------
/**
 * Asigna fecha, hora y cancha a una lista de partidos según el día relativo
 * de cada uno: llena todas las canchas de una franja antes de pasar a la
 * siguiente. Nunca dos partidos en la misma cancha a la misma hora.
 */
export function asignarHorarios(
  dias: number[],
  opts: { fechaInicio: string; horaInicio: string; canchas: number; duracionMin: number },
  ocupadas: Map<number, number> = new Map(),
): { programado_at: string; cancha: number }[] {
  const canchas = Math.max(1, opts.canchas);
  return dias.map((dia) => {
    const franja = ocupadas.get(dia) ?? 0;
    ocupadas.set(dia, franja + 1);
    const d = new Date(`${opts.fechaInicio}T${opts.horaInicio}:00-05:00`);
    d.setDate(d.getDate() + dia);
    d.setMinutes(d.getMinutes() + Math.floor(franja / canchas) * opts.duracionMin);
    return { programado_at: d.toISOString(), cancha: (franja % canchas) + 1 };
  });
}

// ---------------------------------------------------------------------------
// Llaves de eliminación
// ---------------------------------------------------------------------------
/** Orden clásico de siembra: 1 y 2 solo se cruzan en la final. [1,8,4,5,2,7,3,6] */
export function ordenSiembra(tamano: number): number[] {
  let orden = [1];
  while (orden.length < tamano) {
    const n = orden.length * 2;
    orden = orden.flatMap((s) => [s, n + 1 - s]);
  }
  return orden;
}

export interface PartidoLlave<T> {
  fase: FaseEncuentro;
  orden: number;
  a: T | null;
  b: T | null;
}

/**
 * Llave completa a partir de los sembrados (el 1° es el mejor). Si no son
 * potencia de 2, los mejores pasan directo (rival `null` en la primera ronda).
 * Incluye las rondas siguientes vacías, el tercer puesto y la final.
 */
export function armarLlave<T>(sembrados: T[]): PartidoLlave<T>[] {
  if (sembrados.length < 2) return [];
  let tamano = 2;
  while (tamano < sembrados.length) tamano *= 2;
  const orden = ordenSiembra(tamano);
  const partidos: PartidoLlave<T>[] = [];
  let fase: FaseEncuentro | null = faseEliminatoria(tamano);
  let cruces = tamano / 2;
  let primera = true;
  while (fase) {
    for (let i = 0; i < cruces; i++) {
      partidos.push({
        fase,
        orden: i,
        a: primera ? (sembrados[orden[i * 2] - 1] ?? null) : null,
        b: primera ? (sembrados[orden[i * 2 + 1] - 1] ?? null) : null,
      });
    }
    if (fase === "semifinal") partidos.push({ fase: "tercer_puesto", orden: 0, a: null, b: null });
    primera = false;
    cruces /= 2;
    fase = siguienteFase(fase);
  }
  return partidos;
}

/**
 * A dónde avanza el ganador (y, desde semifinal, el perdedor) de un partido
 * de la llave: fase, orden y lado.
 */
export function destinoEnLlave(
  fase: FaseEncuentro,
  orden: number,
): { ganador: { fase: FaseEncuentro; orden: number; lado: "a" | "b" } | null; perdedor: { fase: FaseEncuentro; orden: number; lado: "a" | "b" } | null } {
  const sig = siguienteFase(fase);
  const lado = orden % 2 === 0 ? "a" : "b";
  return {
    ganador: sig ? { fase: sig, orden: Math.floor(orden / 2), lado } : null,
    perdedor: fase === "semifinal" ? { fase: "tercer_puesto", orden: 0, lado } : null,
  };
}
