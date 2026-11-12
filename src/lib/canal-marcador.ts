import "server-only";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { crearSalaMarcador, leerMarcador, marcadorDisponible } from "@/lib/marcador-externo";
import { OPCIONES_MARCADOR_POR_DEFECTO } from "@/lib/marcador-voz";
import { patrociniosParaMarcador } from "@/lib/patrocinadores-db";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { avisarEnVivo, avisarPorAprobar, guardarConstanciaJuez } from "@/lib/torneo-avisos";
import { leerReglas } from "@/lib/torneo-reglas";
import type { Encuentro, Torneo } from "@/types";

/**
 * Canal del marcador: UNA sala fija por cancha para todo el torneo. La TV y el juez usan
 * siempre el mismo enlace; aquí se le carga el partido que toca. Antes de cambiar de
 * partido se lee la sala y se guarda lo que reportó el juez, así no se pierde ningún resultado.
 */

export interface CanalMarcador {
  id: string;
  tenant_id: string;
  torneo_id: string;
  cancha: number;
  /** Código de la sala fija: es el secreto del enlace. */
  sala: string;
  /** Partido cargado ahora en la sala. */
  encuentro_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ResultadoCambio =
  | { ok: true; partido: string; encuentroId: string }
  | { ok: false; error: string };

/** Código de sala nuevo: letras y números, largo, imposible de adivinar. */
export const salaDeCanal = (): string => `c-${randomBytes(9).toString("hex")}`;

const svc = () => createServiceRoleClient();

export async function getCanalPorSala(sala: string): Promise<CanalMarcador | null> {
  if (!/^c-[0-9a-f]{18}$/.test(sala)) return null;
  const { data } = await svc().from("canales_marcador").select("*").eq("sala", sala).maybeSingle();
  return (data as CanalMarcador | null) ?? null;
}

/** Partidos por cargar en esta cancha, en orden: programados con equipos y hora, sin sala. */
export function pendientesDeCancha(todos: Encuentro[], cancha: number, excluirId?: string | null): Encuentro[] {
  return todos
    .filter(
      (e) =>
        e.estado === "programado" &&
        !!e.equipo_a_id &&
        !!e.equipo_b_id &&
        !!e.programado_at &&
        (e.cancha ?? 1) === cancha &&
        !e.sala_marcador &&
        e.id !== excluirId,
    )
    .sort((a, b) => a.programado_at!.localeCompare(b.programado_at!) || a.orden - b.orden);
}

/** El partido que sigue en esta cancha: el próximo programado con sus dos equipos y su hora. */
export function siguienteDeCancha(todos: Encuentro[], cancha: number, excluirId?: string | null): Encuentro | null {
  return pendientesDeCancha(todos, cancha, excluirId)[0] ?? null;
}

/** Cuántos partidos próximos puede elegir el juez: pocos, para no confundirlo. */
export const OPCIONES_JUEZ = 3;

/** Los próximos partidos que el juez puede elegir en esta cancha (con su texto para mostrar). */
export async function proximosParaJuez(canal: CanalMarcador): Promise<{ id: string; texto: string; hora: string | null }[]> {
  const db = svc();
  const [{ data: encData }, { data: eqData }] = await Promise.all([
    db.from("encuentros").select("*").eq("torneo_id", canal.torneo_id),
    db.from("equipos_torneo").select("id, nombre").eq("torneo_id", canal.torneo_id),
  ]);
  const nombre = (id: string | null) => ((eqData as { id: string; nombre: string }[]) ?? []).find((e) => e.id === id)?.nombre ?? "Por definir";
  return pendientesDeCancha((encData as Encuentro[]) ?? [], canal.cancha, canal.encuentro_id)
    .slice(0, OPCIONES_JUEZ)
    .map((e) => ({
      id: e.id,
      hora: e.programado_at,
      texto: `${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`,
    }));
}

/**
 * Carga un partido en la sala fija de la cancha.
 *
 * - Si había un partido cargado y sin aceptar, lo LEE primero y guarda lo que reportó el
 *   juez (constancia). Si no puede leerlo, no cambia (salvo `forzar`, que es del organizador).
 * - Por el juez solo se puede pasar al siguiente cuando el partido ya terminó.
 * - Sin `encuentroId` toma el siguiente programado de la cancha.
 */
export async function cargarPartidoEnCanal(
  canal: CanalMarcador,
  opts: { por: "juez" | "owner"; encuentroId?: string; forzar?: boolean },
): Promise<ResultadoCambio> {
  if (!marcadorDisponible()) return { ok: false, error: "El marcador en vivo no está configurado." };
  const db = svc();

  const [{ data: torneoData }, { data: todosData }] = await Promise.all([
    db.from("torneos").select("*").eq("id", canal.torneo_id).maybeSingle(),
    db.from("encuentros").select("*").eq("torneo_id", canal.torneo_id),
  ]);
  const torneo = (torneoData as Torneo | null) ?? null;
  const todos = (todosData as Encuentro[]) ?? [];
  if (!torneo) return { ok: false, error: "Torneo no encontrado" };

  // El juez solo puede elegir entre los próximos partidos (para no confundirlo).
  if (opts.por === "juez" && opts.encuentroId) {
    const permitidos = pendientesDeCancha(todos, canal.cancha, canal.encuentro_id).slice(0, OPCIONES_JUEZ).map((e) => e.id);
    if (!permitidos.includes(opts.encuentroId)) {
      return { ok: false, error: "Ese partido no está entre los próximos. Elige uno de la lista." };
    }
  }

  // 1) Lo que hay cargado ahora: se lee y se guarda antes de tocar nada.
  const actual = canal.encuentro_id ? (todos.find((e) => e.id === canal.encuentro_id) ?? null) : null;
  const sinAceptar = !!actual && actual.estado === "en_vivo";
  // Cargado pero sin empezar (sin un solo punto): no hay resultado que guardar; vuelve a «programado».
  let devolverActual = false;
  if (sinAceptar) {
    const leido = await leerMarcador(canal.sala, 4000);
    if (!leido) {
      if (!opts.forzar) {
        return {
          ok: false,
          error: "No se pudo leer el marcador, así que no se cambia de partido para no perder el resultado.",
        };
      }
    } else if (!leido.terminado && leido.sets.length === 0) {
      devolverActual = true;
    } else {
      if (!leido.terminado && !opts.forzar) {
        return { ok: false, error: "El partido sigue en juego: termínalo antes de pasar al siguiente." };
      }
      // Terminado: constancia y aviso «Resultado por aprobar» ya, porque la sala se libera ahora.
      if (leido.terminado) await avisarPorAprobar(torneo, actual!, leido);
      else await guardarConstanciaJuez(actual!, leido);
    }
  }

  // 2) El partido que entra.
  const nuevo = opts.encuentroId
    ? todos.find((e) => e.id === opts.encuentroId)
    : siguienteDeCancha(todos, canal.cancha, canal.encuentro_id);
  if (!nuevo) return { ok: false, error: "No hay más partidos programados en esta cancha." };
  if (nuevo.estado !== "programado" || !nuevo.equipo_a_id || !nuevo.equipo_b_id) {
    return { ok: false, error: "Ese partido no se puede cargar: ya se jugó o le faltan equipos." };
  }

  const { data: eqs } = await db.from("equipos_torneo").select("id, nombre").in("id", [nuevo.equipo_a_id, nuevo.equipo_b_id]);
  const nombre = (id: string) => (eqs as { id: string; nombre: string }[] | null)?.find((x) => x.id === id)?.nombre ?? "Equipo";
  const nombreA = nombre(nuevo.equipo_a_id);
  const nombreB = nombre(nuevo.equipo_b_id);

  // 3) Se toma el turno (compare-and-swap): si dos toques llegan a la vez, solo pasa uno.
  const tomado = await db
    .from("canales_marcador")
    .update({ encuentro_id: nuevo.id })
    .eq("id", canal.id)
    .filter("encuentro_id", canal.encuentro_id ? "eq" : "is", canal.encuentro_id ?? null)
    .select("id");
  if (tomado.error || !tomado.data || tomado.data.length === 0) {
    return { ok: false, error: "Otro cambio de partido ya está en curso. Espera un momento." };
  }

  // 4) La sala se reconfigura con los equipos y las reglas del nuevo partido.
  const err = await crearSalaMarcador(
    canal.sala,
    nombreA,
    nombreB,
    leerReglas(torneo.reglas).juego,
    OPCIONES_MARCADOR_POR_DEFECTO,
    await patrociniosParaMarcador(torneo),
    { canal: true, reconfigurar: true },
  );
  if (err) {
    // No quedó cargado: se devuelve el turno para poder reintentar.
    await db.from("canales_marcador").update({ encuentro_id: canal.encuentro_id }).eq("id", canal.id);
    return { ok: false, error: err };
  }

  // 5) El anterior deja la sala (queda pendiente de aceptar con lo que guardó el juez);
  //    el nuevo la ocupa y pasa a «en vivo».
  if (sinAceptar && actual) {
    await db
      .from("encuentros")
      .update(devolverActual ? { sala_marcador: null, estado: "programado" } : { sala_marcador: null })
      .eq("id", actual.id);
  }
  await db.from("encuentros").update({ sala_marcador: canal.sala, estado: "en_vivo" }).eq("id", nuevo.id);
  if (torneo.estado === "inscripciones" || torneo.estado === "programado") {
    await db.from("torneos").update({ estado: "en_curso" }).eq("id", torneo.id);
  }
  await avisarEnVivo(torneo, nuevo);

  revalidatePath(`/admin/torneos/${torneo.id}`);
  revalidatePath(`/t/${torneo.slug_publico}`);
  return { ok: true, partido: `${nombreA} vs ${nombreB}`, encuentroId: nuevo.id };
}

/**
 * Cambia el código de sala de la cancha (los enlaces anteriores dejan de servir). Si hay un
 * partido en curso, se vuelve a crear en la sala nueva: su marcador arranca de cero.
 */
export async function regenerarSalaCanal(canal: CanalMarcador): Promise<{ ok: true; sala: string } | { ok: false; error: string }> {
  const db = svc();
  const nueva = salaDeCanal();
  const { error } = await db.from("canales_marcador").update({ sala: nueva }).eq("id", canal.id);
  if (error) return { ok: false, error: error.message };

  const { data } = canal.encuentro_id
    ? await db.from("encuentros").select("*").eq("id", canal.encuentro_id).maybeSingle()
    : { data: null };
  const e = (data as Encuentro | null) ?? null;
  if (e && e.estado === "en_vivo" && e.equipo_a_id && e.equipo_b_id) {
    const [{ data: torneoData }, { data: eqs }] = await Promise.all([
      db.from("torneos").select("*").eq("id", canal.torneo_id).maybeSingle(),
      db.from("equipos_torneo").select("id, nombre").in("id", [e.equipo_a_id, e.equipo_b_id]),
    ]);
    const torneo = torneoData as Torneo | null;
    const nombre = (id: string) => (eqs as { id: string; nombre: string }[] | null)?.find((x) => x.id === id)?.nombre ?? "Equipo";
    if (torneo) {
      const err = await crearSalaMarcador(
        nueva,
        nombre(e.equipo_a_id),
        nombre(e.equipo_b_id),
        leerReglas(torneo.reglas).juego,
        OPCIONES_MARCADOR_POR_DEFECTO,
        await patrociniosParaMarcador(torneo),
        { canal: true },
      );
      if (err) {
        await db.from("canales_marcador").update({ sala: canal.sala }).eq("id", canal.id);
        return { ok: false, error: err };
      }
      await db.from("encuentros").update({ sala_marcador: nueva }).eq("id", e.id);
    }
  }
  return { ok: true, sala: nueva };
}

/**
 * Vuelve a cargar en la sala el partido que ya figura como actual. Sirve cuando el marcador se
 * reinició y la sala volvió a nacer en blanco: se le ponen otra vez los equipos y las reglas.
 * Lo que ya se había marcado en ese partido se pierde (estaba en la memoria del marcador).
 */
export async function recargarPartidoActual(canal: CanalMarcador): Promise<ResultadoCambio> {
  if (!marcadorDisponible()) return { ok: false, error: "El marcador en vivo no está configurado." };
  if (!canal.encuentro_id) return { ok: false, error: "Esta cancha no tiene un partido cargado." };
  const db = svc();
  const { data } = await db.from("encuentros").select("*").eq("id", canal.encuentro_id).maybeSingle();
  const e = (data as Encuentro | null) ?? null;
  if (!e || !e.equipo_a_id || !e.equipo_b_id) return { ok: false, error: "Partido no encontrado." };
  if (e.estado === "finalizado" || e.estado === "wo") return { ok: false, error: "Ese partido ya terminó." };

  const [{ data: torneoData }, { data: eqs }] = await Promise.all([
    db.from("torneos").select("*").eq("id", canal.torneo_id).maybeSingle(),
    db.from("equipos_torneo").select("id, nombre").in("id", [e.equipo_a_id, e.equipo_b_id]),
  ]);
  const torneo = (torneoData as Torneo | null) ?? null;
  if (!torneo) return { ok: false, error: "Torneo no encontrado" };
  const nombre = (id: string) => (eqs as { id: string; nombre: string }[] | null)?.find((x) => x.id === id)?.nombre ?? "Equipo";

  const err = await crearSalaMarcador(
    canal.sala,
    nombre(e.equipo_a_id),
    nombre(e.equipo_b_id),
    leerReglas(torneo.reglas).juego,
    OPCIONES_MARCADOR_POR_DEFECTO,
    await patrociniosParaMarcador(torneo),
    { canal: true, reconfigurar: true },
  );
  if (err) return { ok: false, error: err };
  await db.from("encuentros").update({ sala_marcador: canal.sala, estado: "en_vivo" }).eq("id", e.id);
  revalidatePath(`/admin/torneos/${torneo.id}`);
  return { ok: true, partido: `${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`, encuentroId: e.id };
}
