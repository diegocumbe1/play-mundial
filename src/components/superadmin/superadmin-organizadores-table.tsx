"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { SuperadminTenantMetric } from "@/actions/tenants";
import { TenantPlanControls } from "@/components/superadmin/tenant-plan-controls";
import { TenantProductosControls } from "@/components/superadmin/tenant-productos-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/rifa";
import type { ProductoPlataforma, Tenant } from "@/types";

const PLAN_LABEL: Record<string, string> = {
  gratis: "Gratis",
  pago_rifa: "Pago por rifa",
  suscripcion: "Suscripción",
};

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function SuperadminOrganizadoresTable({
  metrics,
  nowMs,
  productosPorTenant = {},
}: {
  metrics: SuperadminTenantMetric[];
  nowMs: number;
  /** Verticales habilitadas por organizador (las administra el superadmin). */
  productosPorTenant?: Record<string, ProductoPlataforma[]>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [plan, setPlan] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [rol, setRol] = useState("todos");
  const [senal, setSenal] = useState("todos");

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return metrics.filter((m) => {
      const t = m.tenant;
      if (plan !== "todos" && t.plan_actual !== plan) return false;
      if (estado !== "todos" && t.estado !== estado) return false;
      if (rol !== "todos" && !m.roles.includes(rol as never)) return false;
      if (senal === "pendientes" && m.pendienteCantidadMes === 0) return false;
      if (senal === "sin_rifas_mes" && m.rifasMes > 0) return false;
      if (senal === "con_rifas_mes" && m.rifasMes === 0) return false;
      if (senal === "suscripcion_vencida") {
        if (t.plan_actual !== "suscripcion") return false;
        if (!t.suscripcion_vence_at || new Date(t.suscripcion_vence_at).getTime() >= nowMs) return false;
      }
      if (!q) return true;
      const texto = normalizar([
        t.nombre,
        t.plan_actual,
        t.estado,
        ...m.roles,
        ...m.emails,
      ].join(" "));
      return texto.includes(q);
    });
  }, [busqueda, estado, metrics, nowMs, plan, rol, senal]);

  const hayFiltros =
    busqueda || plan !== "todos" || estado !== "todos" || rol !== "todos" || senal !== "todos";

  function limpiar() {
    setBusqueda("");
    setPlan("todos");
    setEstado("todos");
    setRol("todos");
    setSenal("todos");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-muted/20 rounded-xl border p-3">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, email, rol o plan"
              className="h-9 min-w-0 pl-8 pr-8"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Filtro value={plan} onChange={setPlan} ariaLabel="Filtrar por plan">
            <option value="todos">Todos los planes</option>
            <option value="gratis">Gratis</option>
            <option value="pago_rifa">Pago por rifa</option>
            <option value="suscripcion">Suscripción</option>
          </Filtro>
          <Filtro value={estado} onChange={setEstado} ariaLabel="Filtrar por estado">
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="archivado">Bloqueados</option>
          </Filtro>
          <Filtro value={rol} onChange={setRol} ariaLabel="Filtrar por rol">
            <option value="todos">Todos los roles</option>
            <option value="owner">Owner</option>
            <option value="superadmin">Superadmin</option>
          </Filtro>
          <Filtro value={senal} onChange={setSenal} ariaLabel="Filtrar por señal">
            <option value="todos">Todas las señales</option>
            <option value="pendientes">Pendientes por confirmar</option>
            <option value="con_rifas_mes">Con rifas este mes</option>
            <option value="sin_rifas_mes">Sin rifas este mes</option>
            <option value="suscripcion_vencida">Suscripción vencida</option>
          </Filtro>
          <Button type="button" variant="outline" size="sm" disabled={!hayFiltros} onClick={limpiar} className="w-full">
            Limpiar
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Mostrando {visibles.length} de {metrics.length} organizador(es)
        </p>
      </div>

      {visibles.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No hay organizadores con esos filtros.
        </p>
      ) : (
        <Table className="min-w-[1060px]">
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead className="text-right">Rifas mes</TableHead>
              <TableHead className="text-right">Rifas total</TableHead>
              <TableHead className="text-right">Generado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((m) => {
              const t = m.tenant;
              const esSuper = m.roles.includes("superadmin");
              return (
                <TableRow key={t.id} className={esSuper ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <div className="font-semibold">{t.nombre}</div>
                    <div className="text-muted-foreground max-w-[220px] truncate text-xs">
                      {m.emails.join(", ") || "Sin email"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.roles.map((rolItem) => (
                        <Badge
                          key={rolItem}
                          variant={rolItem === "superadmin" ? "default" : "outline"}
                          className={rolItem === "superadmin" ? "bg-primary text-primary-foreground" : undefined}
                        >
                          {rolItem}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{PLAN_LABEL[t.plan_actual] ?? t.plan_actual}</div>
                    <div className="text-muted-foreground text-xs">{duracionPlan(t, nowMs)}</div>
                  </TableCell>
                  <TableCell>
                    <TenantProductosControls
                      tenantId={t.id}
                      habilitados={productosPorTenant[t.id] ?? []}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{m.rifasMes}</div>
                    <div className="text-muted-foreground text-xs">{m.rifasPagasMes} paga(s)</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{m.rifasTotal}</div>
                    <div className="text-muted-foreground text-xs">acumuladas</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCOP(m.valorGeneradoMes)}</TableCell>
                  <TableCell className="text-right">
                    <div>{formatCOP(m.pendienteMontoMes)}</div>
                    <div className="text-muted-foreground text-xs">{m.pendienteCantidadMes} cobro(s)</div>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.estado === "activo" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {t.estado === "activo" ? "activo" : "bloqueado"}
                    </span>
                    <div className="mt-2">
                      <TenantPlanControls tenant={t} metric={m} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Filtro({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background h-9 min-w-0 rounded-lg border px-2 text-sm"
    >
      {children}
    </select>
  );
}

function duracionPlan(t: Tenant, nowMs: number) {
  if (t.plan_actual === "suscripcion" && t.suscripcion_vence_at) {
    const vence = new Date(t.suscripcion_vence_at);
    const dias = Math.ceil((vence.getTime() - nowMs) / 86_400_000);
    const textoDias = dias >= 0 ? `${dias} día(s) restante(s)` : `venció hace ${Math.abs(dias)} día(s)`;
    return `vence ${vence.toLocaleDateString("es-CO")} · ${textoDias}`;
  }

  const creado = new Date(t.created_at);
  const dias = Math.max(0, Math.floor((nowMs - creado.getTime()) / 86_400_000));
  const base = t.plan_actual === "gratis" ? "gratis desde" : "sin vencimiento · desde";
  return `${base} ${creado.toLocaleDateString("es-CO")} · ${dias} día(s)`;
}
