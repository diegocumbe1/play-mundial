"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { getMarcadorActual } from "@/lib/marcador-reglamentario";
import { resumenPartido } from "@/lib/resumen-partido";
import { enviarPushAdmins } from "@/lib/push";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { calcularResultadoPartido } from "@/lib/polla";
import type {
  ActionResult,
  Apuesta,
  ApuestaCliente,
  MetodoPago,
  Partido,
  PartidoComunidad,
  ResultadoCliente,
} from "@/types";

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
  cliente_id: z.string().trim().min(8, "Cliente inválido"),
  telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido")
    .nullable(),
  pagado: z.boolean().default(false),
  apuestas: z.array(apuestaItemSchema).min(1, "Debes apostar al menos un partido"),
});

const crearApuestasAdminSchema = crearApuestasSchema.extend({
  pagado: z.boolean().default(false),
  metodo_pago: z.enum(["efectivo", "transferencia"]).nullable().default(null),
});

type ApuestaRow = Omit<Apuesta, "cliente_id" | "telefono"> & {
  cliente_id?: string | null;
  telefono?: string | null;
  email?: string | null;
  metodo_pago?: MetodoPago | null;
  nota_pago?: string | null;
  nota_premio?: string | null;
  no_pago?: boolean | null;
};

function normalizarApuesta(row: ApuestaRow): Apuesta {
  return {
    ...row,
    cliente_id: row.cliente_id ?? null,
    telefono: row.telefono ?? row.email ?? null,
    metodo_pago: row.metodo_pago ?? null,
    nota_pago: row.nota_pago ?? null,
    nota_premio: row.nota_premio ?? null,
    no_pago: row.no_pago ?? false,
    premio_pagado: row.premio_pagado ?? false,
  };
}

function sanitizarApuestaCliente(apuesta: Apuesta): ApuestaCliente {
  return {
    id: apuesta.id,
    partido_id: apuesta.partido_id,
    goles_local: apuesta.goles_local,
    goles_visitante: apuesta.goles_visitante,
    pagado: apuesta.pagado,
    created_at: apuesta.created_at,
    updated_at: apuesta.updated_at,
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

  const { nombre, cliente_id, telefono, apuestas } = parsed.data;
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
    cliente_id,
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
    const filasSinCliente = filas.map((fila) => ({
      partido_id: fila.partido_id,
      goles_local: fila.goles_local,
      goles_visitante: fila.goles_visitante,
      cliente_id: undefined,
      nombre: fila.nombre,
      telefono: fila.telefono,
      pagado: fila.pagado,
    }));

    const retrySinCliente = await supabase
      .from("apuestas")
      .insert(filasSinCliente)
      .select("id");

    data = retrySinCliente.data;
    error = retrySinCliente.error;

    if (error?.code === "PGRST204") {
      const filasLegacy = filas.map((fila) => ({
        partido_id: fila.partido_id,
        goles_local: fila.goles_local,
        goles_visitante: fila.goles_visitante,
        nombre: fila.nombre,
        email: fila.telefono,
        pagado: fila.pagado,
      }));
      const retryLegacy = await supabase
        .from("apuestas")
        .insert(filasLegacy)
        .select("id");
      data = retryLegacy.data;
      error = retryLegacy.error;
    }
  }

  if (error) {
    return { success: false, error: error.message };
  }

  const count = data?.length ?? 0;
  // Avisar al admin (no bloquea ni falla la creación si push está caído).
  if (count > 0) {
    await enviarPushAdmins({
      title: "🎟️ Nueva apuesta",
      body: `${nombre} registró ${count} apuesta(s) · valida el pago`,
      url: "/admin?tab=pendientes&focus=apuestas#apuestas",
    }).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: { count } };
}

/** Crea apuestas desde el admin, permitiendo dejarlas pagadas si ya recibió el dinero. */
export async function crearApuestasAdmin(
  input: z.infer<typeof crearApuestasAdminSchema>,
): Promise<ActionResult<{ count: number }>> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const parsed = crearApuestasAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { nombre, cliente_id, telefono, apuestas, pagado, metodo_pago } =
    parsed.data;
  if (pagado && !metodo_pago) {
    return {
      success: false,
      error: "Elige si el pago fue en efectivo o transferencia",
    };
  }

  const supabase = createServiceRoleClient();
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
    cliente_id,
    nombre,
    telefono,
    pagado,
    metodo_pago: pagado ? metodo_pago : null,
    no_pago: false,
  }));

  const { data, error } = await supabase.from("apuestas").insert(filas).select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: { count: data?.length ?? 0 } };
}

/** Lista todas las apuestas (admin). */
export async function getApuestas(): Promise<ActionResult<Apuesta[]>> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

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

