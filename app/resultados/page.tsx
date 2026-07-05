import { Trophy } from "lucide-react";

import { getPartidos } from "@/actions/partidos";
import { ComunidadBanner } from "@/components/comunidad-banner";
import { ResultadosPersonales } from "@/components/resultados-personales";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";

export const dynamic = "force-dynamic";

export default async function ResultadosPage() {
  const idioma = await getIdioma();
  const partidosRes = await getPartidos();
  const partidos = partidosRes.success ? partidosRes.data : [];
  const hayLive = partidos.some((p) => p.estado === "en_juego");

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Trophy className="text-polla-gold size-8" />
          <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
            Resultados
          </h1>
        </div>

        <ComunidadBanner idioma={idioma} className="mb-6" />

        {!partidosRes.success ? (
          <div className="bg-polla-red/10 ring-polla-red/30 rounded-2xl px-6 py-8 text-center ring-1">
            <p className="text-polla-red">{partidosRes.error}</p>
          </div>
        ) : (
          <ResultadosPersonales partidos={partidos} idioma={idioma} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
