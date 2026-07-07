import { cn } from "@/lib/utils";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { resumenPartido } from "@/lib/resumen-partido";
import type { Partido } from "@/types";

const T = {
  es: {
    reglamentario: "Reglamentario",
    soloCuenta:
      "Este marcador se toma solo hasta 90' + reposición; prórroga y penales no cuentan.",
    finalOficial: "Final oficial",
    noAfecta: "Incluye tiempo fuera de la polla y no afecta los premios.",
    minuto90: "90 minutos",
    prorroga: "Prórroga",
    penales: "Penales",
    clasificado: "Clasificado",
    goles: "Goles",
    ec: "e/c",
    pen: "pen",
    sinTanda: "No hubo",
  },
  en: {
    reglamentario: "Regulation",
    soloCuenta:
      "Only regulation time (90' + stoppage) counts; extra time and penalties don't.",
    finalOficial: "Official final",
    noAfecta: "It includes time outside the pool and doesn't affect prizes.",
    minuto90: "90 minutes",
    prorroga: "Extra time",
    penales: "Penalties",
    clasificado: "Advanced",
    goles: "Goals",
    ec: "o.g.",
    pen: "pen",
    sinTanda: "None",
  },
} as const;

function fmt(m: { local: number; visitante: number } | null): string {
  return m ? `${m.local}-${m.visitante}` : "—";
}

/**
 * Desglose del resultado (reglamentario vs prórroga/penales), reusable en
 * todas las superficies. Deja SIEMPRE claro que solo el 90' liquida la polla.
 *
 * - `compacto`: aclaración corta (cards, comunidad, home). Solo aparece si hubo
 *   tiempo extra que explicar.
 * - `completo`: desglose con goleadores (página de detalle del partido).
 */
export function DesglosePartido({
  partido,
  idioma = "es",
  variante = "compacto",
  className,
}: {
  partido: Partido;
  idioma?: Idioma;
  variante?: "compacto" | "completo";
  className?: string;
}) {
  const t = T[idioma];
  const r = resumenPartido(partido);

  // Sin marcador reglamentario aún, no hay nada que desglosar.
  if (!r.reglamentario) return null;

  const local = traducirEquipo(partido.equipo_local, idioma);
  const visitante = traducirEquipo(partido.equipo_visitante, idioma);

  const ganador = r.ganadorPenales
    ? r.ganadorPenales === "local"
      ? local
      : visitante
    : r.final && r.final.local !== r.final.visitante
      ? r.final.local > r.final.visitante
        ? local
        : visitante
      : null;

  // Variante compacta: solo tiene sentido si hubo prórroga/penales.
  if (variante === "compacto") {
    if (!r.hayExtra) return null;
    return (
      <div
        className={cn(
          "bg-polla-elevated/60 ring-polla-line/70 rounded-xl px-4 py-3 ring-1",
          className,
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-polla-gold text-2xl leading-none tabular-nums">
            {fmt(r.reglamentario)}
          </span>
          <span className="text-polla-muted text-[0.65rem] font-semibold tracking-widest uppercase">
            {t.reglamentario}
          </span>
        </div>
        <p className="text-polla-muted mt-2 text-xs leading-relaxed">
          {t.soloCuenta}
        </p>
        <p className="text-polla-muted mt-1 text-xs leading-relaxed">
          <span className="text-white/80 font-semibold">{t.finalOficial}:</span>{" "}
          {fmt(r.final)}
          {r.penales && (
            <>
              {" "}
              · {t.penales} {fmt(r.penales)}
            </>
          )}
          . {t.noAfecta}
        </p>
      </div>
    );
  }

  // Variante completa: desglose por fase + goleadores.
  return (
    <div
      className={cn(
        "bg-polla-surface ring-polla-line rounded-2xl p-5 ring-1",
        className,
      )}
    >
      <dl className="divide-polla-line/60 divide-y">
        <Fila etiqueta={t.minuto90} valor={fmt(r.reglamentario)} destacado />
        <Fila
          etiqueta={t.prorroga}
          valor={r.alargue ? fmt(r.alargue) : t.sinTanda}
        />
        <Fila
          etiqueta={t.penales}
          valor={r.penales ? fmt(r.penales) : t.sinTanda}
        />
        {ganador && <Fila etiqueta={t.clasificado} valor={ganador} />}
      </dl>

      {r.goleadores.length > 0 && (
        <div className="border-polla-line/60 mt-4 border-t pt-4">
          <p className="text-polla-muted mb-2 text-[0.65rem] font-semibold tracking-widest uppercase">
            {t.goles}
          </p>
          <ul className="space-y-1.5">
            {r.goleadores.map((g, i) => (
              <li
                key={`${g.minuto}-${g.jugador}-${i}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-polla-gold w-10 shrink-0 text-right font-semibold tabular-nums">
                  {g.minuto}&apos;
                </span>
                <span className="text-white">{g.jugador}</span>
                {g.en_contra && (
                  <span className="text-polla-muted text-xs">({t.ec})</span>
                )}
                {g.penal && (
                  <span className="text-polla-muted text-xs">({t.pen})</span>
                )}
                <span className="text-polla-muted ml-auto text-xs">
                  {g.team === "home" ? local : visitante}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-polla-muted mt-4 text-xs leading-relaxed">
        {t.soloCuenta}
      </p>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-polla-muted text-sm">{etiqueta}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          destacado ? "text-polla-gold text-lg" : "text-white",
        )}
      >
        {valor}
      </span>
    </div>
  );
}
