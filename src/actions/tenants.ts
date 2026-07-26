"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, PlanTenant, RolMembership, Tenant, TenantPagoConfig } from "@/types";

/**
 * Server Actions de tenants. Crear tenants + owners es del superadmin; cada
 * owner administra su propia config de cobro (cuenta/Bre-B/QR/WhatsApp).
 */

function slugify(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const sufijo = crypto.randomUUID().slice(0, 4);
  return `${base || "tenant"}-${sufijo}`;
}

/** Lista todos los tenants. Solo superadmin (RLS lo garantiza). */
export async function getTenants(): Promise<ActionResult<Tenant[]>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Tenant[]) ?? [] };
}

export interface SuperadminTenantMetric {
  tenant: Tenant;
  roles: RolMembership[];
  emails: string[];
  rifasMes: number;
  rifasTotal: number;
  rifasPagasMes: number;
  valorGeneradoMes: number;
  pendienteMontoMes: number;
  pendienteCantidadMes: number;
  confirmadoMontoMes: number;
  confirmadoCantidadMes: number;
}

export interface SuperadminDashboard {
  mes: string;
  nowMs: number;
  totalUsuarios: number;
  totalOrganizadores: number;
  totalSuperadmins: number;
  usuariosSuscripcion: number;
  usuariosPagoPorRifa: number;
  usuariosGratis: number;
  usuariosBloqueados: number;
  rifasMes: number;
  rifasTotal: number;
  rifasPagasMes: number;
  valorGeneradoMes: number;
  pendienteMontoMes: number;
  pendienteCantidadMes: number;
  confirmadoMontoMes: number;
  confirmadoCantidadMes: number;
  tenants: SuperadminTenantMetric[];
}

function normalizarMes(mes?: string): string {
  return /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : new Date().toISOString().slice(0, 7);
}

function rangoMes(mes: string) {
  const [year, month] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(year, month - 1, 1));
  const fin = new Date(Date.UTC(year, month, 1));
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}

