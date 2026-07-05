import type { Metadata } from "next";

import { getMarcadoresComunidad } from "@/actions/apuestas";
import { PublicCommunityScores } from "@/components/public-community-scores";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marcadores de la comunidad · Polla Mundial 2026",
  description:
    "Así se están moviendo los pronósticos del Mundial: los marcadores más elegidos por la comunidad.",
};

export default async function ComunidadPage() {
  const idioma = await getIdioma();
  const res = await getMarcadoresComunidad();
  const partidos = res.success ? res.data : [];
  const hayLive = partidos.some((p) => p.estado === "en_juego");

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <PublicCommunityScores partidos={partidos} idioma={idioma} />
      </main>
      <SiteFooter />
    </>
  );
}
