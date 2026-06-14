import { redirect } from "next/navigation";
import {
  ChevronDown,
  Coins,
  PiggyBank,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";

import { getApuestas } from "@/actions/apuestas";
import { getPartidos } from "@/actions/partidos";
import { DeleteAllApuestasButton } from "@/components/admin/delete-all-apuestas-button";
import { DeleteApuestaButton } from "@/components/admin/delete-apuesta-button";
import { LogoutButton } from "@/components/admin/logout-button";
import { PagoToggle } from "@/components/admin/pago-toggle";
import { PremioPagoToggle } from "@/components/admin/premio-pago-toggle";
import { ResultadoForm } from "@/components/admin/resultado-form";
import { SyncButton } from "@/components/admin/sync-button";
import { EstadoBadge } from "@/components/estado-badge";
import { getUser } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { calcularResultadoPartido, formatCOP, POLLA } from "@/lib/polla";
import type { Apuesta } from "@/types";

export const dynamic = "force-dynamic";

const CASA_PCT = Math.round(POLLA.porcentajeCasa * 100);
const PREMIO_PCT = 100 - CASA_PCT;

function StatCard({
  icon,
  valor,
  label,
}: {
  icon: React.ReactNode;
  valor: React.ReactNode;
  label: string;
}) {
  return (
    <div className="bg-polla-surface ring-polla-line flex items-center gap-4 rounded-2xl p-5 ring-1">
      <div className="bg-polla-elevated text-polla-gold flex size-11 shrink-0 items-center justify-center rounded-xl">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-heading truncate text-2xl leading-none text-white tabular-nums">
          {valor}
        </div>
        <div className="text-polla-muted mt-1 text-xs font-medium tracking-wide uppercase">
          {label}
        </div>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const user = await getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const [partidosRes, apuestasRes] = await Promise.all([
    getPartidos(),
    getApuestas(),
  ]);

  const partidos = partidosRes.success ? partidosRes.data : [];
  const apuestas = apuestasRes.success ? apuestasRes.data : [];

  const porPartido = new Map<string, Apuesta[]>();
  for (const a of apuestas) {
    const arr = porPartido.get(a.partido_id) ?? [];
    arr.push(a);
    porPartido.set(a.partido_id, arr);
  }

  // Economía global (proyección por porcentaje).
  let recaudado = 0;
  let premioGlobal = 0;
  let casaGlobal = 0;
  for (const p of partidos) {
    const r = calcularResultadoPartido(p, porPartido.get(p.id) ?? []);
    recaudado += r.pozo;
    premioGlobal += r.premioPool;
    casaGlobal += r.casaBase;
  }
  const pagadas = apuestas.filter((a) => a.pagado).length;

  const conApuestas = partidos.filter(
    (p) => (porPartido.get(p.id)?.length ?? 0) > 0,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-polla-dark/60 border-polla-line/70 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="text-polla-gold size-6" />
            <div>
              <span className="font-heading text-polla-gold block text-lg leading-none tracking-wide">
                Administración
              </span>
              <span className="text-polla-muted text-xs">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncButton />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Economía global */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Ticket className="size-5" />}
            valor={`${pagadas}/${apuestas.length}`}
            label="Apuestas pagadas"
          />
          <StatCard
            icon={<Wallet className="size-5" />}
            valor={formatCOP(recaudado)}
            label="Recaudado"
          />
          <StatCard
            icon={<Coins className="size-5" />}
            valor={formatCOP(premioGlobal)}
            label={`Premio (${PREMIO_PCT}%)`}
          />
          <StatCard
            icon={<PiggyBank className="size-5" />}
            valor={formatCOP(casaGlobal)}
            label={`Casa (${CASA_PCT}%)`}
          />
        </div>

        {/* Apuestas por partido (arriba, desplegable) */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-heading text-2xl tracking-wide text-white">
              Apuestas por partido
            </h2>
            {apuestas.length > 0 && <DeleteAllApuestasButton />}
          </div>

          {conApuestas.length === 0 ? (
            <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-12 text-center ring-1">
              <p className="text-polla-muted">Aún no hay apuestas.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {conApuestas.map((p) => {
                const lista = porPartido.get(p.id)!;
                const r = calcularResultadoPartido(p, lista);
                const ganadores = new Set(r.ganadores.map((g) => g.id));
                const finalizado = p.estado === "finalizado";
                return (
                  <details
                    key={p.id}
                    className="group bg-polla-surface ring-polla-line overflow-hidden rounded-2xl ring-1"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <ChevronDown className="text-polla-muted size-4 shrink-0 transition-transform group-open:rotate-180" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">
                            {p.equipo_local} vs {p.equipo_visitante}
                          </div>
                          <div className="text-polla-muted mt-0.5 flex flex-wrap gap-x-3 text-xs">
                            <span>{lista.length} apuesta(s)</span>
                            <span>· {r.apuestasPagadas} pagada(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="font-heading text-polla-gold text-lg leading-none">
                            {formatCOP(r.pozo)}
                          </div>
                          <div className="text-polla-muted mt-1 text-[11px] tracking-wide">
                            Premio {formatCOP(r.premioPool)} · Casa{" "}
                            {formatCOP(r.casaBase)}
                          </div>
                        </div>
                        <EstadoBadge estado={p.estado} />
                      </div>
                    </summary>

                    {/* Detalle */}
                    <div className="border-polla-line/60 border-t">
                      {finalizado && (
                        <div className="bg-polla-elevated/40 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                          {r.ganadores.length > 0 ? (
                            <>
                              <span className="text-polla-muted">
                                Marcador {p.goles_local}–{p.goles_visitante} ·{" "}
                                {r.ganadores.length} ganador(es) ·{" "}
                                <span className="text-polla-gold font-semibold">
                                  {formatCOP(r.premioPorGanador)} c/u
                                </span>{" "}
                                · Casa {formatCOP(r.enCasa)}
                              </span>
                              <PremioPagoToggle
                                partidoId={p.id}
                                pagado={p.premio_pagado}
                              />
                            </>
                          ) : (
                            <span className="text-polla-muted">
                              Nadie acertó ·{" "}
                              <span className="text-polla-gold font-semibold">
                                {formatCOP(r.enCasa)} queda en casa
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="divide-polla-line/40 divide-y">
                        {lista.map((a) => (
                          <div
                            key={a.id}
                            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5"
                          >
                            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-white">
                              {ganadores.has(a.id) && (
                                <Trophy className="text-polla-gold size-4 shrink-0" />
                              )}
                              <span className="min-w-0">
                                <span className="block truncate">{a.nombre}</span>
                                {a.telefono && (
                                  <span className="text-polla-muted block truncate text-xs font-normal">
                                    {a.telefono}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="font-heading text-white tabular-nums">
                              {a.goles_local}–{a.goles_visitante}
                            </span>
                            <PagoToggle id={a.id} pagado={a.pagado} />
                            <DeleteApuestaButton id={a.id} nombre={a.nombre} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        {/* Gestión de partidos: resultados */}
        <section>
          <h2 className="font-heading mb-4 text-2xl tracking-wide text-white">
            Partidos
          </h2>
          {partidos.length === 0 ? (
            <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-12 text-center ring-1">
              <p className="text-polla-muted">
                No hay partidos. Usa “Sincronizar partidos” para traerlos.
              </p>
            </div>
          ) : (
            <div className="bg-polla-surface ring-polla-line divide-polla-line/50 divide-y overflow-hidden rounded-2xl ring-1">
              {partidos.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {p.equipo_local}{" "}
                      <span className="text-polla-muted font-normal">vs</span>{" "}
                      {p.equipo_visitante}
                    </div>
                    <div className="text-polla-muted mt-0.5 text-xs">
                      {formatFecha(p.fecha)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <EstadoBadge estado={p.estado} />
                    <ResultadoForm partido={p} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
