"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Campo } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DIAS_CORTOS,
  resumenRestricciones,
  type RestriccionesEquipo,
} from "@/lib/torneo-restricciones";

/** Lunes primero: así lo piensa el organizador. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

/**
 * Cuándo puede jugar un equipo: días de la semana, rango de hora de inicio y
 * fechas puntuales en que no puede. Todo vacío = puede siempre.
 */
export function RestriccionesEditor({
  value,
  onChange,
}: {
  value: RestriccionesEquipo;
  onChange: (r: RestriccionesEquipo) => void;
}) {
  const [nuevaFecha, setNuevaFecha] = useState("");
  // Sin días marcados = todos: se muestran todos encendidos.
  const activos = value.dias.length === 0 ? ORDEN_DIAS : value.dias;

  function alternarDia(d: number) {
    const set = new Set(activos);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    if (set.size === 0) return; // al menos un día: si no, nunca podría jugar
    onChange({ ...value, dias: set.size === 7 ? [] : [...set].sort() });
  }

  function agregarFecha() {
    if (!nuevaFecha || value.fechas_no.includes(nuevaFecha)) return;
    onChange({ ...value, fechas_no: [...value.fechas_no, nuevaFecha].sort() });
    setNuevaFecha("");
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo label="Días en que puede jugar" ayuda="Toca un día para quitarlo. Todos encendidos = cualquier día.">
        <div className="flex flex-wrap gap-1">
          {ORDEN_DIAS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => alternarDia(d)}
              aria-pressed={activos.includes(d)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                activos.includes(d)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border line-through",
              )}
            >
              {DIAS_CORTOS[d]}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Puede empezar desde" ayuda="Vacío = sin mínimo">
          <Input
            type="time"
            value={value.desde ?? ""}
            onChange={(e) => onChange({ ...value, desde: e.target.value || null })}
          />
        </Campo>
        <Campo label="Puede empezar hasta" ayuda="Vacío = sin máximo">
          <Input
            type="time"
            value={value.hasta ?? ""}
            onChange={(e) => onChange({ ...value, hasta: e.target.value || null })}
          />
        </Campo>
      </div>
      {value.desde && value.hasta && value.desde > value.hasta && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          «Desde» es más tarde que «hasta»: el equipo no podría jugar a ninguna hora.
        </p>
      )}
      <Campo label="Fechas en que no puede" ayuda="Viajes, compromisos o días puntuales.">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
            <Button type="button" size="sm" variant="outline" onClick={agregarFecha} disabled={!nuevaFecha}>
              Agregar
            </Button>
          </div>
          {value.fechas_no.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {value.fechas_no.map((f) => (
                <span key={f} className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                  {f.split("-").reverse().join("/")}
                  <button
                    type="button"
                    aria-label={`Quitar ${f}`}
                    onClick={() => onChange({ ...value, fechas_no: value.fechas_no.filter((x) => x !== f) })}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Campo>
      <Campo label="Nota (opcional)">
        <Input
          value={value.nota}
          onChange={(e) => onChange({ ...value, nota: e.target.value })}
          placeholder="Ej.: trabajan hasta las 7 p. m."
          maxLength={200}
        />
      </Campo>
      <p className="text-muted-foreground text-xs">Resumen: {resumenRestricciones(value)}</p>
    </div>
  );
}
