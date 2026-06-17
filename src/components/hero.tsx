import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

import { Actualizado } from "@/components/actualizado";
import { buttonVariants } from "@/components/ui/button";
import { formatFechaCorta } from "@/lib/format";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { estadoEfectivo } from "@/lib/partido-vivo";
import { cn } from "@/lib/utils";
import type { Partido } from "@/types";

type HeroProps = {
  /** Próximos partidos (ya en vivo o por jugarse), ordenados por fecha. */
  proximos?: Partido[];
  idioma?: Idioma;
};

function EquipoMini({ nombre, logo }: { nombre: string; logo: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="bg-polla-elevated ring-polla-line/80 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
        {logo ? (
          <Image src={logo} alt={nombre} width={20} height={20} className="size-5 object-contain" />
        ) : (
          <span className="text-xs">⚽</span>
        )}
      </span>
      <span className="truncate text-sm font-bold tracking-wide text-white uppercase">
        {nombre}
      </span>
    </div>
  );
}

function ProximoRow({ partido, idioma }: { partido: Partido; idioma: Idioma }) {
  const enJuego = estadoEfectivo(partido) === "en_juego";
  return (
    <Link
      href={`/partidos/${partido.id}`}
      className="hover:ring-polla-gold/40 block rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition-colors"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-widest uppercase",
            enJuego
              ? "bg-polla-red/15 text-polla-red ring-1 ring-polla-red/30"
              : "text-polla-muted bg-white/5 ring-1 ring-white/10",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              enJuego ? "bg-polla-red animate-pulse" : "bg-polla-muted",
            )}
            aria-hidden
          />
          {enJuego ? "En vivo" : "Próximo"}
        </span>
        <span className="text-polla-muted text-[0.7rem]">
          {enJuego ? (
            <Actualizado iso={partido.updated_at} />
          ) : (
            formatFechaCorta(partido.fecha)
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <EquipoMini nombre={traducirEquipo(partido.equipo_local, idioma)} logo={partido.equipo_local_logo} />
        <span className="text-polla-gold font-heading shrink-0 text-sm">VS</span>
        <EquipoMini nombre={traducirEquipo(partido.equipo_visitante, idioma)} logo={partido.equipo_visitante_logo} />
      </div>
    </Link>
  );
}

/** Hero del home: compacto, con el/los próximos partidos a la derecha. */
export function Hero({ proximos = [], idioma = "es" }: HeroProps) {
  const destacados = proximos.slice(0, 2);

  return (
    <section className="bg-hero ring-polla-line relative overflow-hidden rounded-3xl ring-1">
      <div className="bg-stadium absolute inset-0" aria-hidden />
      <div
        className="bg-polla-gold/10 animate-float absolute -top-16 -right-10 size-40 rounded-full blur-3xl"
        aria-hidden
      />

      <div className="relative grid gap-6 px-6 py-7 sm:px-10 sm:py-9 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <span className="text-polla-gold/90 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest uppercase ring-1 ring-white/10">
            <Trophy className="size-3.5" /> FIFA World Cup 2026
          </span>

          <h1 className="font-heading mt-4 max-w-2xl text-3xl leading-[0.95] tracking-wide text-white sm:text-5xl">
            Tu Mundial. <span className="text-polla-gold">Tus pronósticos.</span>{" "}
            <span className="text-polla-red">Tus premios.</span>
          </h1>

          <p className="text-polla-muted mt-3 max-w-xl text-sm sm:text-base">
            Consulta partidos y resultados gratis. Participa desde $5.000 y
            compite acertando el marcador exacto.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/jugar"
              className={cn(
                buttonVariants({ size: "lg" }),
                "shimmer bg-polla-gold text-polla-dark hover:bg-polla-gold/90 h-11 gap-2 rounded-xl px-6 text-base font-bold shadow-[0_8px_30px_-8px_rgba(245,197,24,0.6)]",
              )}
            >
              Participar desde $5.000
              <ArrowRight className="size-5" />
            </Link>
            <span className="text-polla-muted text-sm">
              Cada partido tiene su propia polla.
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 shadow-2xl backdrop-blur-md">
          <span className="text-polla-gold/90 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest uppercase ring-1 ring-white/10">
            Próximos partidos
          </span>

          {destacados.length > 0 ? (
            <div className="mt-3 space-y-2">
              {destacados.map((p) => (
                <ProximoRow key={p.id} partido={p} idioma={idioma} />
              ))}
            </div>
          ) : (
            <p className="text-polla-muted mt-3 text-sm">
              Calendario por confirmar. Cuando haya un próximo partido aparecerá
              aquí automáticamente.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
