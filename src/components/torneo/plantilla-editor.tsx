"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { erroresPlantilla, type JugadorInput, type LimitesPlantilla } from "@/lib/torneo-jugadores";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import { cn } from "@/lib/utils";

export function jugadorVacio(): JugadorInput {
  return {
    nombre: "",
    documento: "",
    genero: "masculino",
    es_externo: false,
    es_referente: false,
    referencia_cliente: "",
  };
}

/**
 * Plantilla del equipo: nombre, documento y género de cada jugador, más las
 * marcas que exige el reglamento (externo, referente, cómo demuestra que es
 * cliente). Muestra en vivo lo que incumple; el servidor vuelve a validar.
 * La usan la inscripción pública y el panel del organizador.
 */
export function PlantillaEditor({
  jugadores,
  onChange,
  reglas,
  limites,
}: {
  jugadores: JugadorInput[];
  onChange: (jugadores: JugadorInput[]) => void;
  reglas: ReglasTorneo["participacion"];
  limites: LimitesPlantilla;
}) {
  const set = (i: number, patch: Partial<JugadorInput>) =>
    onChange(jugadores.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));

  const completos = jugadores.filter((j) => j.nombre.trim() && j.documento.trim());
  const errores = erroresPlantilla(
    completos.map((j) => ({
      ...j,
      es_externo: j.es_externo ?? false,
      es_referente: j.es_referente ?? false,
    })),
    reglas,
    limites,
  );
  const usaReferentes = reglas.max_referentes != null;
  const puedeAgregar = !limites.maximo || jugadores.length < limites.maximo;

  const requisitos = [
    limites.minimo && limites.maximo
      ? `De ${limites.minimo} a ${limites.maximo} jugadores`
      : limites.minimo
        ? `Mínimo ${limites.minimo} jugadores`
        : null,
    reglas.min_mujeres_cancha > 0 ? `mínimo ${reglas.min_mujeres_cancha} mujer(es)` : null,
    reglas.solo_clientes && reglas.max_externos != null
      ? `máximo ${reglas.max_externos} externo(s)`
      : null,
    usaReferentes ? `máximo ${reglas.max_referentes} referente(s)` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {requisitos.length > 0 && (
        <p className="text-muted-foreground text-xs">{requisitos.join(" · ")}.</p>
      )}

      {jugadores.map((j, i) => (
        <div key={i} className="bg-muted/30 flex flex-col gap-2 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-5 shrink-0 text-xs font-semibold">{i + 1}</span>
            <Input
              value={j.nombre}
              onChange={(e) => set(i, { nombre: e.target.value })}
              placeholder="Nombre completo"
              aria-label={`Nombre del jugador ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(jugadores.filter((_, idx) => idx !== i))}
              aria-label={`Quitar jugador ${i + 1}`}
              className="text-muted-foreground hover:text-destructive inline-flex size-8 shrink-0 items-center justify-center rounded-md"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-7">
            <Input
              value={j.documento}
              onChange={(e) => set(i, { documento: e.target.value })}
              placeholder="Documento"
              inputMode="numeric"
              aria-label={`Documento del jugador ${i + 1}`}
              className="w-36"
            />
            <div className="border-border inline-flex rounded-lg border p-0.5">
              {(["femenino", "masculino"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set(i, { genero: g })}
                  aria-pressed={j.genero === g}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    j.genero === g ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {g === "femenino" ? "Mujer" : "Hombre"}
                </button>
              ))}
            </div>
            {reglas.solo_clientes && (
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={j.es_externo ?? false}
                  onChange={(e) => set(i, { es_externo: e.target.checked })}
                  className="size-3.5"
                />
                Externo
              </label>
            )}
            {usaReferentes && (
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={j.es_referente ?? false}
                  onChange={(e) => set(i, { es_referente: e.target.checked })}
                  className="size-3.5"
                />
                Referente
              </label>
            )}
          </div>
          {reglas.solo_clientes && !j.es_externo && (
            <div className="pl-7">
              <Input
                value={j.referencia_cliente ?? ""}
                onChange={(e) => set(i, { referencia_cliente: e.target.value })}
                placeholder={
                  reglas.como_verificar_cliente
                    ? `Cliente: ${reglas.como_verificar_cliente}`
                    : "¿Cómo demuestra que es cliente?"
                }
                aria-label={`Referencia de cliente del jugador ${i + 1}`}
              />
            </div>
          )}
        </div>
      ))}

      {puedeAgregar && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...jugadores, jugadorVacio()])}
        >
          <Plus className="size-3.5" /> Agregar jugador
        </Button>
      )}

      {errores.length > 0 && completos.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-amber-600 dark:text-amber-400">
          {errores.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
