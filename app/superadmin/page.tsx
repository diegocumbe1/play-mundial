import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { esSuperadmin } from "@/lib/auth";
import { getTenants } from "@/actions/tenants";
import { getCobros } from "@/actions/cobros";
import { formatCOP } from "@/lib/rifa";
import { buttonVariants } from "@/components/ui/button";
import { CrearTenantForm } from "@/components/superadmin/crear-tenant-form";
import { ConfirmarCobroButton } from "@/components/superadmin/confirmar-cobro-button";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  pago_rifa: "Pago por rifa",
  suscripcion: "Suscripción",
  gratis: "Gratis",
};

export default async function SuperadminPage() {
  if (!(await esSuperadmin())) redirect("/admin/rifas");

  const [tenantsRes, cobrosRes] = await Promise.all([getTenants(), getCobros()]);
  const tenants = tenantsRes.success ? tenantsRes.data : [];
  const cobros = cobrosRes.success ? cobrosRes.data : [];
  const pendientes = cobros.filter((c) => c.estado === "pendiente");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de plataforma</h1>
          <p className="text-muted-foreground text-sm">Organizadores, cobros y configuración.</p>
        </div>
        <Link href="/superadmin/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Settings className="size-3.5" /> Precios
        </Link>
      </header>

      {/* Cobros pendientes */}
      <section className="border-border mb-6 rounded-2xl border p-4">
        <p className="mb-3 text-sm font-semibold">
          Cobros pendientes {pendientes.length > 0 && <span className="text-amber-600 dark:text-amber-400">({pendientes.length})</span>}
        </p>
        {pendientes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay cobros por confirmar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((c) => (
              <li key={c.id} className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-semibold">{formatCOP(c.monto)}</p>
                  <p className="text-muted-foreground text-xs">
                    {TIPO_LABEL[c.tipo] ?? c.tipo}
                    {c.periodo ? ` · ${c.periodo}` : ""}
                  </p>
                </div>
                <ConfirmarCobroButton cobroId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Alta de organizador */}
      <section className="border-border mb-6 rounded-2xl border p-4">
        <p className="mb-3 text-sm font-semibold">Nuevo organizador</p>
        <CrearTenantForm />
      </section>

      {/* Organizadores */}
      <section className="border-border rounded-2xl border p-4">
        <p className="mb-3 text-sm font-semibold">Organizadores ({tenants.length})</p>
        {tenants.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aún no hay organizadores.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tenants.map((t) => (
              <li key={t.id} className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-semibold">{t.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    Plan: {t.plan_actual}
                    {t.suscripcion_vence_at ? ` · vence ${new Date(t.suscripcion_vence_at).toLocaleDateString("es-CO")}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.estado === "activo" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {t.estado}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
