import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { esSuperadmin } from "@/lib/auth";
import { getSuperadminDashboard } from "@/actions/tenants";
import { getProductosDeTodos } from "@/actions/productos";
import { getCobros } from "@/actions/cobros";
import { formatCOP } from "@/lib/rifa";
import { buttonVariants } from "@/components/ui/button";
import { CrearTenantForm } from "@/components/superadmin/crear-tenant-form";
import { ConfirmarCobroButton } from "@/components/superadmin/confirmar-cobro-button";
import { SuperadminOrganizadoresTable } from "@/components/superadmin/superadmin-organizadores-table";
import type { Cobro, ProductoPlataforma } from "@/types";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  pago_rifa: "Pago por rifa",
  suscripcion: "Suscripción",
  gratis: "Gratis",
};

/**
 * El ledger es multi-producto: `pago_rifa` es la modalidad "pago por unidad",
 * así que el texto depende de la vertical del cobro.
 */
function labelCobro(cobro: Cobro): string {
  if (cobro.tipo === "pago_rifa") {
    return cobro.producto === "torneos" ? "Pago por torneo" : "Pago por rifa";
  }
  return TIPO_LABEL[cobro.tipo] ?? cobro.tipo;
}

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  if (!(await esSuperadmin())) redirect("/admin/rifas");

  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const [dashboardRes, cobrosRes, productosRes] = await Promise.all([
    getSuperadminDashboard(mes),
    getCobros(),
    getProductosDeTodos(),
  ]);

  // Verticales habilitadas por organizador, agrupadas para la tabla.
  const productosPorTenant: Record<string, ProductoPlataforma[]> = {};
  if (productosRes.success) {
    for (const fila of productosRes.data) {
      if (!fila.habilitado) continue;
      (productosPorTenant[fila.tenant_id] ??= []).push(fila.producto);
    }
  }
  const dashboard = dashboardRes.success ? dashboardRes.data : null;
  const tenants = dashboard?.tenants.map((m) => m.tenant) ?? [];
  const cobros = cobrosRes.success ? cobrosRes.data : [];
  const pendientes = cobros.filter((c) => c.estado === "pendiente");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de plataforma</h1>
          <p className="text-muted-foreground text-sm">Organizadores, cobros y configuración.</p>
        </div>
        <Link href="/superadmin/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Settings className="size-3.5" /> Precios
        </Link>
      </header>

      {dashboard && (
        <>
          <section className="border-border mb-6 rounded-2xl border p-4">
            <form className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Dashboard</p>
                <p className="text-muted-foreground text-xs">Métricas filtradas por mes.</p>
              </div>
              <label className="text-muted-foreground text-xs">
                Mes
                <input
                  type="month"
                  name="mes"
                  defaultValue={dashboard.mes}
                  className="border-input bg-background ml-2 h-8 rounded-lg border px-2 text-sm text-foreground"
                />
              </label>
              <button className={buttonVariants({ size: "sm" })}>Filtrar</button>
            </form>
          </section>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Usuarios creados" value={String(dashboard.totalUsuarios)} sub={`${dashboard.totalSuperadmins} superadmin`} />
            <Metric label="Organizadores" value={String(dashboard.totalOrganizadores)} sub={`${dashboard.usuariosBloqueados} bloqueado(s)`} />
            <Metric label="Plan gratis" value={String(dashboard.usuariosGratis)} sub="Capa gratuita" />
            <Metric label="Con suscripción" value={String(dashboard.usuariosSuscripcion)} sub={`${dashboard.usuariosPagoPorRifa} pago por rifa`} />
            <Metric label="Rifas del mes" value={String(dashboard.rifasMes)} sub="Creadas este mes" />
            <Metric label="Rifas totales" value={String(dashboard.rifasTotal)} sub="Acumulado plataforma" />
            <Metric label="Rifas pagas" value={String(dashboard.rifasPagasMes)} sub="Activadas por pago" />
            <Metric label="Valor generado" value={formatCOP(dashboard.valorGeneradoMes)} sub="Pagos confirmados" />
            <Metric label="Pendiente por confirmar" value={formatCOP(dashboard.pendienteMontoMes)} sub={`${dashboard.pendienteCantidadMes} cobro(s)`} />
            <Metric label="Pagos confirmados" value={String(dashboard.confirmadoCantidadMes)} sub={formatCOP(dashboard.confirmadoMontoMes)} />
          </section>
        </>
      )}

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
                    {labelCobro(c)}
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
        {!dashboard || dashboard.tenants.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aún no hay organizadores.</p>
        ) : (
          <SuperadminOrganizadoresTable
            metrics={dashboard.tenants}
            nowMs={dashboard.nowMs}
            productosPorTenant={productosPorTenant}
          />
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
    </div>
  );
}
