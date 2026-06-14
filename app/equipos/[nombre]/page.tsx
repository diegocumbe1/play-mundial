import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPartidos } from "@/actions/partidos";
import { PartidoCard } from "@/components/partido-card";
import { SiteHeader } from "@/components/site-header";
import type { Partido } from "@/types";

export const dynamic = "force-dynamic";

function Stat({ valor, label }: { valor: number | string; label: string }) {
  return (
    <div className="bg-polla-surface ring-polla-line rounded-xl px-3 py-3 text-center ring-1">
      <div className="font-heading text-2xl text-white tabular-nums">{valor}</div>
      <div className="text-polla-muted text-[11px] tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}

export default async function EquipoPage({
  params,
}: {
  params: Promise<{ nombre: string }>;
}) {
  const { nombre: raw } = await params;
  const nombre = decodeURIComponent(raw);

  const res = await getPartidos();
  const partidos = (res.success ? res.data : []).filter(
    (p) => p.equipo_local === nombre || p.equipo_visitante === nombre,
  );

  // Logo del equipo desde cualquier partido.
  const conLogo = partidos.find(
    (p) =>
      (p.equipo_local === nombre && p.equipo_local_logo) ||
      (p.equipo_visitante === nombre && p.equipo_visitante_logo),
  );
  const logo = conLogo
    ? conLogo.equipo_local === nombre
      ? conLogo.equipo_local_logo
      : conLogo.equipo_visitante_logo
    : null;

  // Stats a partir de partidos finalizados.
  let pj = 0,
    g = 0,
    e = 0,
    pp = 0,
    gf = 0,
    gc = 0;
  for (const p of partidos) {
    if (
      p.estado !== "finalizado" ||
      p.goles_local === null ||
      p.goles_visitante === null
    )
      continue;
    const local = p.equipo_local === nombre;
    const propios = local ? p.goles_local : p.goles_visitante;
    const rivales = local ? p.goles_visitante : p.goles_local;
    pj++;
    gf += propios;
    gc += rivales;
    if (propios > rivales) g++;
    else if (propios === rivales) e++;
    else pp++;
  }

  const ordenar = (a: Partido, b: Partido) => a.fecha.localeCompare(b.fecha);
  const proximos = partidos
    .filter((p) => p.estado === "programado" || p.estado === "en_juego")
    .sort(ordenar);
  const jugados = partidos
    .filter((p) => p.estado === "finalizado" || p.estado === "cancelado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="text-polla-muted hover:text-white mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Volver
        </Link>

        <div className="flex items-center gap-4">
          <div className="bg-polla-elevated ring-polla-line flex size-16 items-center justify-center overflow-hidden rounded-full ring-1">
            {logo ? (
              <Image src={logo} alt={nombre} width={48} height={48} className="size-12 object-contain" />
            ) : (
              <span className="text-2xl">⚽</span>
            )}
          </div>
          <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
            {nombre}
          </h1>
        </div>

        {partidos.length === 0 ? (
          <p className="text-polla-muted mt-8">
            No hay partidos registrados para este equipo.
          </p>
        ) : (
          <>
            {pj > 0 && (
              <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Stat valor={pj} label="Jugados" />
                <Stat valor={g} label="Ganados" />
                <Stat valor={e} label="Empates" />
                <Stat valor={pp} label="Perdidos" />
                <Stat valor={gf} label="GF" />
                <Stat valor={gc} label="GC" />
              </div>
            )}

            {proximos.length > 0 && (
              <section className="mt-10">
                <h2 className="font-heading mb-4 text-2xl tracking-wide text-white">
                  Próximos partidos
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {proximos.map((p, i) => (
                    <PartidoCard key={p.id} partido={p} index={i} />
                  ))}
                </div>
              </section>
            )}

            {jugados.length > 0 && (
              <section className="mt-10">
                <h2 className="font-heading mb-4 text-2xl tracking-wide text-white">
                  Historial
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {jugados.map((p, i) => (
                    <PartidoCard key={p.id} partido={p} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
