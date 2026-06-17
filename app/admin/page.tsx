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
import { ApuestasTabs } from "@/components/admin/apuestas-tabs";
import { BuscadorPersonas } from "@/components/admin/buscador-personas";
import { DeleteAllApuestasButton } from "@/components/admin/delete-all-apuestas-button";
import { DeleteApuestaButton } from "@/components/admin/delete-apuesta-button";
import { LogoutButton } from "@/components/admin/logout-button";
import { PagoToggle } from "@/components/admin/pago-toggle";
import { PremioPagoToggle } from "@/components/admin/premio-pago-toggle";
import { ResultadoForm } from "@/components/admin/resultado-form";
import {
  StatDetalleModal,
  type FilaDetalle,
} from "@/components/admin/stat-detalle-modal";
import { SyncButton } from "@/components/admin/sync-button";
import { EstadoBadge } from "@/components/estado-badge";
import { getUser } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { estadoEfectivo } from "@/lib/partido-vivo";
import { calcularResultadoPartido, formatCOP, POLLA } from "@/lib/polla";
import type { Apuesta, EstadoPartido, Partido, ResultadoPartido } from "@/types";

export const dynamic = "force-dynamic";

const CASA_PCT = Math.round(POLLA.porcentajeCasa * 100);
const PREMIO_PCT = 100 - CASA_PCT;

/** Tarjeta de métrica simple (sin desglose). */
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
      <div className="min-w-0 flex-1">
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

type ItemPartido = {
  partido: Partido;
  apuestas: Apuesta[];
  r: ResultadoPartido;
  estado: EstadoPartido;
};

