import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Ticket } from "lucide-react";

import { getApuestas } from "@/actions/apuestas";
import { getPartidos } from "@/actions/partidos";
import { Actualizado } from "@/components/actualizado";
import { DesglosePartido } from "@/components/desglose-partido";
import { EstadoBadge } from "@/components/estado-badge";
import { MinutoEnVivo } from "@/components/minuto-en-vivo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatFecha } from "@/lib/format";
import { traducirEquipo, traducirLiga } from "@/lib/idioma";
import { getIdioma } from "@/lib/idioma-server";
import { estadoEfectivo } from "@/lib/partido-vivo";
import { calcularResultadoPartido, formatCOP } from "@/lib/polla";
import { resumenPartido } from "@/lib/resumen-partido";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Equipo({
  nombre,
  logo,
}: {
  nombre: string;
  logo: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 text-center">
      <div className="bg-polla-elevated ring-polla-line flex size-20 items-center justify-center overflow-hidden rounded-full ring-1">
        {logo ? (
          <Image src={logo} alt={nombre} width={56} height={56} className="size-14 object-contain" />
        ) : (
          <span className="text-3xl">⚽</span>
        )}
      </div>
      <span className="font-heading text-lg tracking-wide text-white uppercase">
        {nombre}
      </span>
    </div>
  );
}

export default async function PartidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const idioma = await getIdioma();
  const { id } = await params;

  const [partidosRes, apuestasRes] = await Promise.all([
    getPartidos(),
    getApuestas(),
  ]);

  const partido = (partidosRes.success ? partidosRes.data : []).find(
    (p) => p.id === id,
  );
  if (!partido) notFound();

  const apuestas = (apuestasRes.success ? apuestasRes.data : []).filter(
    (a) => a.partido_id === id,
  );
  const r = calcularResultadoPartido(partido, apuestas);
  // Final REAL (prefiere flashscore): corrige el marcador equivocado que a veces
  // trae el proveedor sumando los penales al resultado.
  const marcadorFinal = resumenPartido(partido).final;
  // Estado derivado de la hora (el del proveedor gratuito es inestable).
  const estado = estadoEfectivo(partido);
  const enJuego = estado === "en_juego";
  const finalizado = estado === "finalizado";
  const puedeApostar = estado === "programado";

  return (
    <>
      <SiteHeader live={enJuego} idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="text-polla-muted hover:text-white mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Volver
        </Link>

        <div className="bg-polla-surface ring-polla-line rounded-3xl p-6 ring-1 sm:p-10">
          <div className="mb-6 flex items-center justify-between gap-2">
            <EstadoBadge estado={estado} enPausa={partido.en_pausa} />
            <span className="text-polla-muted text-sm">
              {traducirLiga(partido.liga, idioma)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Equipo
              nombre={traducirEquipo(partido.equipo_local, idioma)}
              logo={partido.equipo_local_logo}
            />
            <div className="flex shrink-0 flex-col items-center">
              {marcadorFinal ? (
                <span className="font-heading text-5xl text-white tabular-nums sm:text-6xl">
                  {marcadorFinal.local}–{marcadorFinal.visitante}
                </span>
              ) : (
                <span className="font-heading text-polla-gold text-4xl">VS</span>
              )}
            </div>
            <Equipo
              nombre={traducirEquipo(partido.equipo_visitante, idioma)}
              logo={partido.equipo_visitante_logo}
            />
          </div>

          <p className="text-polla-muted mt-6 text-center text-sm">
            {enJuego ? (
              <MinutoEnVivo
                local={partido.equipo_local}
                visitante={partido.equipo_visitante}
                fallback={<Actualizado iso={partido.updated_at} />}
              />
            ) : (
              formatFecha(partido.fecha)
            )}
          </p>

          {puedeApostar && (
            <Link
              href={`/jugar?partido=${encodeURIComponent(partido.id)}`}
              className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition-colors"
            >
              <Ticket className="size-5" />
              Apostar este partido
            </Link>
          )}

          {/* Pozo / premio */}
          {r.apuestasPagadas > 0 && (
            <div className="border-polla-line/60 mt-6 grid grid-cols-3 gap-2 border-t pt-6 text-center">
              <div>
                <div className="font-heading text-polla-gold text-xl">
                  {formatCOP(r.premioPool)}
                </div>
                <div className="text-polla-muted text-xs uppercase">Premio</div>
              </div>
              <div>
                <div className="font-heading text-xl text-white">
                  {r.apuestasPagadas}
                </div>
                <div className="text-polla-muted text-xs uppercase">Apuestas</div>
              </div>
              <div>
                <div className="font-heading text-xl text-white">
                  {finalizado ? r.ganadores.length : "—"}
                </div>
                <div className="text-polla-muted text-xs uppercase">
                  Ganadores
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desglose del resultado: 90' / prórroga / penales + goleadores. */}
        {finalizado && (
          <DesglosePartido
            partido={partido}
            idioma={idioma}
            variante="completo"
            className="mt-6"
          />
        )}

        {/* Fichas por equipo */}
        <h2 className="font-heading mt-10 mb-4 text-2xl tracking-wide text-white">
          Ver equipos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              nombre: partido.equipo_local,
              display: traducirEquipo(partido.equipo_local, idioma),
              logo: partido.equipo_local_logo,
            },
            {
              nombre: partido.equipo_visitante,
              display: traducirEquipo(partido.equipo_visitante, idioma),
              logo: partido.equipo_visitante_logo,
            },
          ].map((e) => (
            <Link
              key={e.nombre}
              href={`/equipos/${encodeURIComponent(e.nombre)}`}
              className={cn(
                "bg-polla-surface ring-polla-line hover:ring-polla-gold/50 flex items-center justify-between gap-3 rounded-2xl p-4 ring-1 transition-colors",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="bg-polla-elevated ring-polla-line flex size-10 items-center justify-center overflow-hidden rounded-full ring-1">
                  {e.logo ? (
                    <Image src={e.logo} alt={e.display} width={28} height={28} className="size-7 object-contain" />
                  ) : (
                    <span>⚽</span>
                  )}
                </span>
                <span className="font-semibold text-white">Ver {e.display}</span>
              </span>
              <ArrowRight className="text-polla-gold size-5" />
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
