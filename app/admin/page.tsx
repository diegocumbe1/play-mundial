import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  Coins,
  CreditCard,
  Gamepad2,
  Info,
  ListChecks,
  PiggyBank,
  Trophy,
  Wallet,
} from "lucide-react";

import { getApuestas } from "@/actions/apuestas";
import { getPartidos } from "@/actions/partidos";
import { ApuestasTabs, type TabId } from "@/components/admin/apuestas-tabs";
import {
  ApuestasPagoModal,
  type FilaPago,
} from "@/components/admin/apuestas-pago-modal";
import { BuscadorPersonas } from "@/components/admin/buscador-personas";
import { DeleteAllApuestasButton } from "@/components/admin/delete-all-apuestas-button";
import { DeleteApuestaButton } from "@/components/admin/delete-apuesta-button";
import { LogoutButton } from "@/components/admin/logout-button";
import { MarcarPremioPagadoButton } from "@/components/admin/marcar-premio-pagado-button";
import { NotificacionesToggle } from "@/components/admin/notificaciones-toggle";
import {
  NotasPagoModal,
  type NotaPagoPartido,
} from "@/components/admin/notas-pago-modal";
import { PagoToggle } from "@/components/admin/pago-toggle";
import { PremioPagoToggle } from "@/components/admin/premio-pago-toggle";
import { PremioWhatsappButton } from "@/components/admin/premio-whatsapp-button";
import { TelefonoCopiable } from "@/components/admin/telefono-copiable";
import { ResultadoForm } from "@/components/admin/resultado-form";
import { PageRefreshButton } from "@/components/page-refresh-button";
import {
  StatDetalleModal,
  type FilaDetalle,
} from "@/components/admin/stat-detalle-modal";
import { SyncButton } from "@/components/admin/sync-button";
import { AsistenteApuestasModal } from "@/components/admin/asistente-apuestas-modal";
import { EstadoBadge } from "@/components/estado-badge";
import { getUser } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { getMarcadorActual, getMarcadorReglamentario } from "@/lib/marcador-reglamentario";
import { estadoEfectivo } from "@/lib/partido-vivo";
import { calcularResultadoPartido, formatCOP, POLLA } from "@/lib/polla";
import { cn } from "@/lib/utils";
import type { Apuesta, EstadoPartido, Partido, ResultadoPartido } from "@/types";

export const dynamic = "force-dynamic";

const CASA_PCT = Math.round(POLLA.porcentajeCasa * 100);
const PREMIO_PCT = 100 - CASA_PCT;
const TABS: TabId[] = ["enCurso", "pendientes", "finalizados"];

type ItemPartido = {
  partido: Partido;
  apuestas: Apuesta[];
  r: ResultadoPartido;
  estado: EstadoPartido;
};

type MarcadorAdmin = {
  goles_local: number;
  goles_visitante: number;
  apuestas: Apuesta[];
  pagadas: number;
  esMarcadorActual: boolean;
  premioPorPersona: number;
};

/** Prioriza los cobros aún por validar, sin alterar el orden del resto. */
function ordenarApuestasPendientes(apuestas: Apuesta[], estado: EstadoPartido) {
  if (estado !== "programado") return apuestas;

  return [...apuestas].sort(
    (a, b) =>
      Number(!b.pagado && !b.no_pago) - Number(!a.pagado && !a.no_pago),
  );
}

function agruparPorMarcador({
  partido,
  apuestas,
  r,
  estado,
}: ItemPartido): MarcadorAdmin[] {
  const marcadorActual = getMarcadorActual(partido);

  const porMarcador = new Map<string, MarcadorAdmin>();

  for (const apuesta of apuestas) {
    const llave = `${apuesta.goles_local}-${apuesta.goles_visitante}`;
    const grupo = porMarcador.get(llave) ?? {
      goles_local: apuesta.goles_local,
      goles_visitante: apuesta.goles_visitante,
      apuestas: [],
      pagadas: 0,
      esMarcadorActual:
        marcadorActual !== null &&
        apuesta.goles_local === marcadorActual.goles_local &&
        apuesta.goles_visitante === marcadorActual.goles_visitante,
      premioPorPersona: 0,
    };

    grupo.apuestas.push(apuesta);
    if (apuesta.pagado) grupo.pagadas += 1;
    porMarcador.set(llave, grupo);
  }

  for (const marcador of porMarcador.values()) {
    if (marcador.esMarcadorActual && marcador.pagadas > 0) {
      marcador.premioPorPersona =
        estado === "finalizado"
          ? r.premioPorGanador
          : Math.floor(r.premioPool / marcador.pagadas);
    }
  }

  return [...porMarcador.values()].sort(
    (a, b) =>
      Number(b.esMarcadorActual) - Number(a.esMarcadorActual) ||
      b.apuestas.length - a.apuestas.length ||
      b.pagadas - a.pagadas ||
      a.goles_local - b.goles_local ||
      a.goles_visitante - b.goles_visitante,
  );
}

