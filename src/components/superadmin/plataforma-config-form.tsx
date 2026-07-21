"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { guardarPlataformaConfig } from "@/actions/cobros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlataformaConfig } from "@/types";

/** Editor de precios y reglas del free (solo superadmin). */
export function PlataformaConfigForm({ inicial }: { inicial: PlataformaConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    moneda: inicial.moneda,
    precio_rifa_100: String(inicial.precio_rifa_100),
    precio_rifa_500: String(inicial.precio_rifa_500),
    precio_suscripcion_mes: String(inicial.precio_suscripcion_mes),
    free_rifas_por_mes: String(inicial.free_rifas_por_mes),
    free_rifas_total: String(inicial.free_rifas_total),
    free_max_numeros: String(inicial.free_max_numeros),
  });

  function set(k: keyof typeof f, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function guardar() {
    startTransition(async () => {
      const r = await guardarPlataformaConfig({
        moneda: f.moneda.trim() || "COP",
        precio_rifa_100: Number(f.precio_rifa_100) || 0,
        precio_rifa_500: Number(f.precio_rifa_500) || 0,
        precio_suscripcion_mes: Number(f.precio_suscripcion_mes) || 0,
        free_rifas_por_mes: Number(f.free_rifas_por_mes) || 0,
        free_rifas_total: Number(f.free_rifas_total) || 0,
        free_max_numeros: Number(f.free_max_numeros) || 1,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Precios actualizados");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-semibold">Precios (COP)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Rifa hasta 100 números" value={f.precio_rifa_100} onChange={(v) => set("precio_rifa_100", v)} />
          <Campo label="Rifa 101–500 números" value={f.precio_rifa_500} onChange={(v) => set("precio_rifa_500", v)} />
          <Campo label="Suscripción / mes" value={f.precio_suscripcion_mes} onChange={(v) => set("precio_suscripcion_mes", v)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Capa gratuita</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Rifas gratis por mes" value={f.free_rifas_por_mes} onChange={(v) => set("free_rifas_por_mes", v)} />
          <Campo label="Rifas gratis en total" value={f.free_rifas_total} onChange={(v) => set("free_rifas_total", v)} />
          <Campo label="Máx. números en gratis" value={f.free_max_numeros} onChange={(v) => set("free_max_numeros", v)} />
        </div>
      </div>
      <div>
        <Button onClick={guardar} disabled={pending}>Guardar precios y reglas</Button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-muted-foreground mb-1.5 block text-xs">{label}</Label>
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