/** Métricas de plataforma para el dashboard de superadmin. */
export async function getSuperadminDashboard(mesInput?: string): Promise<ActionResult<SuperadminDashboard>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }

  const mes = normalizarMes(mesInput);
  const { inicio, fin } = rangoMes(mes);
  const svc = createServiceRoleClient();

  const [
    { data: tenantsData, error: tenantsError },
    { data: membershipsData, error: membershipsError },
    { data: rifasData, error: rifasError },
    { data: cobrosData, error: cobrosError },
  ] = await Promise.all([
    svc.from("tenants").select("*").order("created_at", { ascending: false }),
    svc.from("memberships").select("*"),
    svc.from("rifas").select("id, tenant_id, cobro_tipo, created_at, activada_at"),
    svc.from("cobros").select("id, tenant_id, tipo, monto, estado, created_at, pagado_at"),
  ]);

  const error = tenantsError ?? membershipsError ?? rifasError ?? cobrosError;
  if (error) return { success: false, error: error.message };

  const tenants = (tenantsData as Tenant[]) ?? [];
  const memberships = (membershipsData as { user_id: string; tenant_id: string; rol: RolMembership }[]) ?? [];
  const rifas = (rifasData as { tenant_id: string; cobro_tipo: PlanTenant | null; created_at: string; activada_at: string | null }[]) ?? [];
  const cobros = (cobrosData as { tenant_id: string; monto: number; estado: string; created_at: string; pagado_at: string | null }[]) ?? [];

  const emailsPorUser = new Map<string, string>();
  let pagina = 1;
  while (pagina <= 20) {
    const { data, error: usersError } = await svc.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (usersError) return { success: false, error: usersError.message };
    for (const user of data.users) emailsPorUser.set(user.id, user.email ?? user.id);
    if (data.users.length < 1000) break;
    pagina += 1;
  }

  const enMes = (fecha: string | null) => Boolean(fecha && fecha >= inicio && fecha < fin);
  const tenantMetrics = tenants.map<SuperadminTenantMetric>((tenant) => {
    const m = memberships.filter((x) => x.tenant_id === tenant.id);
    const tenantRifas = rifas.filter((r) => r.tenant_id === tenant.id);
    const tenantCobros = cobros.filter((c) => c.tenant_id === tenant.id);
    const pendientes = tenantCobros.filter((c) => c.estado === "pendiente" && enMes(c.created_at));
    const confirmados = tenantCobros.filter((c) => c.estado === "pagado" && enMes(c.pagado_at ?? c.created_at));

    return {
      tenant,
      roles: [...new Set(m.map((x) => x.rol))],
      emails: m.map((x) => emailsPorUser.get(x.user_id) ?? x.user_id),
      rifasMes: tenantRifas.filter((r) => enMes(r.created_at)).length,
      rifasTotal: tenantRifas.length,
      rifasPagasMes: tenantRifas.filter((r) => r.cobro_tipo === "pago_rifa" && enMes(r.activada_at ?? r.created_at)).length,
      valorGeneradoMes: confirmados.reduce((s, c) => s + c.monto, 0),
      pendienteMontoMes: pendientes.reduce((s, c) => s + c.monto, 0),
      pendienteCantidadMes: pendientes.length,
      confirmadoMontoMes: confirmados.reduce((s, c) => s + c.monto, 0),
      confirmadoCantidadMes: confirmados.length,
    };
  });

  const totalUsuarios = new Set(memberships.map((m) => m.user_id)).size;
  const totalSuperadmins = new Set(memberships.filter((m) => m.rol === "superadmin").map((m) => m.user_id)).size;
  const pendientesMes = cobros.filter((c) => c.estado === "pendiente" && enMes(c.created_at));
  const confirmadosMes = cobros.filter((c) => c.estado === "pagado" && enMes(c.pagado_at ?? c.created_at));

  return {
    success: true,
    data: {
      mes,
      nowMs: Date.now(),
      totalUsuarios,
      totalOrganizadores: tenants.length,
      totalSuperadmins,
      usuariosGratis: tenants.filter((t) => t.plan_actual === "gratis").length,
      usuariosSuscripcion: tenants.filter((t) => t.plan_actual === "suscripcion").length,
      usuariosPagoPorRifa: tenants.filter((t) => t.plan_actual === "pago_rifa").length,
      usuariosBloqueados: tenants.filter((t) => t.estado !== "activo").length,
      rifasMes: rifas.filter((r) => enMes(r.created_at)).length,
      rifasTotal: rifas.length,
      rifasPagasMes: rifas.filter((r) => r.cobro_tipo === "pago_rifa" && enMes(r.activada_at ?? r.created_at)).length,
      valorGeneradoMes: confirmadosMes.reduce((s, c) => s + c.monto, 0),
      pendienteMontoMes: pendientesMes.reduce((s, c) => s + c.monto, 0),
      pendienteCantidadMes: pendientesMes.length,
      confirmadoMontoMes: confirmadosMes.reduce((s, c) => s + c.monto, 0),
      confirmadoCantidadMes: confirmadosMes.length,
      tenants: tenantMetrics,
    },
  };
}

const nuevoTenantSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del organizador es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * Crea un tenant + su usuario owner + la membresía. Solo superadmin.
 * Usa el admin API de Supabase (service role) para crear el usuario confirmado.
 */
export async function crearTenantConOwner(
  input: z.infer<typeof nuevoTenantSchema>,
): Promise<ActionResult<{ tenantId: string }>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  const parsed = nuevoTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { nombre, email, password } = parsed.data;

  const svc = createServiceRoleClient();

  const { data: tenant, error: errTenant } = await svc
    .from("tenants")
    .insert({ nombre, slug: slugify(nombre) })
    .select("id")
    .single();
  if (errTenant) return { success: false, error: errTenant.message };
  const tenantId = (tenant as { id: string }).id;

  const { data: userRes, error: errUser } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errUser || !userRes?.user) {
    await svc.from("tenants").delete().eq("id", tenantId);
    return { success: false, error: errUser?.message ?? "No se pudo crear el usuario" };
  }

  const { error: errMem } = await svc.from("memberships").insert({
    user_id: userRes.user.id,
    tenant_id: tenantId,
    rol: "owner",
  });
  if (errMem) return { success: false, error: errMem.message };

  await svc.from("tenant_pago_config").insert({ tenant_id: tenantId });

  revalidatePath("/superadmin");
  return { success: true, data: { tenantId } };
}