/** Card desplegable de un partido con sus apuestas (usada dentro de cada tab). */
function PartidoApuestasCard({ partido: p, apuestas: lista, r, estado }: ItemPartido) {
  const ganadores = new Set(r.ganadores.map((g) => g.id));
  const finalizado = estado === "finalizado";
  const enJuego = estado === "en_juego";
  const marcadorReglamentario = getMarcadorReglamentario(p);
  const hayMarcador = marcadorReglamentario !== null;
  const noPagaron = lista.filter((a) => a.no_pago).length;
  const pendientes =
    estado === "programado"
      ? lista.filter((a) => !a.pagado && !a.no_pago).length
      : 0;
  const cobrosCerrados = lista.filter(
    (a) => !a.pagado && (a.no_pago || estado !== "programado"),
  ).length;
  const apuestasOrdenadas = ordenarApuestasPendientes(lista, estado);
  const marcadores = agruparPorMarcador({
    partido: p,
    apuestas: apuestasOrdenadas,
    r,
    estado,
  });
  // Cuántas personas se reparten el premio: solo quienes acertaron el marcador
  // reglamentario y pagaron. Es el mismo divisor con el que se calcula el premio.
  const cantidadGanadores = r.ganadores.length;
  // Mensaje pre-generado para avisarle a un ganador que se le paga el premio.
  const mensajePremio = (a: Apuesta) =>
    [
      "Hola, buen día ",
      "",
      `Pago Polla ${p.equipo_local} vs ${p.equipo_visitante}`,
      marcadorReglamentario
        ? `Marcador: ${marcadorReglamentario.goles_local}–${marcadorReglamentario.goles_visitante}`
        : null,
      `Ganadores: ${cantidadGanadores}`,
      `Tu premio: ${formatCOP(r.premioPorGanador)}`,
      "",
      `¡Felicidades ${a.nombre}!`,
    ]
      .filter((linea) => linea !== null)
      .join("\n");
  const notasPago: NotaPagoPartido[] = lista
    .filter((a) => a.nota_pago?.trim())
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      telefono: a.telefono,
      marcador: `${a.goles_local}–${a.goles_visitante}`,
      metodoPago: a.metodo_pago,
      pagado: a.pagado,
      nota: a.nota_pago!.trim(),
    }));

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
              {noPagaron > 0 && (
                <span className="text-polla-muted">· {noPagaron} no pagó</span>
              )}
              {cobrosCerrados > noPagaron && (
                <span className="text-polla-muted">· {cobrosCerrados} cobro(s) cerrado(s)</span>
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
              {marcadorReglamentario ? (
                <>
                  Marcador reglamentario{" "}
                  <span className="font-heading text-white tabular-nums">
                    {marcadorReglamentario.goles_local}–
                    {marcadorReglamentario.goles_visitante}
                  </span>
                </>
              ) : (
                "Marcador reglamentario pendiente"
              )}
              {hayMarcador &&
                (r.ganadores.length > 0 ? (
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
                ))}
              {hayMarcador && p.resultado_manual && (
                <span className="text-polla-gold">
                  {" "}
                  · verificado manualmente
                </span>
              )}
            </span>
            {notasPago.length > 0 && (
              <NotasPagoModal
                partido={`${p.equipo_local} vs ${p.equipo_visitante}`}
                notas={notasPago}
              />
            )}
          </div>
        )}
        <div className="divide-polla-line/40 divide-y">
          {finalizado && (
            <div className="bg-polla-dark/20 flex flex-col gap-3 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-polla-muted inline-flex items-start gap-2 text-xs leading-relaxed">
                <Info className="text-polla-gold mt-0.5 size-3.5 shrink-0" />
                <span>
                  Solo cuenta el tiempo reglamentario: 90&apos; + reposición. Si
                  la API trae prórroga o penales, corrige aquí el marcador que
                  quedó en los 90&apos;.
                </span>
              </p>
              <div className="shrink-0">
                <ResultadoForm partido={p} compacto />
              </div>
            </div>
          )}
          <details className="group/marcadores bg-polla-dark/20 px-4 py-3" open={enJuego || finalizado}>
            <summary className="text-polla-muted hover:text-white flex cursor-pointer list-none items-center justify-between gap-3 text-sm transition [&::-webkit-details-marker]:hidden">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Image
                  src="/icon.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 shrink-0 rounded-full ring-1 ring-white/20"
                />
                <span className="truncate">Ver marcadores de la polla</span>
              </span>
              <ChevronDown className="size-4 shrink-0 transition group-open/marcadores:rotate-180" />
            </summary>

            <div className="mt-3 grid gap-2">
              {marcadores.map((marcador) => {
                const estadoTexto = finalizado ? "Ganaron" : "Van ganando";

                return (
                  <div
                    key={`${marcador.goles_local}-${marcador.goles_visitante}`}
                    className={
                      marcador.esMarcadorActual
                        ? "bg-polla-gold/10 ring-polla-gold/40 rounded-xl px-3 py-3 ring-1"
                        : "bg-polla-elevated/45 ring-polla-line/60 rounded-xl px-3 py-3 ring-1"
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-2">
                        <Image
                          src="/icon.svg"
                          alt="Marcador"
                          width={32}
                          height={32}
                          className="size-8 shrink-0 rounded-full ring-1 ring-white/20"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-heading text-2xl leading-none text-white tabular-nums">
                              {marcador.goles_local}-{marcador.goles_visitante}
                            </span>
                            {marcador.esMarcadorActual && (
                              <span className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1">
                                {estadoTexto}
                              </span>
                            )}
                          </div>
                          <div className="text-polla-muted text-xs">
                            {marcador.apuestas.length}{" "}
                            {marcador.apuestas.length === 1
                              ? "persona"
                              : "personas"}{" "}
                            · {marcador.pagadas} pagada(s)
                          </div>
                        </div>
                      </div>

                      {marcador.esMarcadorActual && (
                        <div className="shrink-0 sm:text-right">
                          <span className="text-polla-gold inline-flex items-center gap-1 text-xs font-bold">
                            <CheckCircle2 className="size-4" />
                            {finalizado ? "Correcto" : "Por ahora"}
                          </span>
                          {marcador.premioPorPersona > 0 && (
                            <div className="font-heading text-polla-gold text-xl leading-none tabular-nums">
                              {formatCOP(marcador.premioPorPersona)} c/u
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-polla-line/50 mt-3 grid gap-2 border-t pt-3">
                      {marcador.apuestas.map((a) => (
                        <div
                          key={a.id}
                          className={cn(
                            "grid gap-2 rounded-lg px-2 py-1 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center",
                            ganadores.has(a.id) &&
                              a.premio_pagado &&
                              "opacity-45",
                            ganadores.has(a.id) &&
                              !a.premio_pagado &&
                              "bg-polla-gold/[0.06] ring-1 ring-polla-gold/25",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2 font-medium text-white">
                              {ganadores.has(a.id) && (
                                <Trophy className="text-polla-gold size-4 shrink-0" />
                              )}
                              <span className="truncate">{a.nombre}</span>
                            </div>
                            <div className="text-polla-muted truncate text-xs">
                              {a.telefono && (
                                <>
                                  <TelefonoCopiable telefono={a.telefono} />
                                  {" · "}
                                </>
                              )}
                              Creada {formatFecha(a.created_at)}
                            </div>
                          </div>
                          <PagoToggle
                            id={a.id}
                            pagado={a.pagado}
                            metodoPago={a.metodo_pago}
                            notaPago={a.nota_pago}
                            noPago={a.no_pago}
                            cobroCerrado={!a.pagado && estado !== "programado"}
                          />
                          {ganadores.has(a.id) && (
                            <PremioPagoToggle
                              apuestaId={a.id}
                              pagado={a.premio_pagado}
                              notaPremio={a.nota_premio}
                            />
                          )}
                          {ganadores.has(a.id) && a.telefono && (
                            <PremioWhatsappButton
                              telefono={a.telefono}
                              mensaje={mensajePremio(a)}
                              premioPagado={a.premio_pagado}
                            />
                          )}
                          <DeleteApuestaButton id={a.id} nombre={a.nombre} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>

          {apuestasOrdenadas.map((a) => (
            <div
              key={a.id}
              className={cn(
                "grid gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center",
                ganadores.has(a.id) && a.premio_pagado && "opacity-45",
                ganadores.has(a.id) && !a.premio_pagado && "bg-polla-gold/[0.06]",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-white">
                {ganadores.has(a.id) && (
                  <Trophy className="text-polla-gold size-4 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{a.nombre}</span>
                  {a.telefono && (
                    <span className="text-polla-muted block truncate text-xs font-normal">
                      <TelefonoCopiable telefono={a.telefono} />
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
                <PagoToggle
                  id={a.id}
                  pagado={a.pagado}
                  metodoPago={a.metodo_pago}
                  notaPago={a.nota_pago}
                  noPago={a.no_pago}
                  cobroCerrado={!a.pagado && estado !== "programado"}
                />
                {ganadores.has(a.id) && (
                  <PremioPagoToggle
                    apuestaId={a.id}
                    pagado={a.premio_pagado}
                    notaPremio={a.nota_premio}
                  />
                )}
                {ganadores.has(a.id) && a.telefono && (
                  <PremioWhatsappButton
                    telefono={a.telefono}
                    mensaje={mensajePremio(a)}
                    premioPagado={a.premio_pagado}
                  />
                )}
                <DeleteApuestaButton id={a.id} nombre={a.nombre} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/admin/login");
  }
  const query = await searchParams;
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const initialTab = TABS.includes(requestedTab as TabId)
    ? (requestedTab as TabId)
    : undefined;

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
  const filasPago = items.flatMap((item) =>
    item.apuestas.map((a): FilaPago => {
      const base = {
        id: a.id,
        nombre: a.nombre,
        telefono: a.telefono,
        partido: `${item.partido.equipo_local} vs ${item.partido.equipo_visitante}`,
        marcador: `${a.goles_local}–${a.goles_visitante}`,
      };

      if (a.pagado) {
        return {
          ...base,
          detalle: `${formatCOP(POLLA.costo)} · ${a.metodo_pago === "efectivo" ? "Efectivo" : "Transferencia"}`,
          tipo: "pagada",
        };
      }
      if (a.no_pago) {
        return { ...base, detalle: "Marcada como no pagó", tipo: "cerrada" };
      }
      return {
        ...base,
        detalle:
          item.estado === "programado"
            ? "Partido próximo"
            : item.estado === "en_juego"
              ? "Partido iniciado"
              : "Partido finalizado",
        tipo: item.estado === "programado" ? "pendiente" : "cerrada",
      };
    }),
  );
  const pagosRecibidos = filasPago.filter((fila) => fila.tipo === "pagada");
  const cobrosPendientes = filasPago.filter((fila) => fila.tipo === "pendiente");
  const cobrosCerrados = filasPago.filter((fila) => fila.tipo === "cerrada");
  const pagosEfectivo = apuestas.filter(
    (a) => a.pagado && a.metodo_pago === "efectivo",
  );
  const pagosTransferencia = apuestas.filter(
    (a) => a.pagado && a.metodo_pago === "transferencia",
  );
  const totalEfectivo = pagosEfectivo.length * POLLA.costo;
  const totalTransferencia = pagosTransferencia.length * POLLA.costo;

  const nombre = (x: ItemPartido) =>
    `${x.partido.equipo_local} vs ${x.partido.equipo_visitante}`;
  const partidoPorId = new Map(partidos.map((p) => [p.id, p]));

  const detalleMetodoPago = (lista: Apuesta[]): FilaDetalle[] =>
    lista.map((a) => {
      const partido = partidoPorId.get(a.partido_id);
      const partidoLabel = partido
        ? `${partido.equipo_local} vs ${partido.equipo_visitante}`
        : "Partido sin identificar";
      const contacto = a.telefono ? `${a.telefono} · ` : "";

      return {
        label: a.nombre,
        monto: POLLA.costo,
        sub: `${contacto}${partidoLabel} · ${a.goles_local}–${a.goles_visitante}`,
      };
    });

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

  // Cada ganador pendiente recibe el premio calculado para su partido. Se
  // mantiene por persona para que el modal sirva como lista de pagos a hacer.
  const premiosPendientes: FilaDetalle[] = items.flatMap((item) =>
    item.estado === "finalizado" && item.r.premioPorGanador > 0
      ? item.r.ganadores
          .filter((a) => !a.premio_pagado)
          .map((a) => ({
            label: a.nombre,
            monto: item.r.premioPorGanador,
            sub: `${a.telefono ? `${a.telefono} · ` : ""}${nombre(item)} · ${a.goles_local}–${a.goles_visitante}`,
            accion: <MarcarPremioPagadoButton apuestaId={a.id} />,
          }))
      : [],
  );
  const totalPremiosPendientes = premiosPendientes.reduce(
    (acc, premio) => acc + premio.monto,
    0,
  );

  // Agrupación por estado para las pestañas (solo partidos con apuestas).
  const conApuestas = items.filter((x) => x.apuestas.length > 0);
  const grupos = {
    enCurso: conApuestas.filter((x) => x.estado === "en_juego"),
    pendientes: conApuestas.filter((x) => x.estado === "programado"),
    finalizados: conApuestas.filter(
      (x) => x.estado === "finalizado" || x.estado === "cancelado",
    ).sort((a, b) => Date.parse(b.partido.fecha) - Date.parse(a.partido.fecha)),
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
      metodoPago: a.metodo_pago,
      notaPago: a.nota_pago,
      noPago: a.no_pago,
      creada: a.created_at,
      marcador: `${a.goles_local}–${a.goles_visitante}`,
      partido: `${x.partido.equipo_local} vs ${x.partido.equipo_visitante}`,
    })),
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-polla-dark/60 border-polla-line/70 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="hover:bg-polla-elevated/50 -m-2 flex items-center gap-2 rounded-xl p-2 transition-colors"
          >
            <Trophy className="text-polla-gold size-6" />
            <div>
              <span className="font-heading text-polla-gold block text-lg leading-none tracking-wide">
                Administración
              </span>
              <span className="text-polla-muted text-xs">{user.email}</span>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/resultados"
              className="border-polla-line bg-polla-surface hover:bg-polla-elevated hidden h-7 items-center gap-1 rounded-lg border px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-white transition-colors sm:inline-flex"
            >
              <ListChecks className="size-3.5" />
              Resultados
            </Link>
            <Link
              href="/jugar"
              className="border-polla-line bg-polla-surface hover:bg-polla-elevated hidden h-7 items-center gap-1 rounded-lg border px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-white transition-colors sm:inline-flex"
            >
              <Gamepad2 className="size-3.5" />
              Jugar
            </Link>
            <AsistenteApuestasModal partidos={partidos} />
            <NotificacionesToggle />
            <PageRefreshButton />
            <SyncButton />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* Economía global */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ApuestasPagoModal
            total={apuestas.length}
            pagadas={pagosRecibidos}
            pendientes={cobrosPendientes}
            cerradas={cobrosCerrados}
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
          <StatDetalleModal
            icon={<Trophy className="size-5" />}
            valor={formatCOP(totalPremiosPendientes)}
            label={`${premiosPendientes.length} premio(s) pendiente(s)`}
            titulo="Premios pendientes por entregar"
            filas={premiosPendientes}
            filtroPlaceholder="Filtrar por persona, teléfono o partido…"
            itemLabel="premio(s) pendiente(s)"
            resaltar={premiosPendientes.length > 0}
          />
          <StatDetalleModal
            icon={<Banknote className="size-5" />}
            valor={formatCOP(totalEfectivo)}
            label={`${pagosEfectivo.length} en efectivo`}
            titulo="Pagos en efectivo"
            filas={detalleMetodoPago(pagosEfectivo)}
            filtroPlaceholder="Filtrar por persona, teléfono o partido…"
            itemLabel="apuesta(s)"
          />
          <StatDetalleModal
            icon={<CreditCard className="size-5" />}
            valor={formatCOP(totalTransferencia)}
            label={`${pagosTransferencia.length} por transferencia`}
            titulo="Pagos por transferencia"
            filas={detalleMetodoPago(pagosTransferencia)}
            filtroPlaceholder="Filtrar por persona, teléfono o partido…"
            itemLabel="apuesta(s)"
          />
        </div>

        {/* Apuestas por partido, en pestañas por estado */}
        <section id="apuestas" className="mb-10 scroll-mt-24">
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
                initialTab={initialTab}
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