/** Lista las apuestas asociadas al navegador/dispositivo anónimo del jugador. */
export async function getApuestasPorCliente(
  clienteId: string | null,
): Promise<ActionResult<ApuestaCliente[]>> {
  const parsed = z.string().trim().min(8).safeParse(clienteId);
  if (!parsed.success) {
    return { success: true, data: [] };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("apuestas")
    .select("*")
    .eq("cliente_id", parsed.data)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return { success: true, data: [] };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: ((data ?? []) as ApuestaRow[])
      .map(normalizarApuesta)
      .map(sanitizarApuestaCliente),
  };
}

/** Resultados personales para el navegador/dispositivo anónimo del jugador. */
export async function getResultadosPorCliente(
  clienteId: string | null,
): Promise<ActionResult<ResultadoCliente>> {
  const parsed = z.string().trim().min(8).safeParse(clienteId);

  const supabase = createServiceRoleClient();
  let propias: Apuesta[] = [];

  if (parsed.success) {
    const { data: propiasRaw, error: propiasError } = await supabase
      .from("apuestas")
      .select("*")
      .eq("cliente_id", parsed.data)
      .order("created_at", { ascending: true });

    if (propiasError) {
      if (propiasError.code === "42703" || propiasError.code === "PGRST204") {
        propias = [];
      } else {
        return { success: false, error: propiasError.message };
      }
    } else {
      propias = ((propiasRaw ?? []) as ApuestaRow[]).map(normalizarApuesta);
    }
  }

  const [partidosRes, apuestasRes] = await Promise.all([
    supabase.from("partidos").select("*"),
    supabase.from("apuestas").select("*"),
  ]);

  if (partidosRes.error) {
    return { success: false, error: partidosRes.error.message };
  }
  if (apuestasRes.error) {
    return { success: false, error: apuestasRes.error.message };
  }

  const propiasIds = new Set(propias.map((a) => a.id));
  const apuestasPorPartido = new Map<string, Apuesta[]>();
  for (const apuesta of ((apuestasRes.data ?? []) as ApuestaRow[]).map(
    normalizarApuesta,
  )) {
    const lista = apuestasPorPartido.get(apuesta.partido_id) ?? [];
    lista.push(apuesta);
    apuestasPorPartido.set(apuesta.partido_id, lista);
  }

  const resumenes = ((partidosRes.data ?? []) as Partido[])
    .map((partido) => {
    const apuestasPartido = apuestasPorPartido.get(partido.id) ?? [];
    const resultado = calcularResultadoPartido(
      partido,
      apuestasPartido,
    );
    const marcadorActual = getMarcadorActual(partido);
    const marcadoresPorLlave = new Map<
      string,
      {
        goles_local: number;
        goles_visitante: number;
        cantidad: number;
        pagadas: number;
        propias: number;
        esMarcadorActual: boolean;
        premioPorPersona: number;
      }
    >();

    for (const apuesta of apuestasPartido) {
      const llave = `${apuesta.goles_local}-${apuesta.goles_visitante}`;
      const actual = marcadoresPorLlave.get(llave) ?? {
        goles_local: apuesta.goles_local,
        goles_visitante: apuesta.goles_visitante,
        cantidad: 0,
        pagadas: 0,
        propias: 0,
        esMarcadorActual:
          marcadorActual !== null &&
          apuesta.goles_local === marcadorActual.goles_local &&
          apuesta.goles_visitante === marcadorActual.goles_visitante,
        premioPorPersona: 0,
      };
      actual.cantidad += 1;
      if (apuesta.pagado) actual.pagadas += 1;
      if (propiasIds.has(apuesta.id)) actual.propias += 1;
      marcadoresPorLlave.set(llave, actual);
    }

    for (const marcador of marcadoresPorLlave.values()) {
      if (marcador.esMarcadorActual && marcador.pagadas > 0) {
        marcador.premioPorPersona = Math.floor(
          resultado.premioPool / marcador.pagadas,
        );
      }
    }

      return {
        partido_id: partido.id,
        apuestasPagadas: resultado.apuestasPagadas,
        pozo: resultado.pozo,
        premioPool: resultado.premioPool,
        premioPorGanador: resultado.premioPorGanador,
        enCasa: resultado.enCasa,
        ganadoresClienteIds: resultado.ganadores
          .filter((g) => propiasIds.has(g.id))
          .map((g) => g.id),
        marcadores: [...marcadoresPorLlave.values()].sort(
          (a, b) =>
            Number(b.esMarcadorActual) - Number(a.esMarcadorActual) ||
            b.cantidad - a.cantidad ||
            a.goles_local - b.goles_local ||
            a.goles_visitante - b.goles_visitante,
        ),
      };
    })
    .filter((resumen) => resumen.apuestasPagadas > 0);

  return {
    success: true,
    data: { apuestas: propias.map(sanitizarApuestaCliente), resumenes },
  };
}

