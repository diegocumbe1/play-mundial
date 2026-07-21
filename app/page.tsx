import { getPartidos } from "@/actions/partidos";
import { Hero } from "@/components/hero";
import { MatchList } from "@/components/match-list";
import { RifasLanding } from "@/components/rifas-landing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";
import { estadoEfectivo } from "@/lib/partido-vivo";

export const dynamic = "force-dynamic";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export default async function Home() {
  // El Mundial ya terminó: con POLLA_ACTIVA != "true" la portada es la de rifas.
  if (process.env.POLLA_ACTIVA !== "true") {
    return <RifasLanding />;
  }

  const idioma = await getIdioma();
  const partidosRes = await getPartidos();
  const partidos = partidosRes.success ? partidosRes.data : [];

  // El estado del proveedor gratuito es inestable; derivamos "en vivo" de la
  // hora (ver lib/partido-vivo). Evaluado por request gracias a force-dynamic.
  // eslint-disable-next-line react-hooks/purity -- hora actual evaluada por request (server)
  const ahora = Date.now();
  const estadoDe = (p: (typeof partidos)[number]) => estadoEfectivo(p, ahora);
  const hayLive = partidos.some((p) => estadoDe(p) === "en_juego");

  const limiteSemana = ahora + SEMANA_MS;
  const upcoming = partidos
    .filter((p) => estadoDe(p) === "programado" || estadoDe(p) === "en_juego")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const estaSemana = upcoming.filter(
    (p) => new Date(p.fecha).getTime() <= limiteSemana,
  );
  const masAdelante = upcoming.filter(
    (p) => new Date(p.fecha).getTime() > limiteSemana,
  );
  const finalizados = partidos
    .filter((p) => estadoDe(p) === "finalizado" || estadoDe(p) === "cancelado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Hero proximos={upcoming} idioma={idioma} />

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