/** Card desplegable de un partido con sus apuestas (usada dentro de cada tab). */
function PartidoApuestasCard({ partido: p, apuestas: lista, r, estado }: ItemPartido) {
  const ganadores = new Set(r.ganadores.map((g) => g.id));
  const finalizado = estado === "finalizado";
  const hayMarcador = p.goles_local !== null && p.goles_visitante !== null;
  const pendientes = lista.length - r.apuestasPagadas;

  return (
    <details className="group bg-polla-surface ring-polla-line overflow-hidden rounded-2xl ring-1">
      <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-2">
          <ChevronDown className="text-polla-muted mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">
              {p.equipo_local} vs {p.equipo_visitante}
            </div>
            <div className="text-polla-muted mt-0.5 flex flex-wrap gap-x-3 text-xs">
              <span>{lista.length} apuesta(s)</span>
              <span>· {r.apuestasPagadas} recibida(s)</span>
              {pendientes > 0 && (
                <span className="text-polla-red">· {pendientes} pendiente(s)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pl-6 sm:justify-end sm:pl-0">
          <div className="sm:text-right">
            <div className="font-heading text-polla-gold text-lg leading-none">
              {formatCOP(r.pozo)}
            </div>
            <div className="text-polla-muted mt-1 text-[11px] tracking-wide">
              Premio {formatCOP(r.premioPool)} · Casa {formatCOP(r.casaBase)}
            </div>
          </div>
          <EstadoBadge estado={estado} enPausa={p.en_pausa} />
        </div>
      </summary>

      {/* Detalle */}
      <div className="border-polla-line/60 border-t">
        {finalizado && (
          <div className="bg-polla-elevated/40 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
            <span className="text-polla-muted">
              {hayMarcador ? (
                <>
                  Marcador{" "}
                  <span className="font-heading text-white tabular-nums">
                    {p.goles_local}–{p.goles_visitante}
                  </span>
                </>
              ) : (
                "Sin marcador registrado"
              )}
              {r.ganadores.length > 0 ? (
                <>
                  {" "}
                  · {r.ganadores.length} ganador(es) ·{" "}
                  <span className="text-polla-gold font-semibold">
                    {formatCOP(r.premioPorGanador)} c/u
                  </span>{" "}
                  · Casa {formatCOP(r.enCasa)}
                </>
              ) : (
                <>
                  {" "}
                  · Nadie acertó ·{" "}
                  <span className="text-polla-gold font-semibold">
                    {formatCOP(r.enCasa)} queda en casa
                  </span>
                </>
              )}
            </span>
            {r.ganadores.length > 0 && (
              <PremioPagoToggle partidoId={p.id} pagado={p.premio_pagado} />
            )}
          </div>
        )}
        <div className="divide-polla-line/40 divide-y">
          {lista.map((a) => (
            <div
              key={a.id}
              className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-white">
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
                  <span className="text-polla-muted block truncate text-xs font-normal">
                    Creada {formatFecha(a.created_at)}
                  </span>
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-3 sm:contents">
                <span className="bg-polla-elevated text-polla-muted rounded-lg px-2.5 py-1 text-xs">
                  Marcador{" "}
                  <span className="font-heading text-white tabular-nums">
                    {a.goles_local}–{a.goles_visitante}
                  </span>
                </span>
                <span className="text-polla-muted text-xs font-semibold">
                  {formatCOP(POLLA.costo)}
                </span>
                <PagoToggle id={a.id} pagado={a.pagado} />
                <DeleteApuestaButton id={a.id} nombre={a.nombre} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
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

  // eslint-disable-next-line react-hooks/purity -- hora actual evaluada por request (server)
  const ahora = Date.now();
  const items: ItemPartido[] = partidos.map((p) => ({
    partido: p,
    apuestas: porPartido.get(p.id) ?? [],
    r: calcularResultadoPartido(p, porPartido.get(p.id) ?? []),
    estado: estadoEfectivo(p, ahora),
  }));

  // Economía global. Recaudo y premio son proyección sobre TODO lo pagado;
  // la casa solo cuenta lo realizado en partidos finalizados (incluye el pozo
  // completo cuando nadie acertó).
  const recaudado = items.reduce((acc, x) => acc + x.r.pozo, 0);
  const premioGlobal = items.reduce((acc, x) => acc + x.r.premioPool, 0);
  const casaGlobal = items.reduce(
    (acc, x) => acc + (x.partido.estado === "finalizado" ? x.r.enCasa : 0),
    0,
  );
  const pagadas = apuestas.filter((a) => a.pagado).length;

  const nombre = (x: ItemPartido) =>
    `${x.partido.equipo_local} vs ${x.partido.equipo_visitante}`;

  const detalleRecaudo: FilaDetalle[] = items
    .filter((x) => x.r.pozo > 0)
    .map((x) => ({
      label: nombre(x),
      monto: x.r.pozo,
      sub: `${x.r.apuestasPagadas} pagada(s) × ${formatCOP(POLLA.costo)}`,
    }));

  const detallePremio: FilaDetalle[] = items
    .filter((x) => x.r.premioPool > 0)
    .map((x) => ({
      label: nombre(x),
      monto: x.r.premioPool,
      sub: `${PREMIO_PCT}% del pozo ${formatCOP(x.r.pozo)}`,
    }));

  const detalleCasa: FilaDetalle[] = items
    .filter((x) => x.partido.estado === "finalizado" && x.r.pozo > 0)
    .map((x) => ({
      label: nombre(x),
      monto: x.r.enCasa,
      sub:
        x.r.ganadores.length > 0
          ? `${CASA_PCT}% + residuo`
          : "Nadie acertó · pozo completo",
    }));

  // Agrupación por estado para las pestañas (solo partidos con apuestas).
  const conApuestas = items.filter((x) => x.apuestas.length > 0);
  const grupos = {
    enCurso: conApuestas.filter((x) => x.estado === "en_juego"),
    pendientes: conApuestas.filter((x) => x.estado === "programado"),
    finalizados: conApuestas.filter(
      (x) => x.estado === "finalizado" || x.estado === "cancelado",
    ),
  };
  const card = (x: ItemPartido) => (
    <PartidoApuestasCard key={x.partido.id} {...x} />
  );

  // Lista plana para buscar apuestas por persona a través de todos los partidos.
  const todasApuestas = conApuestas.flatMap((x) =>
    x.apuestas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      telefono: a.telefono,
      pagado: a.pagado,
      creada: a.created_at,
      marcador: `${a.goles_local}–${a.goles_visitante}`,
      partido: `${x.partido.equipo_local} vs ${x.partido.equipo_visitante}`,
    })),
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* Economía global */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Ticket className="size-5" />}
            valor={`${pagadas}/${apuestas.length}`}
            label="Apuestas pagadas"
          />
          <StatDetalleModal
            icon={<Wallet className="size-5" />}
            valor={formatCOP(recaudado)}
            label="Recaudado"
            titulo="Recaudado por partido"
            filas={detalleRecaudo}
          />
          <StatDetalleModal
            icon={<Coins className="size-5" />}
            valor={formatCOP(premioGlobal)}
            label={`Premio (${PREMIO_PCT}%)`}
            titulo={`Premio (${PREMIO_PCT}%) por partido`}
            filas={detallePremio}
          />
          <StatDetalleModal
            icon={<PiggyBank className="size-5" />}
            valor={formatCOP(casaGlobal)}
            label={`Casa (${CASA_PCT}%) · finalizados`}
            titulo={`Casa (${CASA_PCT}%) · finalizados`}
            filas={detalleCasa}
          />
        </div>

        {/* Apuestas por partido, en pestañas por estado */}
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
            <>
              <BuscadorPersonas apuestas={todasApuestas} />
              <ApuestasTabs
                enCurso={grupos.enCurso.map(card)}
                pendientes={grupos.pendientes.map(card)}
                finalizados={grupos.finalizados.map(card)}
                counts={{
                  enCurso: grupos.enCurso.length,
                  pendientes: grupos.pendientes.length,
                  finalizados: grupos.finalizados.length,
                }}
              />
            </>
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
              {items.map(({ partido: p, estado }) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
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
                    <EstadoBadge estado={estado} enPausa={p.en_pausa} />
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