/**
 * Marcadores elegidos por la comunidad, para pantallas públicas (vista
 * compartible y carrusel del home).
 *
 * A diferencia de {@link getResultadosPorCliente}, aquí NO se calcula ni se
 * expone nada sensible: ni dinero, ni pozos, ni estado de pago, ni nombres,
 * ni teléfonos, ni ids de terceros. El payload solo lleva conteos por marcador.
 *
 * `clienteId` es opcional: solo sirve para marcar `esPropio` en los marcadores
 * del propio dispositivo (chip "Tu marcador"), sin exponer ningún monto.
 */
export async function getMarcadoresComunidad(
  clienteId?: string | null,
): Promise<ActionResult<PartidoComunidad[]>> {
  const supabase = createServiceRoleClient();

  type ApuestaPublica = {
    id: string;
    partido_id: string;
    goles_local: number;
    goles_visitante: number;
    cliente_id: string | null;
  };

  // Trae TODAS las apuestas paginando: Supabase limita cada respuesta a ~1000
  // filas, y sin esto se perderían partidos cuando hay muchas apuestas.
  const PAGINA = 1000;
  const apuestas: ApuestaPublica[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("apuestas")
      .select("id, partido_id, goles_local, goles_visitante, cliente_id")
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (error) {
      return { success: false, error: error.message };
    }
    const lote = (data ?? []) as ApuestaPublica[];
    apuestas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  const partidosRes = await supabase.from("partidos").select("*");
  if (partidosRes.error) {
    return { success: false, error: partidosRes.error.message };
  }

  const parsed = z.string().trim().min(8).safeParse(clienteId);
  const clienteActual = parsed.success ? parsed.data : null;

  const apuestasPorPartido = new Map<string, ApuestaPublica[]>();
  for (const apuesta of apuestas) {
    const lista = apuestasPorPartido.get(apuesta.partido_id) ?? [];
    lista.push(apuesta);
    apuestasPorPartido.set(apuesta.partido_id, lista);
  }

  const comunidad = ((partidosRes.data ?? []) as Partido[])
    .map((partido): PartidoComunidad => {
      const apuestasPartido = apuestasPorPartido.get(partido.id) ?? [];
      const marcadorActual = getMarcadorActual(partido);
      const resumen = resumenPartido(partido);

      const porLlave = new Map<string, PartidoComunidad["marcadores"][number]>();
      for (const apuesta of apuestasPartido) {
        const llave = `${apuesta.goles_local}-${apuesta.goles_visitante}`;
        const actual = porLlave.get(llave) ?? {
          goles_local: apuesta.goles_local,
          goles_visitante: apuesta.goles_visitante,
          cantidad: 0,
          esMarcadorActual:
            marcadorActual !== null &&
            apuesta.goles_local === marcadorActual.goles_local &&
            apuesta.goles_visitante === marcadorActual.goles_visitante,
          esPropio: false,
        };
        actual.cantidad += 1;
        if (clienteActual && apuesta.cliente_id === clienteActual) {
          actual.esPropio = true;
        }
        porLlave.set(llave, actual);
      }

      const marcadores = [...porLlave.values()].sort(
        (a, b) =>
          Number(b.esMarcadorActual) - Number(a.esMarcadorActual) ||
          b.cantidad - a.cantidad ||
          a.goles_local - b.goles_local ||
          a.goles_visitante - b.goles_visitante,
      );

      return {
        partido_id: partido.id,
        equipo_local: partido.equipo_local,
        equipo_visitante: partido.equipo_visitante,
        equipo_local_logo: partido.equipo_local_logo,
        equipo_visitante_logo: partido.equipo_visitante_logo,
        estado: partido.estado,
        fecha: partido.fecha,
        marcadorOficial: marcadorActual,
        esReglamentario:
          partido.estado === "finalizado" && marcadorActual !== null,
        finalOficial:
          partido.estado === "finalizado" && resumen.finalDifiere && resumen.final
            ? {
                goles_local: resumen.final.local,
                goles_visitante: resumen.final.visitante,
                penales: resumen.penales,
              }
            : null,
        totalPersonas: apuestasPartido.length,
        marcadores,
      };
    })
    .filter((p) => p.totalPersonas > 0);

  return { success: true, data: comunidad };
}

/** Marca una apuesta como pagada o pendiente. Solo admin. */
export async function marcarPago(
  id: string,
  pagado: boolean,
  metodoPago: MetodoPago | null = null,
  nota: string | null = null,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  if (pagado && !metodoPago) {
    return { success: false, error: "Elige si el pago fue en efectivo o transferencia" };
  }

  const notaLimpia = nota?.trim() ? nota.trim().slice(0, 500) : null;

  const supabase = await createClient();
  const update = {
    pagado,
    metodo_pago: pagado ? metodoPago : null,
    // Al volver a "pendiente" se descarta la nota; al pagar se guarda la que venga.
    nota_pago: pagado ? notaLimpia : null,
    // Pagar o volver a pendiente siempre saca a la apuesta del estado "no pagó".
    no_pago: false,
  };

  const { error } = await actualizarApuestaConFallback(supabase, id, update);

  if (error) {
    return { success: false, error: error.message };
  }

  // Aviso a TODOS los admins de que un pago fue aprobado. Útil cuando dos
  // personas usan el perfil admin: evita que el otro lo apruebe de nuevo.
  if (pagado) {
    await notificarPagoAprobado(supabase, id, metodoPago).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: undefined };
}

/** Notifica a los admins que se aprobó el pago de una apuesta. No bloqueante. */
async function notificarPagoAprobado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apuestaId: string,
  metodoPago: MetodoPago | null,
): Promise<void> {
  const { data: apuesta } = await supabase
    .from("apuestas")
    .select("nombre, partido_id")
    .eq("id", apuestaId)
    .single();
  if (!apuesta) return;

  const { data: partido } = await supabase
    .from("partidos")
    .select("equipo_local, equipo_visitante")
    .eq("id", apuesta.partido_id)
    .single();

  const versus = partido
    ? `${partido.equipo_local} vs ${partido.equipo_visitante}`
    : "un partido";
  const medio =
    metodoPago === "efectivo"
      ? "efectivo"
      : metodoPago === "transferencia"
        ? "transferencia"
        : null;

  await enviarPushAdmins({
    title: "Pago aprobado ✅",
    body: `${apuesta.nombre} · ${versus}${medio ? ` · ${medio}` : ""}`,
    url: "/admin",
    // Mismo tag por apuesta: si se re-aprueba, reemplaza en vez de acumular.
    tag: `pago-${apuestaId}`,
  });
}

