import { CalendarX2 } from "lucide-react";

import { getApuestas } from "@/actions/apuestas";
import { getPartidos } from "@/actions/partidos";
import { Hero } from "@/components/hero";
import { PartidoCard } from "@/components/partido-card";
import { SiteHeader } from "@/components/site-header";
import { POLLA } from "@/lib/polla";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [partidosRes, apuestasRes] = await Promise.all([
    getPartidos(),
    getApuestas(),
  ]);

  const partidos = partidosRes.success ? partidosRes.data : [];
  const apuestas = apuestasRes.success ? apuestasRes.data : [];
  // Personas distintas que han apostado y total en juego (apuestas pagadas).
  const participantes = new Set(apuestas.map((a) => a.nombre)).size;
  const totalEnJuego = apuestas.filter((a) => a.pagado).length * POLLA.costo;
  const hayLive = partidos.some((p) => p.estado === "en_juego");

  return (
    <>
      <SiteHeader live={hayLive} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Hero premio={totalEnJuego} participantes={participantes} />

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-heading text-3xl tracking-wide text-white sm:text-4xl">
              Partidos
            </h2>
            {partidos.length > 0 && (
              <span className="text-polla-muted text-sm font-medium">
                {partidos.length} en total
              </span>
            )}
          </div>

          {!partidosRes.success ? (
            <p className="text-polla-red rounded-2xl bg-polla-red/10 px-4 py-3 ring-1 ring-polla-red/30">
              No se pudieron cargar los partidos: {partidosRes.error}
            </p>
          ) : partidos.length === 0 ? (
            <div className="bg-polla-surface ring-polla-line flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center ring-1">
              <CalendarX2 className="text-polla-muted size-10" />
              <p className="text-polla-muted">
                Todavía no hay partidos. El administrador debe sincronizarlos.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partidos.map((p, i) => (
                <PartidoCard key={p.id} partido={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-polla-line/70 border-t">
        <div className="text-polla-muted mx-auto max-w-5xl px-4 py-6 text-center text-xs">
          Polla Mundial 2026 · Pronostica el marcador exacto y llévate el premio.
        </div>
      </footer>
    </>
  );
}
