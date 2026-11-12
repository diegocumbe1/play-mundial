"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getUser } from "@/lib/auth";
import { avisarDatosCompletos } from "@/lib/cuenta-cobro-avisos";
import { getCuentaPorClave } from "@/lib/cuentas-cobro-db";
import { conceptoResumen, hoyColombia, totalLineas } from "@/lib/cuenta-cobro";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, CuentaCobro, CuentaCobroConfig, EstadoCuentaCobro, LineaCobro } from "@/types";

/**
 * Cuentas de cobro. Crear, editar, cambiar de estado y borrar es del superadmin.
 * La única acción pública es `completarDatosCuenta`: el cliente, con su enlace
 * secreto, llena sus datos una vez; después la cuenta queda bloqueada para él.
 */

const NO_AUTORIZADO = { success: false as const, error: "Solo el superadmin" };

const texto = (max: number) => z.string().trim().max(max).nullable().optional();
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

/** "" → null para no guardar cadenas vacías. */
const nulo = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

const configSchema = z.object({
  emisor_nombre: texto(120),
  emisor_documento: texto(40),
  emisor_marca: z.string().trim().min(1, "Pon la marca que firma").max(80),
  emisor_whatsapp: texto(30),
  pago_llave: texto(80),
  pago_banco: texto(60),
  pago_titular: texto(120),
  nota: texto(400),
  aviso_correo: z.string().trim().email("Escribe un correo válido").max(160).nullable().optional().or(z.literal("")),
});

const cuentaSchema = z.object({
  torneo_id: z.string().uuid().nullable().optional(),
  numero: z.number().int().min(1).max(999999).optional(),
  fecha,
  fecha_limite: fecha.nullable().optional(),
  cliente_nombre: z.string().trim().min(2, "Pon el nombre del cliente").max(120),
  cliente_ciudad: texto(80),
  /** Un solo concepto (forma anterior). Con `lineas` se ignora: se calcula de ellas. */
  concepto: z.string().trim().max(200).optional(),
  concepto_detalle: texto(300),
  items: z.array(z.string().trim().max(160)).max(12).default([]),
  valor: z.number().int().min(0, "El valor no puede ser negativo").max(999_999_999).optional(),
  /** Varios conceptos, cada uno con su cantidad y valor. */
  lineas: z
    .array(
      z.object({
        descripcion: z.string().trim().max(200),
        detalle: texto(300),
        cantidad: z.number().int().min(1, "La cantidad es mínimo 1").max(9999),
        valor_unitario: z.number().int().min(0, "El valor no puede ser negativo").max(999_999_999),
      }),
    )
    .max(20)
    .default([]),
  nota: texto(400),
  recibe_nombre: texto(120),
  cliente_documento: texto(40),
  contacto_nombre: texto(120),
  contacto_whatsapp: texto(30),
  emisor_nombre: texto(120),
  emisor_documento: texto(40),
  emisor_marca: texto(80),
  emisor_whatsapp: texto(30),
  pago_llave: texto(80),
  pago_banco: texto(60),
  pago_titular: texto(120),
});

export type CuentaCobroInput = z.input<typeof cuentaSchema>;
export type ConfigCobroInput = z.input<typeof configSchema>;

const claveNueva = () => randomBytes(24).toString("base64url");

/**
 * Concepto y total de la cuenta: con líneas, salen de ellas (el total lo calcula
 * el servidor, no se confía en el del formulario); sin líneas, el concepto único.
 */
function resolverConcepto(d: z.output<typeof cuentaSchema>):
  | { ok: true; concepto: string; valor: number; lineas: LineaCobro[] }
  | { ok: false; error: string } {
  const lineas: LineaCobro[] = d.lineas
    .filter((l) => l.descripcion.trim())
    .map((l) => ({ ...l, detalle: nulo(l.detalle) }));
  if (lineas.length > 0) {
    const valor = totalLineas(lineas);
    if (valor > 999_999_999) return { ok: false, error: "El total es demasiado grande" };
    return { ok: true, concepto: conceptoResumen(lineas).slice(0, 200), valor, lineas };
  }
  if (d.concepto && d.concepto.trim().length >= 3 && d.valor !== undefined) {
    return { ok: true, concepto: d.concepto.trim(), valor: d.valor, lineas: [] };
  }
  return { ok: false, error: "Agrega al menos un concepto con su valor" };
}