/**
 * Cierra (o reabre) una apuesta como "no pagó": el dinero nunca llegó. Se
 * mantiene el registro pero deja de contar como pendiente y queda fuera del
 * pozo (pagado=false). Solo admin.
 */
export async function marcarNoPago(
  id: string,
  noPago: boolean,
  nota: string | null = null,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const notaLimpia = nota?.trim() ? nota.trim().slice(0, 500) : null;

  const supabase = await createClient();
  const update = noPago
    ? // Marcar "no pagó": fuera del pozo y se guarda el motivo opcional.
      { no_pago: true, pagado: false, metodo_pago: null, nota_pago: notaLimpia }
    : // Reabrir: vuelve a "pendiente" y se descarta la nota.
      { no_pago: false, nota_pago: null };

  // Sin fallback: no_pago es la columna esencial aquí; si falta, hay que
  // avisar en vez de aplicar el update incompleto silenciosamente.
  const { error } = await supabase.from("apuestas").update(update).eq("id", id);

  if (error) {
    // Si la columna no_pago aún no existe, el estado no se puede aplicar.
    if (error.code === "PGRST204" || error.code === "42703") {
      return {
        success: false,
        error: "Falta aplicar la migración 'no_pago' en la base de datos",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/resultados");
  return { success: true, data: undefined };
}

/**
 * Aplica un update sobre una apuesta tolerando columnas opcionales aún no
 * migradas (nota_pago / no_pago): reintenta sin ellas si el esquema las rechaza.
 */
async function actualizarApuestaConFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  update: Record<string, unknown>,
) {
  let { error } = await supabase.from("apuestas").update(update).eq("id", id);

  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    const resto = { ...update };
    delete resto.nota_pago;
    delete resto.no_pago;
    if (Object.keys(resto).length < Object.keys(update).length) {
      ({ error } = await supabase.from("apuestas").update(resto).eq("id", id));
    }
  }

  return { error };
}

/** Marca si el premio de una apuesta ganadora ya fue entregado. Solo admin. */
export async function marcarPremioApuestaPagado(
  id: string,
  pagado: boolean,
  nota: string | null = null,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }

  const notaLimpia = nota?.trim() ? nota.trim().slice(0, 500) : null;

  const supabase = await createClient();
  const update = {
    premio_pagado: pagado,
    // Al volver a "pendiente" se descarta la nota; al pagar se guarda la que venga.
    nota_premio: pagado ? notaLimpia : null,
  };

  let { error } = await supabase.from("apuestas").update(update).eq("id", id);

  // Tolera la columna nota_premio aún no migrada: reintenta solo con el flag.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await supabase
      .from("apuestas")
      .update({ premio_pagado: pagado })
      .eq("id", id));
  }

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
