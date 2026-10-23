import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRifaPublica } from "@/actions/rifas";
import { RIFA_PAUSADA } from "@/lib/errores";
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

  const { rifa } = res.data;
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });

  // La vista previa se lee antes que la imagen: aquí va lo que decide la compra
  // (cómo se gana, cuándo juega, cuánto vale).
  const partes = [
    rifa.tipo === "loteria" && rifa.modo_cifras
      ? `Juega con las ${labelModoCifras(rifa.modo_cifras, rifa.formato_cifras)}${
          rifa.loteria ? ` de la ${rifa.loteria}` : ""
        }`
      : null,
    fechaJuegoTxt ? `Juega el ${fechaJuegoTxt}` : null,
    `${formatCOP(rifa.precio_boleta)} por número`,
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
  if (!res.success) {
    if (res.error === RIFA_PAUSADA) return <RifaPausada />;
    notFound();
  }

  return <RifaPublicaView slug={slug} initial={res.data} />;
}

/** El superadmin bloqueó al organizador: la rifa existe, pero queda en pausa. */
function RifaPausada() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border max-w-sm rounded-2xl border p-6 text-center">
        <p className="text-4xl">⏸️</p>
        <h1 className="mt-3 text-lg font-bold">Rifa temporalmente en pausa</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Esta rifa no está recibiendo reservas por ahora. Si ya apartaste o pagaste
          números, siguen a tu nombre: comunícate con el organizador.
        </p>
      </div>
    </main>
  );
}
