import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRifaPublica } from "@/actions/rifas";
import { RifaPublicaView } from "@/components/rifa/rifa-publica-view";
import { formatCOP, labelModoCifras } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";

export const dynamic = "force-dynamic";

// `generateMetadata` y la página piden lo mismo: sin memoizar, el crawler de
// WhatsApp esperaba dos veces la misma consulta y la vista previa tardaba.
const getRifa = cache(getRifaPublica);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getRifa(slug);
  if (!res.success) return { title: "Rifa" };

  const { rifa, disponibles } = res.data;
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });

  // La vista previa se lee antes que la imagen: aquí va lo que decide la compra
  // (cómo se gana, cuánto vale, cuánto queda).
  const partes = [
    rifa.tipo === "loteria" && rifa.modo_cifras
      ? `Juega con las ${labelModoCifras(rifa.modo_cifras, rifa.formato_cifras)}${
          rifa.loteria ? ` de la ${rifa.loteria}` : ""
        }`
      : null,
    fechaJuegoTxt ? `Juega el ${fechaJuegoTxt}` : null,
    `${formatCOP(rifa.precio_boleta)} por número`,
    `Quedan ${disponibles} de ${rifa.cantidad_numeros}`,
  ].filter(Boolean);
  const descripcion = `${partes.join(" · ")}.`;

  const title = `${rifa.nombre} · Rifa`;
  return {
    title,
    description: descripcion,
    // La imagen la aporta `opengraph-image.tsx` (URL absoluta vía metadataBase).
    openGraph: {
      type: "website",
      title,
      description: descripcion,
      url: `/r/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description: descripcion },
  };
}

export default async function RifaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getRifa(slug);
  if (!res.success) notFound();

  return <RifaPublicaView slug={slug} initial={res.data} />;
}
