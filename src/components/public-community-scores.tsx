"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Radio, Search, Users, X } from "lucide-react";

import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { cn } from "@/lib/utils";
import type { PartidoComunidad } from "@/types";

/** Orden de aparición: primero lo que genera más "movimiento" en pantalla. */
const ORDEN: Record<string, number> = {
  en_juego: 0,
  finalizado: 1,
  programado: 2,
  cancelado: 3,
};

const CTA_URL = "play-mundial.uselynko.com";

function EstadoChip({ estado }: { estado: PartidoComunidad["estado"] }) {
  if (estado === "en_juego") {
    return (
      <span className="bg-polla-red/15 text-polla-red ring-polla-red/30 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase ring-1">
        <span className="bg-polla-red size-1.5 animate-pulse rounded-full" aria-hidden />
        En vivo
      </span>
    );
  }
  if (estado === "finalizado") {
    return (
      <span className="text-polla-muted inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase ring-1 ring-white/10">
        Finalizado
      </span>
    );
  }
  return (
    <span className="text-polla-muted inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase ring-1 ring-white/10">
      Próximo
    </span>
  );
}

function Escudo({ nombre, logo }: { nombre: string; logo: string | null }) {
  return (
    <span className="bg-polla-elevated ring-polla-line/80 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
      {logo ? (
        <Image src={logo} alt={nombre} width={24} height={24} className="size-6 object-contain" />
      ) : (
        <span className="text-base">⚽</span>
      )}
    </span>
  );
}

