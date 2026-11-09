"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Gift, KeyRound, Lock, Settings, Unlock } from "lucide-react";
import { toast } from "sonner";

import {
  restablecerPasswordOwner,
  setEstadoTenant,
  setMaxTorneosTenant,
  setPlanTenant,
} from "@/actions/tenants";
import { RegistrarCobroForm } from "@/components/superadmin/registrar-cobro-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  roles?: string[];
  emails?: string[];
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
  const [password, setPassword] = useState("");
  const bloqueado = tenant.estado !== "activo";
  const esSuper = metric?.roles?.includes("superadmin") ?? false;

  function cambiarPassword() {
    startTransition(async () => {
      const r = await restablecerPasswordOwner({ tenantId: tenant.id, password });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Contraseña actualizada. Compártela con el organizador.");
      setPassword("");
    });
  }

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
              {tenant.suscripcion_torneos_vence_at && (
                <p className="text-muted-foreground text-xs">
                  Torneos: vence{" "}
                  {new Date(tenant.suscripcion_torneos_vence_at).toLocaleDateString("es-CO")}
                </p>
              )}
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

            {!esSuper && (
              <TopeTorneos
                tenantId={tenant.id}
                max={tenant.max_torneos === undefined ? 1 : tenant.max_torneos}
              />
            )}

            {!bloqueado && <RegistrarCobroForm tenantId={tenant.id} />}

            {!esSuper && (
              <div className="border-border rounded-xl border p-3">
                <p className="text-sm font-semibold">Restablecer contraseña</p>
                <p className="text-muted-foreground mb-2 text-xs">
                  {metric?.emails?.length ? metric.emails.join(", ") : "Owner del organizador"} · la anterior deja de funcionar.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="nueva contraseña (mín. 6)"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || password.length < 6}
                    onClick={cambiarPassword}
                  >
                    <KeyRound className="size-3.5" /> Guardar
                  </Button>
                </div>
              </div>
            )}

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

/**
 * Tope de torneos del organizador. Bloqueado = solo 1 torneo (por defecto);
 * al pagar, el superadmin lo deja sin límite o le fija un número.
 */
function TopeTorneos({ tenantId, max }: { tenantId: string; max: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cantidad, setCantidad] = useState(String(max ?? 2));
  const ilimitado = max === null;

  function guardar(nuevo: number | null, ok: string) {
    startTransition(async () => {
      const r = await setMaxTorneosTenant({ tenantId, max: nuevo });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  const n = Number(cantidad);
  const cantidadValida = Number.isInteger(n) && n >= 1;

  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-sm font-semibold">Torneos permitidos</p>
      <p className="text-muted-foreground mb-2 text-xs">
        {ilimitado
          ? "Sin límite: puede crear todos los torneos que quiera."
          : max === 1
            ? "Bloqueado en 1 torneo (por defecto). Habilítalo cuando pague."
            : `Puede crear hasta ${max} torneos.`}{" "}
        Los demos no cuentan.
      </p>
      <div className="flex flex-wrap gap-2">
        {ilimitado || (max ?? 1) > 1 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => guardar(1, "Organizador limitado a 1 torneo")}
          >
            <Lock className="size-3.5" /> Bloquear en 1
          </Button>
        ) : null}
        {!ilimitado && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => guardar(null, "Torneos sin límite habilitados")}
          >
            <Unlock className="size-3.5" /> Permitir crear más (sin límite)
          </Button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="h-9 w-24"
          aria-label="Cantidad de torneos permitidos"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !cantidadValida || n === max}
          onClick={() => guardar(n, `Tope fijado en ${n} torneo${n === 1 ? "" : "s"}`)}
        >
          Fijar cantidad
        </Button>
      </div>
    </div>
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
    bloquear: "El organizador no podrá usar el panel hasta que lo reactives, y sus rifas publicadas quedan en pausa: el enlace muestra \"Rifa temporalmente en pausa\" y no recibe reservas. Lo vendido no se pierde.",
    reactivar: "El organizador recuperará acceso al panel con el plan que tenga configurado y sus rifas vuelven a estar públicas.",
  }[accion];
}
