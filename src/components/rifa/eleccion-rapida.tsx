"use client";

import { useState } from "react";
import { toast } from "sonner";

import { elegirAlAzar, elegirSeguidos } from "@/lib/rifa";

export type ModoEleccion = "azar" | "seguidos" | "manual";

const TONOS = {
  publica: {
    caja: "border-[var(--rifa-line)] bg-[var(--rifa-surface)]",
    activo: "bg-[var(--rifa-accent)] text-[var(--rifa-accent-ink)]",
    normal: "border border-[var(--rifa-line)]",
    sub: "text-[var(--rifa-muted)]",
  },
  admin: {
    caja: "border-border bg-card",
    activo: "bg-primary text-primary-foreground",
    normal: "border border-border hover:bg-muted",
    sub: "text-muted-foreground",
  },
} as const;

/**
 * Cómo armar una compra de varios números: al azar, seguidos o a mano. En las
 * rifas con mínimo por compra (p. ej. 10 × $1.500) buscar 10 libres en una
 * grilla de 10.000 es tedioso; con esto queda a un toque.
 */
export function EleccionRapida({
  minimo,
  libres,
  onElegir,
  tono,
}: {
  /** Números que lleva la compra como mínimo (1 = sin mínimo). */
  minimo: number;
  /** Números libres de la rifa. */
  libres: number[];
  /** Reemplaza la selección por estos números (vacío = limpiar). */
  onElegir: (numeros: number[]) => void;
  tono: keyof typeof TONOS;
}) {
  const t = TONOS[tono];
  const [modo, setModo] = useState<ModoEleccion>("manual");
  const [cantidad, setCantidad] = useState(String(minimo));
  const n = Math.max(minimo, Math.trunc(Number(cantidad) || 0));
  // Si quedan menos libres que el mínimo, la compra se lleva los que quedan.
  const pedir = Math.min(n, libres.length);

  function aplicar(m: ModoEleccion) {
    setModo(m);
    if (m === "manual") {
      onElegir([]);
      return;
    }
    if (pedir === 0) {
      toast.error("Ya no quedan números libres");
      return;
    }
    if (m === "azar") {
      onElegir(elegirAlAzar(libres, pedir));
      return;
    }
    const seguidos = elegirSeguidos(libres, pedir);
    if (!seguidos) {
      toast.error(`No quedan ${pedir} números seguidos libres. Prueba al azar o elígelos a mano.`);
      setModo("manual");
      return;
    }
    onElegir(seguidos);
  }

  const boton = (m: ModoEleccion, label: string) => (
    <button
      type="button"
      onClick={() => aplicar(m)}
      aria-pressed={modo === m}
      className={`tap-scale flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
        modo === m ? t.activo : t.normal
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`mb-3 rounded-xl border p-3 ${t.caja}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {minimo > 1 ? `Mínimo ${minimo} números por compra` : "Elige tus números"}
        </p>
        <label className={`flex items-center gap-1.5 text-xs ${t.sub}`}>
          Cuántos
          <input
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setCantidad(String(n))}
            className="h-8 w-14 rounded-md border border-current/20 bg-transparent px-2 text-center text-sm font-semibold tabular-nums"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        {boton("azar", `🎲 ${pedir} al azar`)}
        {boton("seguidos", `🔢 ${pedir} seguidos`)}
        {boton("manual", "✋ A mano")}
      </div>
      <p className={`mt-2 text-xs ${t.sub}`}>
        {modo === "manual"
          ? `Toca ${minimo > 1 ? `al menos ${Math.min(minimo, libres.length)} números` : "los números que quieras"} en la grilla.`
          : "Puedes volver a tocar el botón para que salgan otros, o ajustar a mano en la grilla."}
      </p>
    </div>
  );
}
