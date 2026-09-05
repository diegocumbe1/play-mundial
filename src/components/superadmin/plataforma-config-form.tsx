"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { guardarPlataformaConfig } from "@/actions/cobros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputMoneda } from "@/components/rifa/input-moneda";
import type { PlataformaConfig } from "@/types";

/** Editor de precios y reglas del free (solo superadmin). */
export function PlataformaConfigForm({ inicial }: { inicial: PlataformaConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    moneda: inicial.moneda,
    cobro_rifa_modo: inicial.cobro_rifa_modo ?? "boleta",
    cobro_rifa_min: String(inicial.cobro_rifa_min ?? 0),
    cobro_rifa_max: String(inicial.cobro_rifa_max ?? 0),
    precio_rifa_100: String(inicial.precio_rifa_100),
    precio_rifa_500: String(inicial.precio_rifa_500),
    precio_rifa_1000: String(inicial.precio_rifa_1000),
    precio_suscripcion_mes: String(inicial.precio_suscripcion_mes),
    free_rifas_por_mes: String(inicial.free_rifas_por_mes),
    free_rifas_total: String(inicial.free_rifas_total),
    free_max_numeros: String(inicial.free_max_numeros),
    precio_torneo_8: String(inicial.precio_torneo_8),
    precio_torneo_16: String(inicial.precio_torneo_16),
    precio_torneo_32: String(inicial.precio_torneo_32),
    precio_torneo_mas: String(inicial.precio_torneo_mas),
    free_torneos_por_mes: String(inicial.free_torneos_por_mes),
    free_torneos_total: String(inicial.free_torneos_total),
    free_max_equipos: String(inicial.free_max_equipos),
  });

  function set(k: keyof typeof f, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function guardar() {
    startTransition(async () => {
      const r = await guardarPlataformaConfig({
        moneda: f.moneda.trim() || "COP",
        cobro_rifa_modo: f.cobro_rifa_modo === "escalones" ? "escalones" : "boleta",
        cobro_rifa_min: Number(f.cobro_rifa_min) || 0,
        cobro_rifa_max: Number(f.cobro_rifa_max) || 0,
        precio_rifa_100: Number(f.precio_rifa_100) || 0,
        precio_rifa_500: Number(f.precio_rifa_500) || 0,
        precio_rifa_1000: Number(f.precio_rifa_1000) || 0,
        precio_suscripcion_mes: Number(f.precio_suscripcion_mes) || 0,
        free_rifas_por_mes: Number(f.free_rifas_por_mes) || 0,
        free_rifas_total: Number(f.free_rifas_total) || 0,
        free_max_numeros: Number(f.free_max_numeros) || 1,
        precio_torneo_8: Number(f.precio_torneo_8) || 0,
        precio_torneo_16: Number(f.precio_torneo_16) || 0,
        precio_torneo_32: Number(f.precio_torneo_32) || 0,
        precio_torneo_mas: Number(f.precio_torneo_mas) || 0,
        free_torneos_por_mes: Number(f.free_torneos_por_mes) || 0,
        free_torneos_total: Number(f.free_torneos_total) || 0,
        free_max_equipos: Number(f.free_max_equipos) || 1,
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
        <p className="mb-2 text-sm font-semibold">Rifas — cómo se cobra</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-muted-foreground mb-1.5 block text-xs">Regla de cobro</Label>
            <select
              value={f.cobro_rifa_modo}
              onChange={(e) => set("cobro_rifa_modo", e.target.value)}
              className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
            >
              <option value="boleta">El valor de 1 boleta de la rifa</option>
              <option value="escalones">Precio fijo por tamaño</option>
            </select>
          </div>
          <CampoMoneda label="Mínimo por rifa (0 = sin mínimo)" value={f.cobro_rifa_min} onChange={(v) => set("cobro_rifa_min", v)} />
          <CampoMoneda label="Máximo por rifa (0 = sin tope)" value={f.cobro_rifa_max} onChange={(v) => set("cobro_rifa_max", v)} />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Cobrar una boleta equivale a 100/N del recaudo: 1% en una rifa de 100 números,
          3,3% en una de 30 y 0,1% en una de 1000. El mínimo y el máximo evitan los
          extremos (una rifa de boleta muy barata o muy cara).
        </p>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Rifas — precios por tamaño (COP)</p>
        <p className="text-muted-foreground mb-2 text-xs">
          Solo se usan con la regla &quot;precio fijo por tamaño&quot;. La suscripción
          aplica siempre.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoMoneda label="Rifa hasta 100 números" value={f.precio_rifa_100} onChange={(v) => set("precio_rifa_100", v)} />
          <CampoMoneda label="Rifa 101–500 números" value={f.precio_rifa_500} onChange={(v) => set("precio_rifa_500", v)} />
          <CampoMoneda label="Rifa 501–1000 números" value={f.precio_rifa_1000} onChange={(v) => set("precio_rifa_1000", v)} />
          <CampoMoneda label="Suscripción / mes" value={f.precio_suscripcion_mes} onChange={(v) => set("precio_suscripcion_mes", v)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Rifas — capa gratuita</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Rifas gratis por mes" value={f.free_rifas_por_mes} onChange={(v) => set("free_rifas_por_mes", v)} />
          <Campo label="Rifas gratis en total" value={f.free_rifas_total} onChange={(v) => set("free_rifas_total", v)} />
          <Campo label="Máx. números en gratis" value={f.free_max_numeros} onChange={(v) => set("free_max_numeros", v)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Torneos — precios (COP)</p>
        <p className="text-muted-foreground mb-2 text-xs">
          El escalón se decide por el cupo de equipos del torneo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoMoneda label="Torneo hasta 8 equipos" value={f.precio_torneo_8} onChange={(v) => set("precio_torneo_8", v)} />
          <CampoMoneda label="Torneo 9–16 equipos" value={f.precio_torneo_16} onChange={(v) => set("precio_torneo_16", v)} />
          <CampoMoneda label="Torneo 17–32 equipos" value={f.precio_torneo_32} onChange={(v) => set("precio_torneo_32", v)} />
          <CampoMoneda label="Torneo de más de 32 equipos" value={f.precio_torneo_mas} onChange={(v) => set("precio_torneo_mas", v)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Torneos — capa gratuita</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Torneos gratis por mes" value={f.free_torneos_por_mes} onChange={(v) => set("free_torneos_por_mes", v)} />
          <Campo label="Torneos gratis en total" value={f.free_torneos_total} onChange={(v) => set("free_torneos_total", v)} />
          <Campo label="Máx. equipos en gratis" value={f.free_max_equipos} onChange={(v) => set("free_max_equipos", v)} />
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
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
    </div>
  );
}

/** Igual que Campo pero con separadores de miles (para precios). */
function CampoMoneda({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-muted-foreground mb-1.5 block text-xs">{label}</Label>
      <InputMoneda value={value} onChange={onChange} placeholder="0" />
    </div>
  );
}
