// =============================================================================
// Siembra el PRIMER superadmin de la plataforma (bootstrap de una sola vez).
//
// Crea el usuario en Supabase Auth (sin correo de validación), un tenant y la
// membresía con rol 'superadmin'. Idempotente: puedes correrlo varias veces.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/seed-superadmin.mjs <email> <password> ["Nombre"]
//
// Necesita en .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (las migraciones deben estar aplicadas antes: ./scripts/migrate.sh)
// =============================================================================
import { createClient } from "@supabase/supabase-js";

const [, , email, password, nombreArg] = process.argv;
const nombre = nombreArg || "Plataforma";

if (!email || !password) {
  console.error("Uso: node --env-file=.env.local scripts/seed-superadmin.mjs <email> <password> [\"Nombre\"]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const svc = createClient(url, key, { auth: { persistSession: false } });

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "plataforma";
}

// 1) Usuario (crear o reusar el existente) -----------------------------------
let userId;
const creado = await svc.auth.admin.createUser({ email, password, email_confirm: true });
if (creado.error) {
  if (/already|exist|registered/i.test(creado.error.message)) {
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existente = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existente) {
      console.error("❌ El email ya existe pero no lo pude localizar:", creado.error.message);
      process.exit(1);
    }
    userId = existente.id;
    console.log("ℹ️  Usuario ya existía, se reutiliza.");
  } else {
    console.error("❌ No se pudo crear el usuario:", creado.error.message);
    process.exit(1);
  }
} else {
  userId = creado.data.user.id;
  console.log("✅ Usuario creado.");
}

// 2) Tenant (crear o reusar por slug) ----------------------------------------
const slug = slugify(nombre);
let tenantId;
const { data: tExist } = await svc.from("tenants").select("id").eq("slug", slug).maybeSingle();
if (tExist) {
  tenantId = tExist.id;
  console.log("ℹ️  Tenant ya existía, se reutiliza.");
} else {
  const { data: tNew, error } = await svc
    .from("tenants")
    .insert({ nombre, slug, plan_actual: "suscripcion" })
    .select("id")
    .single();
  if (error) {
    console.error("❌ No se pudo crear el tenant:", error.message);
    process.exit(1);
  }
  tenantId = tNew.id;
  console.log("✅ Tenant creado.");
}

// 3) Membresía superadmin (upsert por unique user_id+tenant_id) ---------------
const { error: mErr } = await svc
  .from("memberships")
  .upsert({ user_id: userId, tenant_id: tenantId, rol: "superadmin" }, { onConflict: "user_id,tenant_id" });
if (mErr) {
  console.error("❌ No se pudo crear la membresía:", mErr.message);
  process.exit(1);
}

// 4) Config de cobro vacía (para que el tenant pueda editarla) ----------------
await svc.from("tenant_pago_config").upsert({ tenant_id: tenantId }, { onConflict: "tenant_id" });

console.log(`\n✅ Superadmin listo: ${email}`);
console.log(`   Tenant: ${nombre} (${tenantId})`);
console.log("   Ingresa en /admin/login y luego abre /superadmin");
