"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, Apuesta } from "@/types";

/**
 * Server Actions para apuestas ("polla por partido").
 *
 * - crearApuestas: registra las apuestas de una persona (una por partido).
 *   Solo se permite en partidos que aún no han iniciado. Usa service role para
 *   poder hacer upsert (editar la apuesta antes del partido).
 * - getApuestas / marcarPago / borrar*: gestión desde el admin.
 */

const apuestaItemSchema = z.object({
  partido_id: z.string().uuid(),
  goles_local: z.number().int().min(0),
  goles_visitante: z.number().int().min(0),
});

const crearApuestasSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido")
    .nullable(),
  pagado: z.boolean().default(false),
  apuestas: z.array(apuestaItemSchema).min(1, "Debes apostar al menos un partido"),
});

type ApuestaRow = Apuesta & { email?: string | null };

function normalizarApuesta(row: ApuestaRow): Apuesta {
  return {
    ...row,
    telefono: row.telefono ?? row.email ?? null,
  };
}

/** Registra (o actualiza) las apuestas de una persona. */
export async function crearApuestas(
  input: z.infer<typeof crearApuestasSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = crearApuestasSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { nombre, telefono, apuestas } = parsed.data;
  const supabase = createServiceRoleClient();

  // Valida que todos los partidos sigan abiertos (programados y futuros).
  const ids = apuestas.map((a) => a.partido_id);
  const { data: partidos, error: errPartidos } = await supabase
    .from("partidos")
    .select("id, estado, fecha")
    .in("id", ids);

  if (errPartidos) {
    return { success: false, error: errPartidos.message };
  }

  const abiertos = new Map(
    (partidos ?? [])
      .filter(
        (p) =>
          p.estado === "programado" &&
          new Date(p.fecha as string).getTime() > Date.now(),
      )
      .map((p) => [p.id as string, true]),
  );

  if (apuestas.some((a) => !abiertos.has(a.partido_id))) {
    return {
      success: false,
      error: "Alguno de los partidos ya inició y no admite apuestas",
    };
  }

  const filas = apuestas.map((a) => ({
    partido_id: a.partido_id,
    goles_local: a.goles_local,
    goles_visitante: a.goles_visitante,
    nombre,
    telefono,
    pagado: false,
  }));

  // Insert (no upsert): cada apuesta es independiente, incluso varias del
  // mismo nombre al mismo partido.
  let { data, error } = await supabase
    .from("apuestas")
    .insert(filas)
    .select("id");

  if (error?.code === "PGRST204") {
    const filasLegacy = filas.map(({ telefono: email, ...fila }) => ({
      ...fila,
      email,
    }));
    const retry = await supabase
      .from("apuestas")
      .insert(filasLegacy)
      .select("id");
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: { count: data?.length ?? 0 } };
}

/** Lista todas las apuestas (admin). */
export async function getApuestas(): Promise<ActionResult<Apuesta[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("apuestas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: ((data ?? []) as ApuestaRow[]).map(normalizarApuesta),
  };
}

/** Marca una apuesta como pagada o pendiente. Solo admin. */
export async function marcarPago(
  id: string,
  pagado: boolean,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("apuestas")
    .update({ pagado })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: undefined };
}

/** Borra una apuesta. Solo admin. */
export async function borrarApuesta(id: string): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("apuestas").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: undefined };
}

/** Borra TODAS las apuestas. Solo admin. */
export async function borrarTodasApuestas(): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("apuestas")
    .delete()
    .not("id", "is", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: undefined };
}
