"use client";

import { useMemo, useState } from "react";
import { CalendarX2, ChevronDown, Search } from "lucide-react";

import { PartidoCard } from "@/components/partido-card";
import type { Partido } from "@/types";

function coincide(p: Partido, q: string) {
  return `${p.equipo_local} ${p.equipo_visitante} ${p.liga ?? ""}`
    .toLowerCase()
    .includes(q);
}

function esFinalizado(p: Partido) {
  return p.estado === "finalizado" || p.estado === "cancelado";
}

function Grid({ partidos }: { partidos: Partido[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {partidos.map((p, i) => (
        <PartidoCard key={p.id} partido={p} index={i} />
      ))}
    </div>
  );
}

/** Sección colapsable (contraída por defecto). */
function Colapsable({
  titulo,
  count,
  children,
}: {
  titulo: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="bg-polla-surface ring-polla-line hover:ring-polla-gold/40 flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 ring-1 transition-colors [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span className="font-heading text-2xl tracking-wide text-white sm:text-3xl">
            {titulo}
          </span>
          <span className="bg-polla-elevated text-polla-muted rounded-full px-2.5 py-0.5 text-sm font-medium">
            {count}
          </span>
        </span>
        <span className="text-polla-gold flex items-center gap-1.5 text-sm font-semibold">
          <span className="group-open:hidden">Ver</span>
          <span className="hidden group-open:inline">Ocultar</span>
          <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-6">{children}</div>
    </details>
  );
}

export function MatchList({
  estaSemana,
  masAdelante,
  finalizados,
}: {
  estaSemana: Partido[];
  masAdelante: Partido[];
  finalizados: Partido[];
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const { proximosRes, finalizadosRes, totalRes } = useMemo(() => {
    if (!searching) {
      return {
        proximosRes: [] as Partido[],
        finalizadosRes: [] as Partido[],
        totalRes: 0,
      };
    }
    const todos = [...estaSemana, ...masAdelante, ...finalizados].filter((p) =>
      coincide(p, query),
    );
    return {
      proximosRes: todos.filter((p) => !esFinalizado(p)),
      finalizadosRes: todos.filter(esFinalizado),
      totalRes: todos.length,
    };
  }, [searching, query, estaSemana, masAdelante, finalizados]);

  return (
    <div className="mt-12">
      {/* Buscador por país / equipo */}
      <div className="relative mb-6">
        <Search className="text-polla-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar país o equipo (ej. Colombia)…"
          className="bg-polla-surface ring-polla-line placeholder:text-polla-muted/70 focus:ring-polla-gold/40 h-12 w-full rounded-xl pr-4 pl-10 text-white ring-1 outline-none focus:ring-2"
        />
      </div>

      {searching ? (
        totalRes === 0 ? (
          <div className="bg-polla-surface ring-polla-line flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center ring-1">
            <CalendarX2 className="text-polla-muted size-10" />
            <p className="text-polla-muted">Sin partidos para “{q}”.</p>
          </div>
        ) : (
          <div className="grid gap-10">
            {proximosRes.length > 0 && (
              <section>
                <h2 className="font-heading mb-4 text-2xl tracking-wide text-white">
                  Próximos{" "}
                  <span className="text-polla-muted">({proximosRes.length})</span>
                </h2>
                <Grid partidos={proximosRes} />
              </section>
            )}
            {finalizadosRes.length > 0 && (
              <section>
                <h2 className="font-heading mb-4 text-2xl tracking-wide text-white">
                  Finalizados{" "}
                  <span className="text-polla-muted">
                    ({finalizadosRes.length})
                  </span>
                </h2>
                <Grid partidos={finalizadosRes} />
              </section>
            )}
          </div>
        )
      ) : (
        <>
          {/* Finalizados: justo debajo del buscador, contraído por defecto */}
          {finalizados.length > 0 && (
            <Colapsable titulo="Partidos finalizados" count={finalizados.length}>
              <Grid partidos={finalizados} />
            </Colapsable>
          )}

          {/* Próximos partidos */}
          <div className="mt-10 mb-6 flex items-end justify-between gap-4">
            <h2 className="font-heading text-3xl tracking-wide text-white sm:text-4xl">
              Próximos partidos
            </h2>
            <a
              href="/jugar"
              className="text-polla-gold text-sm font-semibold hover:underline"
            >
              Apostar →
            </a>
          </div>

          {estaSemana.length === 0 ? (
            <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-12 text-center ring-1">
              <p className="text-polla-muted">
                No hay partidos esta semana. Mira “Más adelante”.
              </p>
            </div>
          ) : (
            <Grid partidos={estaSemana} />
          )}

          {masAdelante.length > 0 && (
            <div className="mt-10">
              <Colapsable titulo="Más adelante" count={masAdelante.length}>
                <Grid partidos={masAdelante} />
              </Colapsable>
            </div>
          )}
        </>
      )}
    </div>
  );
}