// ---------------------------------------------------------------------------
// Configuración de quien cobra
// ---------------------------------------------------------------------------
export async function getConfigCobro(): Promise<ActionResult<CuentaCobroConfig>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const { data } = await createServiceRoleClient().from("cuentas_cobro_config").select("*").eq("id", true).maybeSingle();
  const c = data as (CuentaCobroConfig & { id?: boolean }) | null;
  return {
    success: true,
    data: {
      emisor_nombre: c?.emisor_nombre ?? null,
      emisor_documento: c?.emisor_documento ?? null,
      emisor_marca: c?.emisor_marca ?? "Lynko · Play Mundial",
      emisor_whatsapp: c?.emisor_whatsapp ?? null,
      pago_llave: c?.pago_llave ?? null,
      pago_banco: c?.pago_banco ?? null,
      pago_titular: c?.pago_titular ?? null,
      nota: c?.nota ?? null,
      aviso_correo: c?.aviso_correo ?? null,
    },
  };
}

export async function guardarConfigCobro(input: ConfigCobroInput): Promise<ActionResult> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const p = configSchema.safeParse(input);
  if (!p.success) return { success: false, error: p.error.issues[0].message };
  const d = p.data;
  const { error } = await createServiceRoleClient()
    .from("cuentas_cobro_config")
    .upsert({
      id: true,
      emisor_nombre: nulo(d.emisor_nombre),
      emisor_documento: nulo(d.emisor_documento),
      emisor_marca: d.emisor_marca,
      emisor_whatsapp: nulo(d.emisor_whatsapp),
      pago_llave: nulo(d.pago_llave),
      pago_banco: nulo(d.pago_banco),
      pago_titular: nulo(d.pago_titular),
      nota: nulo(d.nota),
      aviso_correo: nulo(d.aviso_correo),
    });
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Lectura (superadmin)
// ---------------------------------------------------------------------------
export interface TorneoParaCobro {
  id: string;
  nombre: string;
  tenant_id: string;
  organizador: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

/** Torneos a los que se puede vincular una cuenta de cobro. */
export async function getTorneosParaCobro(): Promise<ActionResult<TorneoParaCobro[]>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("torneos")
    .select("id, nombre, tenant_id, fecha_inicio, fecha_fin")
    .order("created_at", { ascending: false })
    .limit(100);
  const torneos = (data as Omit<TorneoParaCobro, "organizador">[]) ?? [];
  const ids = [...new Set(torneos.map((t) => t.tenant_id))];
  const { data: tenants } = ids.length
    ? await svc.from("tenants").select("id, nombre").in("id", ids)
    : { data: [] };
  const nombre = new Map(((tenants as { id: string; nombre: string }[]) ?? []).map((t) => [t.id, t.nombre]));
  return {
    success: true,
    data: torneos.map((t) => ({ ...t, organizador: nombre.get(t.tenant_id) ?? "" })),
  };
}

export async function getCuentasCobro(): Promise<ActionResult<(CuentaCobro & { torneo_nombre: string | null })[]>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const svc = createServiceRoleClient();
  const { data, error } = await svc.from("cuentas_cobro").select("*").order("numero", { ascending: false });
  if (error) return { success: false, error: error.message };
  const cuentas = (data as CuentaCobro[]) ?? [];
  const ids = [...new Set(cuentas.map((c) => c.torneo_id).filter((x): x is string => !!x))];
  const { data: torneos } = ids.length ? await svc.from("torneos").select("id, nombre").in("id", ids) : { data: [] };
  const nombre = new Map(((torneos as { id: string; nombre: string }[]) ?? []).map((t) => [t.id, t.nombre]));
  return { success: true, data: cuentas.map((c) => ({ ...c, torneo_nombre: c.torneo_id ? (nombre.get(c.torneo_id) ?? null) : null })) };
}

