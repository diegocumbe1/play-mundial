"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { crearMovimientoRifa, eliminarMovimientoRifa } from "@/actions/rifas";
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
import { InputMoneda } from "@/components/rifa/input-moneda";
import { Campo, Segmentado } from "@/components/torneo/campos";
import { formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { cn } from "@/lib/utils";
import type { DashboardRifa, MetodoPago, MovimientoRifa } from "@/types";

const METODO_LABEL: Record<MetodoPago, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};

/**
 * Caja de la rifa: cuánto queda de lo reunido, separado en efectivo y
 * transferencia, y las salidas (retiros o gastos) que lo fueron bajando.
 * Solo lo ve el organizador.
 */
export function CajaRifa({
  rifaId,
  dash,
  movimientos,
}: {
  rifaId: string;
  dash: DashboardRifa;
  movimientos: MovimientoRifa[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);

  function borrar(id: string) {
    startTransition(async () => {
      const r = await eliminarMovimientoRifa(id);
      setBorrando(null);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Salida eliminada");
      router.refresh();
    });
  }

  return (
    <section className="border-border mb-6 rounded-2xl border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4" /> Caja
        </p>
        <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
          <ArrowUpRight className="size-4" /> Registrar retiro o gasto
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Saldo
          label="Disponible"
          valor={dash.saldo}
          sub={`De ${formatCOP(dash.recaudado)} recaudado`}
          className="col-span-2 lg:col-span-1"
          destacado
        />
        <Saldo
          label="En efectivo"
          valor={dash.saldoEfectivo}
          sub={`${formatCOP(dash.recaudadoEfectivo)} cobrado · −${formatCOP(dash.salidasEfectivo)}`}
        />
        <Saldo
          label="En transferencia"
          valor={dash.saldoTransferencia}
          sub={`${formatCOP(dash.recaudadoTransferencia)} cobrado · −${formatCOP(dash.salidasTransferencia)}`}
        />
      </div>

      {movimientos.length > 0 && (
        <ul className="divide-border mt-4 divide-y text-sm">
          {movimientos.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.detalle || (m.tipo === "gasto" ? "Gasto" : "Retiro")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {m.tipo === "gasto" ? "Gasto" : "Retiro"} · {METODO_LABEL[m.metodo]}
                  {" · "}
                  {formatFechaCO(m.created_at, { conAnio: false })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  −{formatCOP(m.monto)}
                </span>
                {borrando === m.id ? (
                  <>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setBorrando(null)}>
                      No
                    </Button>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => borrar(m.id)}>
                      Borrar
                    </Button>
                  </>
                ) : (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Eliminar salida"
                    onClick={() => setBorrando(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SalidaModal
        rifaId={rifaId}
        dash={dash}
        open={abierto}
        onClose={() => setAbierto(false)}
      />
    </section>
  );
}

function Saldo({
  label,
  valor,
  sub,
  className,
  destacado,
}: {
  label: string;
  valor: number;
  sub: string;
  className?: string;
  destacado?: boolean;
}) {
  return (
    <div className={cn("border-border rounded-xl border p-3", destacado && "bg-muted/40", className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          valor < 0 && "text-rose-600 dark:text-rose-400",
        )}
      >
        {formatCOP(valor)}
      </p>
      <p className="text-muted-foreground text-[11px] tabular-nums">{sub}</p>
    </div>
  );
}

function SalidaModal({
  rifaId,
  dash,
  open,
  onClose,
}: {
  rifaId: string;
  dash: DashboardRifa;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<MovimientoRifa["tipo"]>("retiro");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("transferencia");
  const [detalle, setDetalle] = useState("");

  const disponible = metodo === "efectivo" ? dash.saldoEfectivo : dash.saldoTransferencia;

  function guardar() {
    startTransition(async () => {
      const r = await crearMovimientoRifa({
        rifa_id: rifaId,
        tipo,
        monto: Number(monto),
        metodo,
        detalle: detalle.trim() || null,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(`${tipo === "gasto" ? "Gasto" : "Retiro"} de ${formatCOP(Number(monto))} registrado`);
      setMonto("");
      setDetalle("");
      setTipo("retiro");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar retiro o gasto</DialogTitle>
          <DialogDescription>
            Se descuenta de lo recaudado para que sepas cuánto queda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Campo label="¿Qué pasó?">
            <Segmentado
              value={tipo}
              onChange={(v) => setTipo(v as MovimientoRifa["tipo"])}
              options={[
                { value: "retiro", label: "Retiré" },
                { value: "gasto", label: "Se gastó" },
              ]}
            />
          </Campo>
          <Campo label="Monto">
            <InputMoneda value={monto} onChange={setMonto} placeholder="650.000" />
          </Campo>
          <Campo
            label="¿De dónde sale?"
            ayuda={`Disponible en ${METODO_LABEL[metodo].toLowerCase()}: ${formatCOP(disponible)}`}
          >
            <Segmentado
              value={metodo}
              onChange={(v) => setMetodo(v as MetodoPago)}
              options={[
                { value: "transferencia", label: METODO_LABEL.transferencia },
                { value: "efectivo", label: METODO_LABEL.efectivo },
              ]}
            />
          </Campo>
          <Campo label="Detalle (opcional)">
            <Input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Compra de premios, gastos hogar…"
              maxLength={200}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={pending || !(Number(monto) > 0)} onClick={guardar}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
