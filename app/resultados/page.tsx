import { Trophy } from "lucide-react";

import { getApuestas } from "@/actions/apuestas";
import { getPartidos } from "@/actions/partidos";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { getIdioma } from "@/lib/idioma-server";
import { calcularResultadoPartido, formatCOP } from "@/lib/polla";
import type { Apuesta, Partido } from "@/types";

export const dynamic = "force-dynamic";

const ORDEN: Record<string, number> = {
  en_juego: 0,
  finalizado: 1,
  programado: 2,
  cancelado: 3,
};

function ResultadoCard({
  partido,
  apuestas,
  idioma,
}: {
  partido: Partido;
  apuestas: Apuesta[];
  idioma: Idioma;
}) {
  const r = calcularResultadoPartido(partido, apuestas);
  const finalizado = partido.estado === "finalizado";
  const sinGanador = finalizado && r.ganadores.length === 0;

  return (
    <div className="bg-polla-surface ring-polla-line rounded-2xl p-4 ring-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">
            {traducirEquipo(partido.equipo_local, idioma)}{" "}
            <span className="text-polla-muted font-normal">vs</span>{" "}
            {traducirEquipo(partido.equipo_visitante, idioma)}
          </div>
          {finalizado && (
            <div className="font-heading text-polla-gold mt-1 text-2xl tabular-nums">
              {partido.goles_local} – {partido.goles_visitante}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-polla-muted text-xs tracking-wide uppercase">
            Premio
          </div>
          <div className="font-heading text-polla-gold text-2xl tabular-nums">
            {formatCOP(r.premioPool)}
          </div>
          <div className="text-polla-muted text-xs">
            {r.apuestasPagadas} apuesta(s)
          </div>
        </div>
      </div>

      {finalizado && (
        <div className="border-polla-line/50 mt-3 border-t pt-3">
          {sinGanador ? (
            <p className="text-polla-muted text-sm">
              Nadie acertó el marcador exacto · el pozo{" "}
              <span className="text-polla-gold font-semibold">queda en casa</span>.
            </p>
          ) : (
            <div className="grid gap-1.5">
              <p className="text-polla-muted text-xs tracking-wide uppercase">
                Ganador(es) · {formatCOP(r.premioPorGanador)} c/u
              </p>
              {r.ganadores.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-semibold text-white">
                    <Trophy className="text-polla-gold size-4" />
                    {g.nombre}
                  </span>
                  <span className="text-polla-gold font-bold tabular-nums">
                    {formatCOP(r.premioPorGanador)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ResultadosPage() {
  const idioma = await getIdioma();
  const [partidosRes, apuestasRes] = await Promise.all([
    getPartidos(),
    getApuestas(),
  ]);

  const partidos = partidosRes.success ? partidosRes.data : [];
  const apuestas = apuestasRes.success ? apuestasRes.data : [];
  const hayLive = partidos.some((p) => p.estado === "en_juego");

  const porPartido = new Map<string, Apuesta[]>();
  for (const a of apuestas) {
    const arr = porPartido.get(a.partido_id) ?? [];
    arr.push(a);
    porPartido.set(a.partido_id, arr);
  }

  // Solo partidos que tienen al menos una apuesta.
  const conApuestas = partidos
    .filter((p) => (porPartido.get(p.id)?.length ?? 0) > 0)
    .sort(
      (a, b) =>
        (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) ||
        a.fecha.localeCompare(b.fecha),
    );

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Trophy className="text-polla-gold size-8" />
          <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
            Resultados y premios
          </h1>
        </div>

        {conApuestas.length === 0 ? (
          <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-16 text-center ring-1">
            <p className="text-polla-muted">
              Aún no hay apuestas. ¡Sé el primero en jugar!
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {conApuestas.map((p) => (
              <ResultadoCard
                key={p.id}
                partido={p}
                apuestas={porPartido.get(p.id)!}
                idioma={idioma}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
