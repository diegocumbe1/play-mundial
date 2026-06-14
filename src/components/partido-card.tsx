import Image from "next/image";
import Link from "next/link";

import { EstadoBadge } from "@/components/estado-badge";
import { cn } from "@/lib/utils";
import { formatFechaCorta } from "@/lib/format";
import { traducirEquipo, traducirLiga, type Idioma } from "@/lib/idioma";
import type { Partido } from "@/types";

function Equipo({
  nombre,
  logo,
  align = "start",
}: {
  nombre: string;
  logo: string | null;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-2.5 text-center",
        align === "start" ? "sm:items-start sm:text-left" : "sm:items-end sm:text-right",
      )}
    >
      <div className="bg-polla-elevated ring-polla-line/80 flex size-12 items-center justify-center overflow-hidden rounded-full ring-1">
        {logo ? (
          <Image src={logo} alt={nombre} width={40} height={40} className="size-9 object-contain" />
        ) : (
          <span className="text-polla-muted text-lg">⚽</span>
        )}
      </div>
      <span className="text-sm leading-tight font-bold tracking-wide text-white uppercase">
        {nombre}
      </span>
    </div>
  );
}

/** Card de partido — estadio nocturno: banderas grandes, marcador enorme. */
export function PartidoCard({
  partido,
  index = 0,
  idioma = "es",
}: {
  partido: Partido;
  index?: number;
  idioma?: Idioma;
}) {
  const finalizado = partido.estado === "finalizado";
  const enJuego = partido.estado === "en_juego";
  const hayMarcador = partido.goles_local !== null && partido.goles_visitante !== null;
  const local = traducirEquipo(partido.equipo_local, idioma);
  const visitante = traducirEquipo(partido.equipo_visitante, idioma);

  return (
    <Link
      href={`/partidos/${partido.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className={cn(
        "group bg-polla-surface ring-polla-line animate-rise relative flex flex-col rounded-2xl p-5 ring-1 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] hover:ring-polla-gold/60",
        enJuego && "ring-polla-red/40",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <EstadoBadge estado={partido.estado} />
        <span className="text-polla-muted text-xs font-medium">
          {traducirLiga(partido.liga, idioma)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Equipo nombre={local} logo={partido.equipo_local_logo} align="start" />

        <div className="flex shrink-0 flex-col items-center px-1">
          {hayMarcador ? (
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl leading-none text-white tabular-nums sm:text-5xl">
                {partido.goles_local}
              </span>
              <span className="text-polla-muted text-2xl leading-none">–</span>
              <span className="font-heading text-4xl leading-none text-white tabular-nums sm:text-5xl">
                {partido.goles_visitante}
              </span>
            </div>
          ) : (
            <span className="font-heading text-polla-gold text-3xl leading-none sm:text-4xl">
              VS
            </span>
          )}
          {finalizado && (
            <span className="text-polla-muted mt-1 text-[0.65rem] font-semibold tracking-widest uppercase">
              Final
            </span>
          )}
        </div>

        <Equipo nombre={visitante} logo={partido.equipo_visitante_logo} align="end" />
      </div>

      <div className="border-polla-line/70 mt-4 border-t pt-3 text-center">
        <span className="text-polla-muted text-xs font-medium">
          {formatFechaCorta(partido.fecha)}
        </span>
      </div>
    </Link>
  );
}