export async function getCuentaCobro(id: string): Promise<ActionResult<CuentaCobro>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const { data } = await createServiceRoleClient().from("cuentas_cobro").select("*").eq("id", id).maybeSingle();
  return data ? { success: true, data: data as CuentaCobro } : { success: false, error: "Cuenta de cobro no encontrada" };
}

// ---------------------------------------------------------------------------
// Escritura (superadmin)
// ---------------------------------------------------------------------------
/** Datos del torneo vinculado: su organizador viaja con la cuenta. */
async function tenantDelTorneo(torneoId: string | null | undefined): Promise<string | null | "no-existe"> {
  if (!torneoId) return null;
  const { data } = await createServiceRoleClient().from("torneos").select("tenant_id").eq("id", torneoId).maybeSingle();
  return (data as { tenant_id: string } | null)?.tenant_id ?? "no-existe";
}

export async function crearCuentaCobro(
  input: CuentaCobroInput,
): Promise<ActionResult<{ id: string; clave: string }>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const p = cuentaSchema.safeParse(input);
  if (!p.success) return { success: false, error: p.error.issues[0].message };
  const d = p.data;

  const tenant = await tenantDelTorneo(d.torneo_id);
  if (tenant === "no-existe") return { success: false, error: "El torneo ya no existe" };

  // Quien cobra: lo que venga del formulario o, si está vacío, la configuración.
  const cfg = await getConfigCobro();
  const base = cfg.success ? cfg.data : null;
  const emisor_nombre = nulo(d.emisor_nombre) ?? base?.emisor_nombre ?? null;
  if (!emisor_nombre) {
    return { success: false, error: "Configura primero quién cobra (nombre) en «Datos de quien cobra»." };
  }

  const cc = resolverConcepto(d);
  if (!cc.ok) return { success: false, error: cc.error };

  const usuario = await getUser();
  const clave = claveNueva();
  const { data, error } = await createServiceRoleClient()
    .from("cuentas_cobro")
    .insert({
      clave,
      ...(d.numero ? { numero: d.numero } : {}),
      torneo_id: d.torneo_id ?? null,
      tenant_id: tenant,
      fecha: d.fecha,
      fecha_limite: d.fecha_limite ?? null,
      cliente_nombre: d.cliente_nombre,
      cliente_ciudad: nulo(d.cliente_ciudad),
      concepto: cc.concepto,
      concepto_detalle: nulo(d.concepto_detalle),
      items: d.items.filter((i) => i.trim()),
      lineas: cc.lineas,
      valor: cc.valor,
      nota: nulo(d.nota) ?? base?.nota ?? null,
      recibe_nombre: nulo(d.recibe_nombre),
      cliente_documento: nulo(d.cliente_documento),
      contacto_nombre: nulo(d.contacto_nombre),
      contacto_whatsapp: nulo(d.contacto_whatsapp),
      emisor_nombre,
      emisor_documento: nulo(d.emisor_documento) ?? base?.emisor_documento ?? null,
      emisor_marca: nulo(d.emisor_marca) ?? base?.emisor_marca ?? "Lynko · Play Mundial",
      emisor_whatsapp: nulo(d.emisor_whatsapp) ?? base?.emisor_whatsapp ?? null,
      pago_llave: nulo(d.pago_llave) ?? base?.pago_llave ?? null,
      pago_banco: nulo(d.pago_banco) ?? base?.pago_banco ?? null,
      pago_titular: nulo(d.pago_titular) ?? base?.pago_titular ?? null,
      created_by: usuario?.id ?? null,
    })
    .select("id, clave")
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  return { success: true, data: data as { id: string; clave: string } };
}

