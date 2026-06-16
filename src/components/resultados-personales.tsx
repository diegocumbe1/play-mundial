"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Ticket,
  Trophy,
} from "lucide-react";

import { getResultadosPorCliente } from "@/actions/apuestas";
import { getClienteId } from "@/lib/cliente-id";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { formatCOP } from "@/lib/polla";
import type { ApuestaCliente, Partido, ResultadoCliente } from "@/types";

const ORDEN: Record<string, number> = {
  en_juego: 0,
  finalizado: 1,
  programado: 2,
  cancelado: 3,
};

function EstadoPago({ pagado }: { pagado: boolean }) {
  return (
    <span
      className={
        pagado
          ? "bg-polla-gold/15 text-polla-gold ring-polla-gold/40 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1"
          : "bg-polla-red/10 text-polla-red ring-polla-red/30 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1"
      }
    >
      {pagado ? "Pago recibido" : "Pago pendiente"}
    </span>
  );
}

function ResultadoCard({
  partido,
  apuestas,
  resumen,
  idioma,
}: {
  partido: Partido;
  apuestas: ApuestaCliente[];
  resumen: ResultadoCliente["resumenes"][number] | undefined;
  idioma: Idioma;
}) {
  const finalizado = partido.estado === "finalizado";
  const enJuego = partido.estado === "en_juego";
  const tieneMarcador =
    (enJuego || finalizado) &&
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const ganadores = new Set(resumen?.ganadoresClienteIds ?? []);
  const tieneGanador = apuestas.some((a) => ganadores.has(a.id));
  const marcadores = resumen?.marcadores ?? [];

  return (
    <div className="bg-polla-surface ring-polla-line rounded-2xl p-4 ring-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">
            {traducirEquipo(partido.equipo_local, idioma)}{" "}
            <span className="text-polla-muted font-normal">vs</span>{" "}
            {traducirEquipo(partido.equipo_visitante, idioma)}
          </div>
          {tieneMarcador && (
            <div className="font-heading text-polla-gold mt-1 text-2xl tabular-nums">
              {partido.goles_local} – {partido.goles_visitante}
              <span className="text-polla-muted ml-2 align-middle font-sans text-xs font-semibold tracking-wide uppercase">
                {finalizado ? "Final" : "Ahora"}
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-polla-muted text-xs tracking-wide uppercase">
            Premio
          </div>
          <div className="font-heading text-polla-gold text-2xl tabular-nums">
            {formatCOP(resumen?.premioPool ?? 0)}
          </div>
          <div className="text-polla-muted text-xs">
            {resumen?.apuestasPagadas ?? 0} pagada(s)
          </div>
        </div>
      </div>

      <div className="border-polla-line/50 mt-3 grid gap-2 border-t pt-3">
        <p className="text-polla-muted text-xs tracking-wide uppercase">
          Tus apuestas
        </p>
        {apuestas.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="font-heading text-white tabular-nums">
              {a.goles_local}–{a.goles_visitante}
            </span>
            <span className="flex items-center gap-2">
              {ganadores.has(a.id) && (
                <span className="text-polla-gold inline-flex items-center gap-1 font-bold">
                  <Trophy className="size-4" />
                  {formatCOP(resumen?.premioPorGanador ?? 0)}
                </span>
              )}
              <EstadoPago pagado={a.pagado} />
            </span>
          </div>
        ))}
      </div>

      {marcadores.length > 0 && (
        <details className="group border-polla-line/50 mt-3 border-t pt-3">
          <summary className="text-polla-muted hover:text-white flex cursor-pointer list-none items-center justify-between gap-3 text-sm transition [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Image
                src="/icon.svg"
                alt=""
                width={24}
                height={24}
                className="size-6 rounded-full ring-1 ring-white/20"
              />
              Ver marcadores de la polla
            </span>
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>

          <div className="mt-3 grid gap-2">
            {marcadores.map((marcador) => {
              const esPropio = marcador.propias > 0;

              return (
                <div
                  key={`${marcador.goles_local}-${marcador.goles_visitante}`}
                  className={
                    marcador.esMarcadorActual
                      ? "bg-polla-gold/10 ring-polla-gold/40 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1"
                      : esPropio
                        ? "bg-polla-deep/25 ring-polla-gold/30 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1"
                        : "bg-polla-dark/40 ring-polla-line/50 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1"
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Image
                      src="/icon.svg"
                      alt="Apuesta anonima"
                      width={28}
                      height={28}
                      className="size-7 shrink-0 rounded-full ring-1 ring-white/20"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-lg leading-none text-white tabular-nums">
                          {marcador.goles_local}-{marcador.goles_visitante}
                        </span>
                        {esPropio && (
                          <span className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1">
                            {marcador.propias === 1
                              ? "Tu marcador"
                              : `Tus ${marcador.propias} apuestas`}
                          </span>
                        )}
                      </div>
                      <div className="text-polla-muted text-xs">
                        {marcador.cantidad}{" "}
                        {marcador.cantidad === 1 ? "persona" : "personas"}
                        {marcador.pagadas > 0
                          ? ` · ${marcador.pagadas} pagada(s)`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {marcador.esMarcadorActual && (
                    <div className="text-right">
                      <span className="text-polla-gold inline-flex shrink-0 items-center gap-1 text-xs font-bold">
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
              );
            })}
          </div>
        </details>
      )}

      {finalizado && (
        <p className="text-polla-muted border-polla-line/50 mt-3 border-t pt-3 text-sm">
          {tieneGanador ? (
            <>
              Acertaste el marcador exacto. Premio por apuesta ganadora:{" "}
              <span className="text-polla-gold font-semibold">
                {formatCOP(resumen?.premioPorGanador ?? 0)}
              </span>
              .
            </>
          ) : (
            "No acertaste el marcador exacto en este partido."
          )}
        </p>
      )}
    </div>
  );
}

export function ResultadosPersonales({
  partidos,
  idioma,
}: {
  partidos: Partido[];
  idioma: Idioma;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCliente>({
    apuestas: [],
    resumenes: [],
  });

  useEffect(() => {
    let active = true;
    const clienteId = getClienteId();

    if (!clienteId) {
      Promise.resolve().then(() => {
        if (active) setLoading(false);
      });
      return;
    }

    getResultadosPorCliente(clienteId).then((res) => {
      if (!active) return;
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResultado(res.data);
    });

    return () => {
      active = false;
    };
  }, []);

  const { conApuestas, porPartido, resumenPorPartido } = useMemo(() => {
    const porPartido = new Map<string, ApuestaCliente[]>();
    for (const apuesta of resultado.apuestas) {
      const lista = porPartido.get(apuesta.partido_id) ?? [];
      lista.push(apuesta);
      porPartido.set(apuesta.partido_id, lista);
    }

    const resumenPorPartido = new Map(
      resultado.resumenes.map((r) => [r.partido_id, r]),
    );

    const conApuestas = partidos
      .filter((p) => (porPartido.get(p.id)?.length ?? 0) > 0)
      .sort(
        (a, b) =>
          (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9) ||
          a.fecha.localeCompare(b.fecha),
      );

    return { conApuestas, porPartido, resumenPorPartido };
  }, [partidos, resultado]);

  if (loading) {
    return (
      <div className="bg-polla-surface ring-polla-line flex items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center ring-1">
        <Loader2 className="text-polla-gold size-5 animate-spin" />
        <p className="text-polla-muted">Cargando tus resultados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-polla-red/10 ring-polla-red/30 rounded-2xl px-6 py-8 text-center ring-1">
        <p className="text-polla-red">{error}</p>
      </div>
    );
  }

  if (conApuestas.length === 0) {
    return (
      <div className="bg-polla-surface ring-polla-line flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center ring-1">
        <Ticket className="text-polla-muted size-10" />
        <p className="text-polla-muted">
          En este dispositivo todavía no hay apuestas registradas.
        </p>
        <Link
          href="/jugar"
          className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 rounded-xl px-4 py-2 text-sm font-bold"
        >
          Registrar apuesta
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {conApuestas.map((p) => (
        <ResultadoCard
          key={p.id}
          partido={p}
          apuestas={porPartido.get(p.id)!}
          resumen={resumenPorPartido.get(p.id)}
          idioma={idioma}
        />
      ))}
    </div>
  );
}
