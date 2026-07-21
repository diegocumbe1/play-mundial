import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRifaPublica } from "@/actions/rifas";
import { RifaPublicaView } from "@/components/rifa/rifa-publica-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getRifaPublica(slug);
  if (!res.success) return { title: "Rifa" };
  return {
    title: `${res.data.rifa.nombre} · Rifa`,
    description: res.data.rifa.descripcion ?? "Participa en esta rifa.",
    openGraph: { images: [`/r/${slug}/flyer`] },
  };
}

export default async function RifaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getRifaPublica(slug);
  if (!res.success) notFound();

  return <RifaPublicaView slug={slug} initial={res.data} />;
}
