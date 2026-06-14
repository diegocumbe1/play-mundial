import { getPartidos } from "@/actions/partidos";
import { Hero } from "@/components/hero";
import { MatchList } from "@/components/match-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";

export const dynamic = "force-dynamic";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export default async function Home() {
  const idioma = await getIdioma();
  const partidosRes = await getPartidos();
  const partidos = partidosRes.success ? partidosRes.data : [];
  const hayLive = partidos.some((p) => p.estado === "en_juego");

  // eslint-disable-next-line react-hooks/purity -- hora actual evaluada por request (server)
  const limiteSemana = Date.now() + SEMANA_MS;
  const upcoming = partidos
    .filter((p) => p.estado === "programado" || p.estado === "en_juego")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const estaSemana = upcoming.filter(
    (p) => new Date(p.fecha).getTime() <= limiteSemana,
  );
  const masAdelante = upcoming.filter(
    (p) => new Date(p.fecha).getTime() > limiteSemana,
  );
  const finalizados = partidos
    .filter((p) => p.estado === "finalizado" || p.estado === "cancelado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Hero />

        {!partidosRes.success ? (
          <p className="text-polla-red mt-12 rounded-2xl bg-polla-red/10 px-4 py-3 ring-1 ring-polla-red/30">
            No se pudieron cargar los partidos: {partidosRes.error}
          </p>
        ) : (
          <MatchList
            estaSemana={estaSemana}
            masAdelante={masAdelante}
            finalizados={finalizados}
            idioma={idioma}
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
