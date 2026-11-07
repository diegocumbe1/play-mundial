"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { toast } from "sonner";

import { registrarCobroManual } from "@/actions/cobros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCOP } from "@/lib/rifa";
import type { ProductoPlataforma } from "@/types";

const SELECT_CLS =
  "border-input bg-background h-9 w-full rounded-lg border px-2 text-sm text-foreground";

/**
 * Registra un cobro acordado por fuera con el organizador (monto libre).
 * Queda pendiente: el tiempo de suscripción corre desde que se confirma el pago.
 */
export function RegistrarCobroForm({
  tenantId,
  onRegistrado,
}: {
  tenantId: string;
  onRegistrado?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [producto, setProducto] = useState<ProductoPlataforma>("torneos");
  const [monto, setMonto] = useState("");
  const [meses, setMeses] = useState("1");
  const [nota, setNota] = useState("");

  const montoNum = Number(monto.replace(/\D/g, "")) || 0;

  function registrar() {
    startTransition(async () => {
      const r = await registrarCobroManual({
        tenantId,
        producto,
        monto: montoNum,
        meses: Number(meses),
        nota: nota.trim() || undefined,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(
        producto === "torneos"
          ? "Cobro registrado como pendiente y módulo de torneos habilitado"
          : "Cobro registrado como pendiente",
      );
      setMonto("");
      setMeses("1");
      setNota("");
      router.refresh();
      onRegistrado?.();
    });
  }

  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-sm font-semibold">Registrar cobro</p>
      <p className="text-muted-foreground mb-2 text-xs">
        Para precios acordados por fuera. Queda pendiente hasta que confirmes el pago; al
        confirmarlo se activan los meses de suscripción.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-muted-foreground mb-1 block text-xs">Producto</Label>
          <select
            className={SELECT_CLS}
            value={producto}
            onChange={(e) => setProducto(e.target.value as ProductoPlataforma)}
          >
            <option value="torneos">Torneos</option>
            <option value="rifas">Rifas (PRO)</option>
          </select>
        </div>
        <div>
          <Label className="text-muted-foreground mb-1 block text-xs">Meses que cubre</Label>
          <select className={SELECT_CLS} value={meses} onChange={(e) => setMeses(e.target.value)}>
            {[1, 2, 3, 4, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mes" : "meses"}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground mb-1 block text-xs">Monto cobrado (COP)</Label>
          <Input
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="130000"
            className="h-9"
          />
          {montoNum > 0 && (
            <p className="text-muted-foreground mt-1 text-[11px]">{formatCOP(montoNum)}</p>
          )}
        </div>
        <div className="col-span-2">
          <Label className="text-muted-foreground mb-1 block text-xs">Nota (opcional)</Label>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. torneo de diciembre, paga en 2 cuotas"
            maxLength={300}
            className="h-9"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        disabled={pending || montoNum <= 0}
        onClick={registrar}
      >
        <Receipt className="size-3.5" /> Registrar cobro pendiente
      </Button>
    </div>
  );
}
