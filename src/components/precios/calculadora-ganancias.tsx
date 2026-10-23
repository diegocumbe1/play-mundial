"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { InputMoneda } from "@/components/rifa/input-moneda";
import { Input } from "@/components/ui/input";
import { proyectarRifa, type ConfigCobroRifa } from "@/lib/cobro-rifa";
import { formatCOP } from "@/lib/rifa";

const MAX_PRECIOS = 6;
/** Escenarios de venta que se muestran como columnas (lo que de verdad se vende). */
const ESCENARIOS = [100, 80, 60, 50];

/**
 * Calculadora de ganancias: compara varios precios por número para la misma
 * rifa (p. ej. 10.000 números a $1.500 o $1.800) contra el costo del premio y
 * lo que de verdad se venda. Usa la misma regla de cobro que el servidor.
 */
export function CalculadoraGanancias({
  config,
  cantidadInicial = 100,
  preciosIniciales = [10000],
  costoPremioInicial = 0,
  onUsar,
}: {
  config: ConfigCobroRifa;
  cantidadInicial?: number;
  preciosIniciales?: number[];
  costoPremioInicial?: number;
  /** Si viene, cada columna ofrece "Usar este precio" (formulario de la rifa). */
  onUsar?: (cantidad: number, precio: number) => void;
}) {
  const [cantidad, setCantidad] = useState(String(cantidadInicial));
  const [precios, setPrecios] = useState(preciosIniciales.map(String));
  const [costoPremio, setCostoPremio] = useState(costoPremioInicial ? String(costoPremioInicial) : "");

  const n = Math.min(10000, Math.max(0, Math.trunc(Number(cantidad) || 0)));
  const filas = precios.map((p) => {
    const base = { cantidad: n, precio: Number(p) || 0, costoPremio: Number(costoPremio) || 0 };
    return {
      ...proyectarRifa(config, { ...base, pctVendido: 100 }),
      ganancias: ESCENARIOS.map((pct) => proyectarRifa(config, { ...base, pctVendido: pct }).ganancia),
    };
  });

  /** Llena los precios con un rango de 6 escalones desde el primero (p. ej. 1.500 → 2.000). */
  function llenarRango() {
    const desde = Number(precios[0]) || 1500;
    const paso = desde >= 10000 ? 1000 : 100;
    setPrecios(Array.from({ length: MAX_PRECIOS }, (_, i) => String(desde + i * paso)));
  }

  function setPrecio(i: number, v: string) {
    setPrecios((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }

  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid gap-3 @md:grid-cols-2">
        <div>
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Cantidad de números</label>
          <Input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[100, 1000, 5000, 10000].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCantidad(String(c))}
                className={`rounded-md border px-2 py-0.5 text-xs tabular-nums ${
                  n === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {c.toLocaleString("es-CO")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Lo que te cuesta el premio (con papeles)
          </label>
          <InputMoneda value={costoPremio} onChange={setCostoPremio} placeholder="6.200.000" />
          <p className="text-muted-foreground mt-1 text-xs">
            Ej.: moto + matrícula + SOAT. Déjalo en 0 si solo quieres ver el recaudo.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-muted-foreground text-xs font-medium">Precios por número a comparar</label>
          <span className="flex gap-3">
            <button
              type="button"
              onClick={llenarRango}
              className="text-primary text-xs font-medium"
            >
              Rango de 6 precios
            </button>
            {precios.length < MAX_PRECIOS && (
              <button
                type="button"
                onClick={() => setPrecios((p) => [...p, ""])}
                className="text-primary inline-flex items-center gap-1 text-xs font-medium"
              >
                <Plus className="size-3.5" /> Otro precio
              </button>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @3xl:grid-cols-6">
          {precios.map((p, i) => (
            <div key={i} className="relative">
              <InputMoneda value={p} onChange={(v) => setPrecio(i, v)} placeholder="1.500" />
              {precios.length > 1 && (
                <button
                  type="button"
                  aria-label="Quitar precio"
                  onClick={() => setPrecios((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Una tarjeta por precio: en el celular se lee de arriba abajo y en PC
          se reparten en columnas, sin tabla ancha con scroll lateral. */}
      <div className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3">
        {filas.map((f, i) => {
          if (f.precio <= 0) return null;
          const alcanza = f.equilibrio != null && f.equilibrio <= n;
          const pctEquilibrio = alcanza && n > 0 ? (f.equilibrio! / n) * 100 : 100;
          return (
            <div key={i} className="border-border bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold tabular-nums">
                    {formatCOP(f.precio)}
                    <span className="text-muted-foreground text-xs font-normal"> por número</span>
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Si vende todo: <b className="text-foreground">{formatCOP(f.recaudoTotal)}</b>
                    {" · "}Plataforma: {formatCOP(f.costoActivacion)}
                  </p>
                </div>
                {onUsar && (
                  <button
                    type="button"
                    onClick={() => onUsar(n, f.precio)}
                    className="border-border hover:bg-muted shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium"
                  >
                    Usar
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs">
                  <span className="text-muted-foreground">Para no perder vende mínimo </span>
                  {alcanza ? (
                    <b className="tabular-nums">
                      {f.equilibrio!.toLocaleString("es-CO")} números ({pct(pctEquilibrio)})
                    </b>
                  ) : (
                    <b className="text-red-600 dark:text-red-400">no alcanza ni vendiendo todo</b>
                  )}
                </p>
                <div className="bg-muted relative mt-1.5 h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${alcanza ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${pctEquilibrio}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {alcanza ? "Lo que vendas después de esa marca es ganancia." : "Sube el precio o baja el costo del premio."}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1.5 text-xs">Te queda si vende el…</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {f.ganancias.map((g, j) => (
                    <div key={j} className="bg-background rounded-lg px-2.5 py-1.5">
                      <p className="text-muted-foreground text-[11px]">{ESCENARIOS[j]}% vendido</p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          g < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {g < 0 ? `– ${formatCOP(-g)}` : formatCOP(g)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        El uso de la plataforma se calcula sobre la rifa vendida completa y queda congelado al
        activarla. No incluye permisos ni impuestos, que corren por cuenta del organizador.
      </p>
    </div>
  );
}

/** "42,3%" con coma decimal, como se escribe en Colombia. */
function pct(v: number): string {
  return `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}
