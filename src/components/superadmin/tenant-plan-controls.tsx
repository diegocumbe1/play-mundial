"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Gift, Lock, Settings, Unlock } from "lucide-react";
import { toast } from "sonner";

import { setEstadoTenant, setPlanTenant } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/rifa";
import type { Tenant } from "@/types";

interface TenantMetricSummary {
  rifasMes: number;
  rifasTotal: number;
  rifasPagasMes: number;
  valorGeneradoMes: number;
  pendienteMontoMes: number;
  pendienteCantidadMes: number;
  confirmadoMontoMes: number;
  confirmadoCantidadMes: number;
}

type Accion =
  | "suscripcion"
  | "gratis"
  | "pago_rifa"
  | "bloquear"
  | "reactivar";

/** Controles del superadmin para habilitar/bloquear plan de un organizador. */
export function TenantPlanControls({
  tenant,
  metric,
}: {
  tenant: Tenant;
  metric?: TenantMetricSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const bloqueado = tenant.estado !== "activo";

  function correr(accionFn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const r = await accionFn();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      setAccion(null);
      setAbierto(false);
      router.refresh();
    });
  }

  function confirmar() {
    if (accion === "suscripcion") {
      correr(
        () => setPlanTenant({ tenantId: tenant.id, plan: "suscripcion" }),
        "Suscripción habilitada/extendida por 1 mes",
      );
    } else if (accion === "gratis") {
      correr(
        () => setPlanTenant({ tenantId: tenant.id, plan: "gratis" }),
        "Suscripción revertida y plan cambiado a gratis",
      );
    } else if (accion === "pago_rifa") {
      correr(
        () => setPlanTenant({ tenantId: tenant.id, plan: "pago_rifa" }),
        "Plan cambiado a pago por rifa",
      );
    } else if (accion === "bloquear") {
      correr(
        () => setEstadoTenant(tenant.id, "archivado"),
        "Organizador bloqueado",
      );
    } else if (accion === "reactivar") {
      correr(
        () => setEstadoTenant(tenant.id, "activo"),
        "Organizador reactivado",
      );
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(true)}>
        <Settings className="size-3.5" /> Gestionar
      </Button>

      <Dialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setAccion(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar {tenant.nombre}</DialogTitle>
            <DialogDescription>
              Revisa el plan y las métricas antes de habilitar, revertir o bloquear.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="border-border rounded-xl border p-3">
              <p className="text-sm font-semibold">Plan actual</p>
              <p className="text-muted-foreground text-xs">
                {tenant.plan_actual}
                {tenant.suscripcion_vence_at
                  ? ` · vence ${new Date(tenant.suscripcion_vence_at).toLocaleDateString("es-CO")}`
                  : " · sin vencimiento"}
                {bloqueado ? " · bloqueado" : " · activo"}
              </p>
            </div>

            {metric && (
              <div className="grid grid-cols-2 gap-2">
                <MiniMetric label="Rifas mes" value={String(metric.rifasMes)} sub={`${metric.rifasPagasMes} paga(s)`} />
                <MiniMetric label="Rifas total" value={String(metric.rifasTotal)} />
                <MiniMetric label="Generado" value={formatCOP(metric.valorGeneradoMes)} sub={`${metric.confirmadoCantidadMes} pago(s)`} />
                <MiniMetric label="Pendiente" value={formatCOP(metric.pendienteMontoMes)} sub={`${metric.pendienteCantidadMes} cobro(s)`} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || bloqueado} onClick={() => setAccion("suscripcion")}>
                <CheckCircle2 className="size-3.5" /> Habilitar/Extender suscripción
              </Button>
              <Button variant="outline" disabled={pending || bloqueado} onClick={() => setAccion("gratis")}>
                <Gift className="size-3.5" /> Revertir a gratis
              </Button>
              <Button variant="outline" disabled={pending || bloqueado} onClick={() => setAccion("pago_rifa")}>
                <Ban className="size-3.5" /> Pago por rifa
              </Button>
              <Button
                variant={bloqueado ? "outline" : "destructive"}
                disabled={pending}
                onClick={() => setAccion(bloqueado ? "reactivar" : "bloquear")}
              >
                {bloqueado ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                {bloqueado ? "Reactivar" : "Bloquear"}
              </Button>
            </div>

            {accion && (
              <div className="border-primary/40 bg-primary/10 rounded-xl border p-3 text-sm">
                <p className="font-semibold">{tituloAccion(accion)}</p>
                <p className="text-muted-foreground mt-1 text-xs">{descripcionAccion(accion)}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setAccion(null)}>
              Cancelar
            </Button>
            <Button disabled={pending || !accion} onClick={confirmar}>
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MiniMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-border rounded-lg border p-2">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-[10px]">{sub}</p>}
    </div>
  );
}

function tituloAccion(accion: Accion) {
  return {
    suscripcion: "Habilitar o extender suscripción",
    gratis: "Revertir suscripción a plan gratis",
    pago_rifa: "Cambiar a pago por rifa",
    bloquear: "Bloquear organizador",
    reactivar: "Reactivar organizador",
  }[accion];
}

function descripcionAccion(accion: Accion) {
  return {
    suscripcion: "Agrega 1 mes de acceso. Si ya tiene suscripción vigente, se extiende desde su vencimiento actual.",
    gratis: "Quita el vencimiento de suscripción y vuelve al plan gratis. Úsalo para corregir activaciones hechas por error.",
    pago_rifa: "Quita el vencimiento de suscripción y deja al organizador pagando por cada rifa cuando corresponda.",
    bloquear: "El organizador no podrá usar el panel hasta que lo reactives.",
    reactivar: "El organizador recuperará acceso al panel con el plan que tenga configurado.",
  }[accion];
}
