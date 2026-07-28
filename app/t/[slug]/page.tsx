import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTorneoPublico } from "@/actions/torneos";
import { TorneoPublicoView } from "@/components/torneo/torneo-publico-view";
import { formatFechaCO } from "@/lib/fecha-co";
import { formatCOP } from "@/lib/torneos";

export const dynamic = "force-dynamic";

// `generateMetadata` y la página piden lo mismo: sin memoizar, el crawler de
// WhatsApp dispara dos veces la misma consulta y la vista previa se demora.
const getTorneo = cache(getTorneoPublico);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getTorneo(slug);
  if (!res.success) return { title: "Torneo" };

  const { torneo, premios, cuposDisponibles } = res.data;
  const fecha = formatFechaCO(torneo.fecha_inicio, { conAnio: false });
  const primerPremio = premios.find((p) => p.puesto === 1);

  // La vista previa se lee antes que nada: aquí va lo que decide inscribirse,
  // y el premio del campeón es lo primero que engancha.
  const partes = [
    `${torneo.deporte}${torneo.modalidad ? ` ${torneo.modalidad}` : ""}`,
    primerPremio ? `Campeón: ${primerPremio.descripcion}` : null,
    [torneo.escenario, torneo.ciudad].filter(Boolean).join(", ") || null,
    fecha ? `Arranca el ${fecha}` : null,
    torneo.valor_inscripcion > 0
      ? `Inscripción ${formatCOP(torneo.valor_inscripcion)} por equipo`
      : "Inscripción gratuita",
    `Quedan ${cuposDisponibles} de ${torneo.cupo_equipos} cupos`,
  ].filter(Boolean);
  const descripcion = `${partes.join(" · ")}.`;

  const title = `${torneo.nombre} · Torneo`;
  return {
    title,
    description: descripcion,
    openGraph: {
      type: "website",
      title,
      description: descripcion,
      url: `/t/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description: descripcion },
  };
}

export default async function TorneoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getTorneo(slug);
  if (!res.success) notFound();

  return <TorneoPublicoView datos={res.data} />;
}
