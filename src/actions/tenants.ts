"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, Tenant, TenantPagoConfig } from "@/types";

/**
 * Server Actions de tenants. Crear tenants + owners es del superadmin; cada
 * owner administra su propia config de cobro (Nequi/QR/WhatsApp).
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
  llave: z.string().trim().nullable().optional(),
  titular: z.string().trim().nullable().optional(),
  qr_url: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  mensaje_qr: z.string().trim().nullable().optional(),
});

/** El owner guarda sus datos de cobro (upsert por tenant). Requiere Nequi o Llave. */
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

  if (!d.nequi_llave?.trim() && !d.llave?.trim()) {
    return { success: false, error: "Indica al menos un medio de pago: Nequi o Llave" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_pago_config").upsert({
    tenant_id: membership.tenant_id,
    nequi_llave: d.nequi_llave?.trim() || null,
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
