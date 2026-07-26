"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

const registroSchema = z.object({
  nombre: z.string().trim().min(2, "Indica el nombre del organizador"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

function slugify(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "tenant"}-${crypto.randomUUID().slice(0, 4)}`;
}

/** Inicia sesión de admin con email + contraseña (Supabase Auth). */
export async function login(
  input: z.infer<typeof loginSchema>,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { success: false, error: "Credenciales inválidas" };
  }

  return { success: true, data: undefined };
}

/** Registro público de un organizador nuevo y su usuario owner. */
export async function registrarOrganizador(
  input: z.infer<typeof registroSchema>,
): Promise<ActionResult> {
  const parsed = registroSchema.safeParse(input);
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
    const yaExiste = errUser?.message?.toLowerCase().includes("already");
    return { success: false, error: yaExiste ? "Ese email ya está registrado" : (errUser?.message ?? "No se pudo crear el usuario") };
  }

  const { error: errMem } = await svc.from("memberships").insert({
    user_id: userRes.user.id,
    tenant_id: tenantId,
    rol: "owner",
  });
  if (errMem) {
    await svc.auth.admin.deleteUser(userRes.user.id);
    await svc.from("tenants").delete().eq("id", tenantId);
    return { success: false, error: errMem.message };
  }

  await svc.from("tenant_pago_config").insert({ tenant_id: tenantId });

  const supabase = await createClient();
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password });
  if (errLogin) {
    return { success: false, error: "Cuenta creada, pero no se pudo iniciar sesión automáticamente" };
  }

  return { success: true, data: undefined };
}

/** Cierra la sesión y vuelve al login. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
