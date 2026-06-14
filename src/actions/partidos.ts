"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { fetchFixtures } from "@/lib/futbol-api";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, Partido, PartidoExterno } from "@/types";

/**
 * Server Actions para gestionar partidos.
 *
 * - Lectura: pública.
 * - Alta manual y registro de resultados: admin (sesión autenticada → RLS).
 * - Upsert desde la API externa: se hace con service role (sincronización).
 */

const nuevoPartidoSchema = z.object({
  equipo_local: z.string().min(1, "El equipo local es obligatorio"),
  equipo_visitante: z.string().min(1, "El equipo visitante es obligatorio"),
  fecha: z.string().datetime({ message: "Fecha inválida (se espera ISO 8601)" }),
  liga: z.string().min(1).nullable(),
});

const resultadoSchema = z.object({
  partido_id: z.string().uuid(),
  goles_local: z.number().int().min(0),
  goles_visitante: z.number().int().min(0),
});

/** Lista todos los partidos ordenados por fecha. */
export async function getPartidos(): Promise<ActionResult<Partido[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partidos")
    .select("*")
    .order("fecha", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as Partido[] };
}

/** Crea un partido manualmente (admin). */
export async function createPartido(
  input: z.infer<typeof nuevoPartidoSchema>,
): Promise<ActionResult<Partido>> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const parsed = nuevoPartidoSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partidos")
    .insert({ ...parsed.data, fuente: "manual", estado: "programado" })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: data as Partido };
}

/** Registra el resultado final de un partido (admin). */
export async function registrarResultado(
  input: z.infer<typeof resultadoSchema>,
): Promise<ActionResult<Partido>> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const parsed = resultadoSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { partido_id, goles_local, goles_visitante } = parsed.data;

  const { data, error } = await supabase
    .from("partidos")
    .update({ goles_local, goles_visitante, estado: "finalizado" })
    .eq("id", partido_id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: data as Partido };
}

/** Marca si el premio del partido ya se le pagó al/los ganador(es). Admin. */
export async function marcarPremioPagado(
  partidoId: string,
  pagado: boolean,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("partidos")
    .update({ premio_pagado: pagado })
    .eq("id", partidoId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  return { success: true, data: undefined };
}

/**
 * Inserta/actualiza partidos provenientes de la API externa, identificados
 * por `external_id`. Pensado para el proceso de sincronización (cron / route
 * handler). Usa service role porque corre sin sesión de usuario.
 *
 * El fetch al proveedor se implementará en el módulo de sincronización una vez
 * elijamos la API (ver `src/lib/futbol-api`, pendiente).
 */
export async function upsertPartidos(
  partidos: PartidoExterno[],
): Promise<ActionResult<{ count: number }>> {
  if (partidos.length === 0) {
    return { success: true, data: { count: 0 } };
  }

  const supabase = createServiceRoleClient();

  const filas = partidos.map((p) => ({ ...p, fuente: "api" as const }));

  const { data, error } = await supabase
    .from("partidos")
    .upsert(filas, { onConflict: "external_id" })
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  // Reconciliar: borrar los partidos de la API que ya no están en este fixture
  // (p. ej. al cambiar de proveedor o de competición). Los partidos creados
  // manualmente (fuente='manual') NO se tocan. La FK borra sus pronósticos.
  const entrantes = new Set(
    partidos.map((p) => p.external_id).filter((id): id is string => !!id),
  );

  const { data: existentes } = await supabase
    .from("partidos")
    .select("external_id")
    .eq("fuente", "api");

  const obsoletos = (existentes ?? [])
    .map((r) => r.external_id as string | null)
    .filter((id): id is string => !!id && !entrantes.has(id));

  if (obsoletos.length > 0) {
    await supabase.from("partidos").delete().in("external_id", obsoletos);
  }

  return { success: true, data: { count: data?.length ?? 0 } };
}

/**
 * Sincronización manual disparada desde el panel admin: trae los fixtures del
 * Mundial desde API-Football y los hace upsert. Requiere sesión admin.
 */
export async function sincronizarAhora(): Promise<
  ActionResult<{ count: number }>
> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  let partidos: PartidoExterno[];
  try {
    partidos = await fetchFixtures();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }

  const result = await upsertPartidos(partidos);
  if (result.success) {
    revalidatePath("/admin");
    revalidatePath("/");
  }
  return result;
}