/** Archiva o reactiva un tenant. Solo superadmin. */
export async function setEstadoTenant(
  tenantId: string,
  estado: "activo" | "archivado",
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  const svc = createServiceRoleClient();
  const { error } = await svc.from("tenants").update({ estado }).eq("id", tenantId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/superadmin");
  return { success: true, data: undefined };
}

const planTenantSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(["gratis", "pago_rifa", "suscripcion"]),
});

/** Cambia manualmente el plan de un organizador. Solo superadmin. */
export async function setPlanTenant(
  input: z.infer<typeof planTenantSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  const parsed = planTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { tenantId, plan } = parsed.data;
  const patch: { plan_actual: PlanTenant; suscripcion_vence_at: string | null } = {
    plan_actual: plan,
    suscripcion_vence_at: null,
  };

  if (plan === "suscripcion") {
    const { data: tenantActual } = await createServiceRoleClient()
      .from("tenants")
      .select("suscripcion_vence_at")
      .eq("id", tenantId)
      .maybeSingle();
    const actual = (tenantActual as { suscripcion_vence_at: string | null } | null)
      ?.suscripcion_vence_at;
    const vence =
      actual && new Date(actual).getTime() > Date.now()
        ? new Date(actual)
        : new Date();
    vence.setMonth(vence.getMonth() + 1);
    patch.suscripcion_vence_at = vence.toISOString();
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.from("tenants").update(patch).eq("id", tenantId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/superadmin");
  revalidatePath("/admin/rifas");
  return { success: true, data: undefined };
}

/** Config de cobro del tenant del usuario actual. */
export async function getMiPagoConfig(): Promise<ActionResult<TenantPagoConfig | null>> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_pago_config")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();
  return { success: true, data: (data as TenantPagoConfig | null) ?? null };
}

const pagoConfigSchema = z.object({
  nequi_llave: z.string().trim().nullable().optional(),
  cuenta_tipo: z.string().trim().nullable().optional(),
  cuenta_numero: z.string().trim().nullable().optional(),
  llave: z.string().trim().nullable().optional(),
  titular: z.string().trim().nullable().optional(),
  qr_url: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  mensaje_qr: z.string().trim().nullable().optional(),
});

/** El owner guarda sus datos de cobro (upsert por tenant). Requiere cuenta o Bre-B. */
export async function guardarPagoConfig(
  input: z.infer<typeof pagoConfigSchema>,
): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = pagoConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const cuentaNumero = d.cuenta_numero?.trim() || d.nequi_llave?.trim() || "";
  const cuentaTipo = d.cuenta_tipo?.trim() || (cuentaNumero ? "nequi" : "");

  if (!cuentaNumero && !d.llave?.trim()) {
    return { success: false, error: "Indica al menos un medio de pago: cuenta o Llave Bre-B" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_pago_config").upsert({
    tenant_id: membership.tenant_id,
    nequi_llave: cuentaTipo === "nequi" ? cuentaNumero : null,
    cuenta_tipo: cuentaTipo || null,
    cuenta_numero: cuentaNumero || null,
    llave: d.llave?.trim() || null,
    titular: d.titular?.trim() || null,
    qr_url: d.qr_url?.trim() || null,
    whatsapp: d.whatsapp?.trim() || null,
    mensaje_qr: d.mensaje_qr?.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/rifas");
  return { success: true, data: undefined };
}

/**
 * Sube la imagen del QR de pago a Supabase Storage (bucket público `qr-pagos`)
 * y devuelve su URL pública. Usa service role (no expone credenciales).
 */
export async function subirQrImagen(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecciona una imagen" };
  }
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "El archivo debe ser una imagen" };
  }
  if (file.size > 3 * 1024 * 1024) {
    return { success: false, error: "La imagen no puede superar 3 MB" };
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${membership.tenant_id}/qr-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const svc = createServiceRoleClient();
  const { error } = await svc.storage
    .from("qr-pagos")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (error) return { success: false, error: error.message };

  const { data } = svc.storage.from("qr-pagos").getPublicUrl(path);
  return { success: true, data: { url: data.publicUrl } };
}
