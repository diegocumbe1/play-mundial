import { Lock } from "lucide-react";

import { getPartidos } from "@/actions/partidos";
import { PronosticoForm } from "@/components/pronostico-form";
import { SiteHeader } from "@/components/site-header";
import { getIdioma } from "@/lib/idioma-server";

export const dynamic = "force-dynamic";

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JugarPage({
  searchParams,
}: {
  searchParams: Promise<{ partido?: string | string[]; equipo?: string | string[] }>;
}) {
  const idioma = await getIdioma();
  const query = await searchParams;
  const partidoInicial = getSearchValue(query.partido) ?? "";
  const equipoInicial = getSearchValue(query.equipo) ?? "";
  const result = await getPartidos();
  const todos = result.success ? result.data : [];
  // Solo se puede pronosticar partidos que aún no han empezado.
  const disponibles = todos.filter((p) => p.estado === "programado");
  const hayLive = todos.some((p) => p.estado === "en_juego");

  return (
    <>
      <SiteHeader live={hayLive} idioma={idioma} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-4xl tracking-wide text-white sm:text-5xl">
            Registra tus pronósticos
          </h1>
          <p className="text-polla-muted mt-2">
            Ingresa el marcador que crees para cada partido.{" "}
            <span className="text-polla-gold font-semibold">1 punto</span> por
            acierto exacto.
          </p>
        </div>

        {disponibles.length === 0 ? (
          <div className="bg-polla-surface ring-polla-line flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center ring-1">
            <Lock className="text-polla-muted size-10" />
            <p className="text-polla-muted">
              No hay partidos disponibles para pronosticar por ahora.
            </p>
          </div>
        ) : (
          <PronosticoForm
            partidos={disponibles}
            idioma={idioma}
            partidoInicialId={partidoInicial}
            busquedaInicial={equipoInicial}
          />
        )}
      </main>
    </>
  );
}
