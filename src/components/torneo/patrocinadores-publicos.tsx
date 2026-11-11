"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PatrocinadorPublico } from "@/types";

/**
 * Patrocinadores en la página pública del torneo, al estilo de las ligas:
 * - Franja «Organiza · Gestores y patrocinadores» con todos los logos.
 * - Banner que rota fijo abajo (celular y pantallas medianas).
 * - Banners laterales en pantallas anchas.
 * Solo llegan los publicados con imagen; sin ninguno no se pinta nada.
 */

const ROTACION_MS = 5000;

const TITULOS: Record<PatrocinadorPublico["rol"], string> = {
  organiza: "Organiza",
  gestor: "Gestores",
  patrocinador: "Patrocinadores",
};

/** Índice que avanza solo cada `ms` (pausado si hay uno o ninguno). */
function useRotacion(total: number, ms = ROTACION_MS, desfase = 0): number {
  const [i, setI] = useState(desfase);
  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % total), ms);
    return () => clearInterval(t);
  }, [total, ms]);
  return total > 0 ? i % total : 0;
}

function Logo({ p, className }: { p: PatrocinadorPublico; className?: string }) {
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={p.logo_url!} alt={p.nombre} loading="lazy" className={cn("object-contain", className)} />
  );
  return p.enlace ? (
    <a href={p.enlace} target="_blank" rel="noopener noreferrer sponsored" title={p.nombre} className="contents">
      {img}
    </a>
  ) : (
    img
  );
}

/** Franja con todos los logos, agrupados por rol. */
export function FranjaPatrocinadores({ patrocinadores }: { patrocinadores: PatrocinadorPublico[] }) {
  if (patrocinadores.length === 0) return null;
  const grupos = (["organiza", "gestor", "patrocinador"] as const)
    .map((rol) => ({ rol, lista: patrocinadores.filter((p) => p.rol === rol) }))
    .filter((g) => g.lista.length > 0);
  // «Gestores y patrocinadores» van juntos, como en los afiches.
  const gestores = grupos.find((g) => g.rol === "gestor");
  const patro = grupos.find((g) => g.rol === "patrocinador");
  const bloques = [
    grupos.find((g) => g.rol === "organiza") && { titulo: TITULOS.organiza, lista: grupos.find((g) => g.rol === "organiza")!.lista },
    (gestores || patro) && {
      titulo: gestores && patro ? "Gestores y patrocinadores" : gestores ? TITULOS.gestor : TITULOS.patrocinador,
      lista: [...(gestores?.lista ?? []), ...(patro?.lista ?? [])],
    },
  ].filter(Boolean) as { titulo: string; lista: PatrocinadorPublico[] }[];

  return (
    <section className="border-border mb-6 rounded-2xl border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {bloques.map((b) => (
          <div key={b.titulo} className={cn("min-w-0", b.titulo !== TITULOS.organiza && "flex-1")}>
            <p className="text-muted-foreground mb-2 text-center text-[11px] font-semibold uppercase tracking-wide sm:text-left">
              {b.titulo}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {b.lista.map((p) => (
                <div key={p.id} className="flex h-16 w-32 items-center justify-center rounded-xl bg-white/95 p-2">
                  <Logo p={p} className="max-h-full max-w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Banner fijo abajo que rota entre patrocinadores (se puede cerrar en esta
 * visita). En pantallas anchas se reemplaza por los laterales.
 */
export function BannerPatrocinadores({ patrocinadores }: { patrocinadores: PatrocinadorPublico[] }) {
  const [cerrado, setCerrado] = useState(false);
  const i = useRotacion(patrocinadores.length);
  if (patrocinadores.length === 0 || cerrado) return null;
  const p = patrocinadores[i];
  return (
    <>
      {/* Abajo: celular, tablet y computador mediano. */}
      <div className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur 2xl:hidden">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-3">
          <span className="text-muted-foreground shrink-0 text-[10px] font-semibold uppercase tracking-wide">
            {TITULOS[p.rol] === "Organiza" ? "Organiza" : "Patrocina"}
          </span>
          <div key={p.id} className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg bg-white/95 px-2 duration-500 animate-in fade-in">
            <Logo p={p} className="max-h-full max-w-full" />
          </div>
          {patrocinadores.length > 1 && (
            <div className="flex shrink-0 gap-1" aria-hidden>
              {patrocinadores.map((x, k) => (
                <span key={x.id} className={cn("size-1.5 rounded-full", k === i ? "bg-primary" : "bg-muted-foreground/30")} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCerrado(true)}
            aria-label="Ocultar patrocinadores"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      {/* Laterales: pantallas anchas, a cada lado del contenido. */}
      <Lateral patrocinadores={patrocinadores} lado="izquierda" />
      <Lateral patrocinadores={patrocinadores} lado="derecha" />
    </>
  );
}

function Lateral({ patrocinadores, lado }: { patrocinadores: PatrocinadorPublico[]; lado: "izquierda" | "derecha" }) {
  // La derecha arranca desfasada para no mostrar el mismo logo en los dos lados.
  const i = useRotacion(patrocinadores.length, ROTACION_MS, lado === "derecha" ? Math.ceil(patrocinadores.length / 2) : 0);
  const p = patrocinadores[i];
  return (
    <aside
      className={cn(
        "fixed top-1/2 z-30 hidden w-44 -translate-y-1/2 flex-col items-center gap-2 2xl:flex",
        lado === "izquierda" ? "left-6" : "right-6",
      )}
      aria-label="Patrocinadores"
    >
      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {p.rol === "organiza" ? "Organiza" : "Patrocina"}
      </span>
      <div key={p.id} className="flex h-72 w-full items-center justify-center rounded-2xl bg-white/95 p-3 shadow-lg duration-500 animate-in fade-in">
        <Logo p={p} className="max-h-full max-w-full" />
      </div>
    </aside>
  );
}
