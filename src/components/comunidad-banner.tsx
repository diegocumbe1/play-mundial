"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

import { getMarcadoresComunidad } from "@/actions/apuestas";
import { getClienteId } from "@/lib/cliente-id";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { cn } from "@/lib/utils";
import type { PartidoComunidad } from "@/types";

const ORDEN: Record<string, number> = {
  en_juego: 0,
  finalizado: 1,
  programado: 2,
  cancelado: 3,
};

const INTERVALO_MS = 5000;

function EstadoChip({ estado }: { estado: PartidoComunidad["estado"] }) {
  if (estado === "en_juego") {
    return (
      <span className="bg-polla-red/15 text-polla-red ring-polla-red/30 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase ring-1">
        <span className="bg-polla-red size-1.5 animate-pulse rounded-full" aria-hidden />
        En vivo
      </span>
    );
  }
  return (
    <span className="text-polla-muted inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest uppercase ring-1 ring-white/10">
      {estado === "finalizado" ? "Finalizado" : "Próximo"}
    </span>
  );
}

/** Diapositiva de marcadores de un partido, sobre el fondo del banner. */
function ComunidadSlide({
  partido,
  idioma,
}: {
  partido: PartidoComunidad;
  idioma: Idioma;
}) {
  const top = partido.marcadores.slice(0, 4);
  const maxCantidad = Math.max(1, ...top.map((m) => m.cantidad));

  return (
    <div className="flex flex-col justify-center px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-white/10 bg-black/25 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <EstadoChip estado={partido.estado} />
            <div className="mt-2 truncate text-sm font-bold tracking-wide text-white uppercase sm:text-base">
              {traducirEquipo(partido.equipo_local, idioma)}
              <span className="text-polla-muted mx-1.5 font-normal">vs</span>
              {traducirEquipo(partido.equipo_visitante, idioma)}
            </div>
          </div>
          {partido.marcadorOficial && (
            <div className="shrink-0 text-right">
              <span className="font-heading text-polla-gold text-3xl leading-none tabular-nums">
                {partido.marcadorOficial.goles_local}–
                {partido.marcadorOficial.goles_visitante}
              </span>
              <div className="text-polla-muted text-[0.6rem] font-semibold tracking-widest uppercase">
                {partido.esReglamentario ? "Reglamentario" : "Ahora"}
              </div>
            </div>
          )}
        </div>

        <ul className="mt-4 grid gap-2">
          {top.map((m) => {
            const pct = Math.round((m.cantidad / maxCantidad) * 100);
            return (
              <li
                key={`${m.goles_local}-${m.goles_visitante}`}
                className={cn(
                  "relative overflow-hidden rounded-xl px-3 py-2 ring-1",
                  m.esMarcadorActual
                    ? "bg-polla-gold/10 ring-polla-gold/40"
                    : m.esPropio
                      ? "bg-polla-deep/30 ring-polla-gold/25"
                      : "bg-white/5 ring-white/10",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-xl",
                    m.esMarcadorActual ? "bg-polla-gold/15" : "bg-white/5",
                  )}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="font-heading inline-flex items-center gap-1.5 text-white tabular-nums">
                    {m.esMarcadorActual && (
                      <CheckCircle2 className="text-polla-gold size-3.5" />
                    )}
                    {m.goles_local}-{m.goles_visitante}
                    {m.esPropio && (
                      <span className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 rounded-full px-2 py-0.5 text-[0.6rem] font-bold ring-1">
                        Tu marcador
                      </span>
                    )}
                  </span>
                  <span className="text-polla-muted shrink-0 text-xs font-semibold tabular-nums">
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
 * Banner tipo carrusel con los marcadores de la comunidad, pensado para la
 * parte superior de /resultados. Marco/fondo fijo y contenido que corre entre
 * partidos. Se navega con flechas (desktop), swipe (móvil) y puntos; el botón
 * "Ver todos" lleva a la vista completa /comunidad. Si no hay datos, no
 * renderiza nada.
 */
export function ComunidadBanner({
  idioma = "es",
  className,
}: {
  idioma?: Idioma;
  className?: string;
}) {
  const [partidos, setPartidos] = useState<PartidoComunidad[]>([]);
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let activo = true;
    getMarcadoresComunidad(getClienteId()).then((res) => {
      if (!activo || !res.success) return;
      const data = res.data
        .filter((p) => p.marcadores.length > 0)
        .sort(
          (a, b) =>
            (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) ||
            b.totalPersonas - a.totalPersonas,
        );
      setPartidos(data);
    });
    return () => {
      activo = false;
    };
  }, []);

  const total = partidos.length;

  useEffect(() => {
    if (pausado || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), INTERVALO_MS);
    return () => clearInterval(t);
  }, [pausado, total]);

  if (total === 0) return null;

  const seguro = Math.min(idx, total - 1);

  function ir(delta: number) {
    setIdx((i) => (i + delta + total) % total);
  }

  return (
    <section
      className={cn(
        "bg-hero ring-polla-line relative overflow-hidden rounded-3xl ring-1",
        className,
      )}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={(e) => {
        setPausado(true);
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        setPausado(false);
        if (touchX.current === null || total <= 1) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      aria-roledescription="carrusel"
    >
      <div className="bg-stadium absolute inset-0" aria-hidden />

      {/* Cabecera con acción "Ver todos" */}
      <div className="relative flex items-center justify-between gap-3 px-5 pt-4 sm:px-8">
        <span className="text-polla-gold/90 inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
          <Users className="size-3.5" /> Marcadores de la comunidad
        </span>
        <Link
          href="/comunidad"
          className="border-polla-gold/50 text-polla-gold hover:bg-polla-gold/10 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition-colors"
        >
          Ver todos <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${seguro * 100}%)` }}
        >
          {partidos.map((p) => (
            <div key={p.partido_id} className="w-full shrink-0">
              <ComunidadSlide partido={p} idioma={idioma} />
            </div>
          ))}
        </div>

        {/* Flechas (desktop / click) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              aria-label="Anterior"
              className="text-polla-gold absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/60"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Siguiente"
              className="text-polla-gold absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/60"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="relative flex items-center justify-center gap-1.5 pb-4">
          {partidos.map((p, i) => (
            <button
              key={p.partido_id}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir al partido ${i + 1}`}
              aria-current={i === seguro ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === seguro ? "bg-polla-gold w-5" : "bg-white/25 w-1.5",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