/** El superadmin edita todo, incluidos los datos que llenó el cliente. */
export async function actualizarCuentaCobro(id: string, input: CuentaCobroInput): Promise<ActionResult> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const p = cuentaSchema.safeParse(input);
  if (!p.success) return { success: false, error: p.error.issues[0].message };
  const d = p.data;
  const tenant = await tenantDelTorneo(d.torneo_id);
  if (tenant === "no-existe") return { success: false, error: "El torneo ya no existe" };
  if (!nulo(d.emisor_nombre)) return { success: false, error: "Pon quién cobra (nombre del prestador)" };
  const cc = resolverConcepto(d);
  if (!cc.ok) return { success: false, error: cc.error };

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("cuentas_cobro")
    .update({
      ...(d.numero ? { numero: d.numero } : {}),
      torneo_id: d.torneo_id ?? null,
      tenant_id: tenant,
      fecha: d.fecha,
      fecha_limite: d.fecha_limite ?? null,
      cliente_nombre: d.cliente_nombre,
      cliente_ciudad: nulo(d.cliente_ciudad),
      concepto: cc.concepto,
      concepto_detalle: nulo(d.concepto_detalle),
      items: d.items.filter((i) => i.trim()),
      lineas: cc.lineas,
      valor: cc.valor,
      nota: nulo(d.nota),
      recibe_nombre: nulo(d.recibe_nombre),
      cliente_documento: nulo(d.cliente_documento),
      contacto_nombre: nulo(d.contacto_nombre),
      contacto_whatsapp: nulo(d.contacto_whatsapp),
      emisor_nombre: nulo(d.emisor_nombre),
      emisor_documento: nulo(d.emisor_documento),
      emisor_marca: nulo(d.emisor_marca) ?? "Lynko · Play Mundial",
      emisor_whatsapp: nulo(d.emisor_whatsapp),
      pago_llave: nulo(d.pago_llave),
      pago_banco: nulo(d.pago_banco),
      pago_titular: nulo(d.pago_titular),
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  revalidatePath(`/superadmin/cuentas-cobro/${id}`);
  const { data } = await svc.from("cuentas_cobro").select("clave").eq("id", id).maybeSingle();
  if (data) revalidatePath(`/cobro/${(data as { clave: string }).clave}`);
  return { success: true, data: undefined };
}

const ESTADOS: EstadoCuentaCobro[] = ["enviada", "datos_completos", "pagada", "anulada"];

/**
 * Cambia el estado: «enviada» deja que el cliente vuelva a completar sus datos;
 * «pagada» registra la fecha de pago.
 */
export async function cambiarEstadoCuentaCobro(id: string, estado: EstadoCuentaCobro): Promise<ActionResult> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  if (!ESTADOS.includes(estado)) return { success: false, error: "Estado inválido" };
  const svc = createServiceRoleClient();
  const { data: previa } = await svc.from("cuentas_cobro").select("clave").eq("id", id).maybeSingle();
  if (!previa) return { success: false, error: "Cuenta de cobro no encontrada" };
  const { error } = await svc
    .from("cuentas_cobro")
    .update({
      estado,
      pagada_at: estado === "pagada" ? new Date().toISOString() : null,
      // Al reabrir los datos al cliente, debe aceptar de nuevo.
      ...(estado === "enviada" ? { datos_completados_at: null, aceptada_at: null, aceptada_valor: null } : {}),
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  revalidatePath(`/superadmin/cuentas-cobro/${id}`);
  revalidatePath(`/cobro/${(previa as { clave: string }).clave}`);
  return { success: true, data: undefined };
}

/** Copia una cuenta como plantilla: mismo concepto y valor, sin los datos del cliente. */
export async function duplicarCuentaCobro(id: string): Promise<ActionResult<{ id: string }>> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const svc = createServiceRoleClient();
  const { data } = await svc.from("cuentas_cobro").select("*").eq("id", id).maybeSingle();
  const c = data as CuentaCobro | null;
  if (!c) return { success: false, error: "Cuenta de cobro no encontrada" };
  const usuario = await getUser();
  const { data: nueva, error } = await svc
    .from("cuentas_cobro")
    .insert({
      clave: claveNueva(),
      torneo_id: null,
      tenant_id: null,
      fecha: hoyColombia(),
      fecha_limite: null,
      cliente_nombre: c.cliente_nombre,
      cliente_ciudad: c.cliente_ciudad,
      concepto: c.concepto,
      concepto_detalle: c.concepto_detalle,
      items: c.items,
      lineas: c.lineas ?? [],
      valor: c.valor,
      nota: c.nota,
      emisor_nombre: c.emisor_nombre,
      emisor_documento: c.emisor_documento,
      emisor_marca: c.emisor_marca,
      emisor_whatsapp: c.emisor_whatsapp,
      pago_llave: c.pago_llave,
      pago_banco: c.pago_banco,
      pago_titular: c.pago_titular,
      created_by: usuario?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  return { success: true, data: nueva as { id: string } };
}

export async function eliminarCuentaCobro(id: string): Promise<ActionResult> {
  if (!(await esSuperadmin())) return NO_AUTORIZADO;
  const { error } = await createServiceRoleClient().from("cuentas_cobro").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin/cuentas-cobro");
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Pública: el cliente completa sus datos
// ---------------------------------------------------------------------------
const datosClienteSchema = z.object({
  recibe_nombre: z.string().trim().min(2, "Escribe el nombre de quien recibe").max(120),
  cliente_documento: z
    .string()
    .trim()
    .min(5, "Escribe el NIT o la cédula")
    .max(30, "El NIT o la cédula es muy largo")
    .regex(/^[0-9A-Za-z.\-\s]+$/, "Usa solo números, puntos y guion"),
  contacto_nombre: z.string().trim().min(2, "Escribe el nombre de contacto").max(120),
  contacto_whatsapp: z.string().trim().max(30).optional(),
  /** Casilla «Acepto esta cuenta de cobro»: sin ella no se guarda. */
  acepto: z.boolean().refine((v) => v === true, "Marca «Acepto esta cuenta de cobro» para continuar"),
});

/**
 * El cliente, con su enlace secreto, completa sus datos UNA vez. Después la
 * cuenta queda bloqueada para él: cualquier corrección la hace el superadmin.
 */
export async function completarDatosCuenta(clave: string, input: unknown): Promise<ActionResult> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(clave)) return { success: false, error: "Enlace inválido" };
  const p = datosClienteSchema.safeParse(input);
  if (!p.success) return { success: false, error: p.error.issues[0].message };
  const d = p.data;

  // Se acepta un valor concreto: si cambió mientras el cliente leía, se le pide recargar.
  const actual = await getCuentaPorClave(clave);
  if (!actual) return { success: false, error: "Enlace inválido" };

  const ahora = new Date().toISOString();
  const { data, error } = await createServiceRoleClient()
    .from("cuentas_cobro")
    .update({
      recibe_nombre: d.recibe_nombre,
      cliente_documento: d.cliente_documento,
      contacto_nombre: d.contacto_nombre,
      contacto_whatsapp: nulo(d.contacto_whatsapp),
      estado: "datos_completos",
      datos_completados_at: ahora,
      aceptada_at: ahora,
      aceptada_valor: actual.valor,
    })
    .eq("clave", clave)
    .eq("estado", "enviada") // solo mientras siga abierta para el cliente
    .eq("valor", actual.valor)
    .select("*");
  if (error) return { success: false, error: "No se pudieron guardar tus datos. Inténtalo de nuevo." };
  if (!data || data.length === 0) {
    return {
      success: false,
      error: "La cuenta cambió o ya no admite cambios. Recarga la página; si persiste, escríbenos.",
    };
  }
  // Aviso al superadmin (celular y correo). Nunca hace fallar lo que el cliente ya guardó.
  await avisarDatosCompletos(data[0] as CuentaCobro);
  revalidatePath(`/cobro/${clave}`);
  revalidatePath("/superadmin/cuentas-cobro");
  return { success: true, data: undefined };
}