function CommunityCard({
  partido,
  idioma,
}: {
  partido: PartidoComunidad;
  idioma: Idioma;
}) {
  const maxCantidad = Math.max(1, ...partido.marcadores.map((m) => m.cantidad));

  return (
    <div className="bg-polla-surface ring-polla-line rounded-2xl p-4 ring-1 sm:p-5">
      {/* Cabecera: estado + equipos + resultado oficial */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <EstadoChip estado={partido.estado} />
          <div className="mt-3 flex items-center gap-2">
            <Escudo nombre={partido.equipo_local} logo={partido.equipo_local_logo} />
            <span className="truncate text-sm font-bold tracking-wide text-white uppercase sm:text-base">
              {traducirEquipo(partido.equipo_local, idioma)}
            </span>
            <span className="text-polla-muted font-heading shrink-0 px-1 text-xs">vs</span>
            <span className="truncate text-sm font-bold tracking-wide text-white uppercase sm:text-base">
              {traducirEquipo(partido.equipo_visitante, idioma)}
            </span>
            <Escudo nombre={partido.equipo_visitante} logo={partido.equipo_visitante_logo} />
          </div>
        </div>

        {partido.marcadorOficial && (
          <div className="shrink-0 text-right">
            <div className="font-heading text-polla-gold text-3xl leading-none tabular-nums sm:text-4xl">
              {partido.marcadorOficial.goles_local}
              <span className="text-polla-muted mx-1">–</span>
              {partido.marcadorOficial.goles_visitante}
            </div>
            <div className="text-polla-muted mt-1 text-[0.65rem] font-semibold tracking-widest uppercase">
              {partido.esReglamentario ? "Reglamentario" : "Ahora"}
            </div>
          </div>
        )}
      </div>

      {/* Final oficial (prórroga/penales): informativo, no cuenta para la polla. */}
      {partido.finalOficial && (
        <p className="text-polla-muted border-polla-line/50 mt-3 border-t pt-3 text-xs">
          Final oficial{" "}
          <span className="font-semibold text-white/80 tabular-nums">
            {partido.finalOficial.goles_local}-
            {partido.finalOficial.goles_visitante}
          </span>
          {partido.finalOficial.penales && (
            <>
              {" "}
              · Penales{" "}
              <span className="font-semibold text-white/80 tabular-nums">
                {partido.finalOficial.penales.local}-
                {partido.finalOficial.penales.visitante}
              </span>
            </>
          )}{" "}
          · no cuenta para la polla
        </p>
      )}

      {/* Lista de marcadores de la comunidad */}
      <div className="border-polla-line/50 mt-4 border-t pt-4">
        <div className="text-polla-muted mb-3 flex items-center justify-between text-[0.7rem] font-semibold tracking-widest uppercase">
          <span>Marcadores de la comunidad</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {partido.totalPersonas}
          </span>
        </div>

        <ul className="grid gap-2">
          {partido.marcadores.map((m) => {
            const pct = Math.round((m.cantidad / maxCantidad) * 100);
            return (
              <li
                key={`${m.goles_local}-${m.goles_visitante}`}
                className={cn(
                  "relative overflow-hidden rounded-xl px-3 py-2.5 ring-1",
                  m.esMarcadorActual
                    ? "bg-polla-gold/10 ring-polla-gold/40"
                    : m.esPropio
                      ? "bg-polla-deep/25 ring-polla-gold/25"
                      : "bg-polla-dark/40 ring-polla-line/50",
                )}
              >
                {/* Barra de popularidad (decorativa) */}
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-xl",
                    m.esMarcadorActual ? "bg-polla-gold/15" : "bg-white/5",
                  )}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg leading-none text-white tabular-nums">
                      {m.goles_local}-{m.goles_visitante}
                    </span>
                    {m.esMarcadorActual && (
                      <span className="text-polla-gold inline-flex items-center gap-1 text-[0.65rem] font-bold">
                        <CheckCircle2 className="size-3.5" />
                        {partido.esReglamentario ? "Resultado" : "Por ahora"}
                      </span>
                    )}
                    {m.esPropio && (
                      <span className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 rounded-full px-2 py-0.5 text-[0.6rem] font-bold ring-1">
                        Tu marcador
                      </span>
                    )}
                  </div>
                  <span className="text-polla-muted shrink-0 text-sm font-semibold tabular-nums">
                    {m.cantidad} {m.cantidad === 1 ? "persona" : "personas"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Vista pública "Marcadores de la comunidad": pensada para compartir en redes
 * y grabar video. No muestra dinero, premios, pagos, usuarios ni datos
 * personales — solo cuántas personas eligieron cada marcador.
 *
 * Los datos vienen siempre de la base de datos vía `getMarcadoresComunidad`.
 */
export function PublicCommunityScores({
  partidos,
  idioma = "es",
}: {
  partidos: PartidoComunidad[];
  idioma?: Idioma;
}) {
  const [query, setQuery] = useState("");

  const ordenados = useMemo(
    () =>
      partidos
        .filter((p) => p.marcadores.length > 0)
        .slice()
        .sort(
          (a, b) =>
            (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) ||
            b.totalPersonas - a.totalPersonas,
        ),
    [partidos],
  );

  const q = query.trim().toLowerCase();
  const data = useMemo(() => {
    if (!q) return ordenados;
    return ordenados.filter((p) =>
      [
        p.equipo_local,
        p.equipo_visitante,
        traducirEquipo(p.equipo_local, idioma),
        traducirEquipo(p.equipo_visitante, idioma),
      ].some((nombre) => nombre.toLowerCase().includes(q)),
    );
  }, [ordenados, q, idioma]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Encabezado */}
      <header className="mb-6 text-center">
        <span className="text-polla-gold/90 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest uppercase ring-1 ring-white/10">
          <Radio className="size-3.5" /> Polla Mundial 2026
        </span>
        <h1 className="font-heading mt-4 text-3xl tracking-wide text-white sm:text-4xl">
          Marcadores de la comunidad
        </h1>
        <p className="text-polla-muted mt-2 text-sm sm:text-base">
          Así se están moviendo los pronósticos del Mundial
        </p>
      </header>

      {/* Filtro por país / equipo */}
      {ordenados.length > 0 && (
        <div className="relative mb-4">
          <Search className="text-polla-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar país o equipo (ej. Colombia)..."
            className="bg-polla-surface ring-polla-line focus:ring-polla-gold/50 w-full rounded-2xl py-3 pr-10 pl-10 text-sm text-white ring-1 outline-none transition placeholder:text-polla-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="text-polla-muted hover:text-white absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {data.length === 0 ? (
        <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-16 text-center ring-1">
          <p className="text-polla-muted">
            {q
              ? `No hay partidos que coincidan con "${query.trim()}".`
              : "Aún no hay marcadores para mostrar. Vuelve cuando empiecen los pronósticos."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((p) => (
            <CommunityCard key={p.partido_id} partido={p} idioma={idioma} />
          ))}
        </div>
      )}

      {/* CTA inferior */}
      <div className="border-polla-gold/40 bg-polla-gold/10 mt-6 rounded-2xl border px-4 py-4 text-center">
        <p className="text-polla-muted text-sm">Haz tu pronóstico en</p>
        <p className="font-heading text-polla-gold mt-0.5 text-lg tracking-wide sm:text-xl">
          {CTA_URL}
        </p>
      </div>
    </div>
  );
}
