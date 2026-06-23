"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Info,
  Loader2,
  MessageCircle,
  QrCode,
  Ticket,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { getResultadosPorCliente } from "@/actions/apuestas";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getClienteId } from "@/lib/cliente-id";
import { traducirEquipo, type Idioma } from "@/lib/idioma";
import { formatCOP, POLLA } from "@/lib/polla";
import { cn } from "@/lib/utils";
import type { ApuestaCliente, Partido, ResultadoCliente } from "@/types";

const ORDEN: Record<string, number> = {
  en_juego: 0,
  programado: 1,
  finalizado: 2,
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
        <details open className="group border-polla-line/50 mt-3 border-t pt-3">
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

function ModalPagoPendiente({
  open,
  onOpenChange,
  detalle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: string[];
}) {
  const [qrError, setQrError] = useState(false);
  const [pagoComunicado, setPagoComunicado] = useState(false);
  const total = detalle.length * POLLA.costo;
  const mensajePago = [
    "Hola, ya realice mi pago.",
    `Monto: ${formatCOP(total)}`,
    `Apuestas: ${detalle.length}`,
    "Detalle:",
    ...detalle,
    "Por favor confirmar y habilitar mi apuesta.",
  ].join("\n");
  const whatsappPagoUrl = `https://wa.me/${POLLA.whatsappAdmin}?text=${encodeURIComponent(
    mensajePago,
  )}`;

  function comunicarPago() {
    if (pagoComunicado) {
      toast.info("El pago ya fue comunicado para estas apuestas.");
      return;
    }

    setPagoComunicado(true);
    window.open(whatsappPagoUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-polla-surface border-polla-line max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-polla-gold text-2xl tracking-wide">
            Pago pendiente
          </DialogTitle>
          <DialogDescription className="text-polla-muted">
            {detalle.length} apuesta(s) ya registrada(s) · transfiere{" "}
            <span className="text-polla-gold font-semibold">
              {formatCOP(total)}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="ring-polla-line flex w-full max-w-80 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1">
            {qrError ? (
              <div className="text-polla-muted flex aspect-square w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs">
                <QrCode className="size-8" />
                Coloca tu QR en
                <code className="text-polla-gold">public/qr-pago.png</code>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={POLLA.qrSrc}
                alt="QR de pago"
                className="h-auto w-full"
                onError={() => setQrError(true)}
              />
            )}
          </div>
          <div className="grid w-full max-w-80 grid-cols-2 gap-2">
            <a
              href={POLLA.qrSrc}
              download="qr-pago-paola-gomez.png"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-polla-gold/50 text-polla-gold hover:bg-polla-gold/10",
              )}
            >
              <Download className="size-4" />
              Descargar QR
            </a>
            <a
              href={POLLA.qrSrc}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-polla-line text-white hover:bg-white/5",
              )}
            >
              <ExternalLink className="size-4" />
              Abrir QR
            </a>
          </div>
          <div className="bg-polla-dark/40 ring-polla-line/70 grid w-full max-w-80 gap-1 rounded-xl px-3 py-2 text-xs ring-1">
            {detalle.map((item, index) => (
              <div key={`${index}-${item}`} className="text-polla-muted">
                {item}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={comunicarPago}
            disabled={pagoComunicado}
            className="border-polla-gold/60 bg-polla-gold/10 text-polla-gold hover:bg-polla-gold/15 w-full max-w-80 font-bold"
          >
            <MessageCircle className="size-4" />
            {pagoComunicado ? "Pago comunicado" : "Comunicar pago"}
          </Button>
          <div className="text-center text-sm">
            <div className="font-semibold text-white">{POLLA.banco.entidad}</div>
            <div className="text-polla-muted">{POLLA.banco.numero}</div>
            <div className="text-polla-muted">{POLLA.banco.titular}</div>
          </div>
          <Link
            href="/terminos"
            target="_blank"
            className="text-polla-muted hover:text-polla-gold inline-flex items-center gap-1.5 text-xs"
          >
            <Info className="size-3.5" />
            Cómo funciona · Términos y privacidad
          </Link>
        </div>
      </DialogContent>
    </Dialog>
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
  const [pagoOpen, setPagoOpen] = useState(false);
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

  const { conApuestas, porPartido, resumenPorPartido, detallePendiente } =
    useMemo(() => {
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
          b.fecha.localeCompare(a.fecha),
      );

    const partidosPorId = new Map(partidos.map((p) => [p.id, p]));
    const detallePendiente = resultado.apuestas
      .filter((a) => !a.pagado)
      .map((a, index) => {
        const partido = partidosPorId.get(a.partido_id);
        const local = partido
          ? traducirEquipo(partido.equipo_local, idioma)
          : "Partido";
        const visitante = partido
          ? traducirEquipo(partido.equipo_visitante, idioma)
          : "sin identificar";

        return `${index + 1}. ${local} vs ${visitante}: ${a.goles_local}-${a.goles_visitante}`;
      });

    return { conApuestas, porPartido, resumenPorPartido, detallePendiente };
  }, [idioma, partidos, resultado]);

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
      {detallePendiente.length > 0 && (
        <div className="border-polla-gold/40 bg-polla-gold/10 text-polla-gold flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold">Tienes pago pendiente</div>
            <div className="text-polla-muted text-sm">
              {detallePendiente.length} apuesta(s) ya registrada(s). Puedes ver
              el QR sin crear una apuesta nueva.
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setPagoOpen(true)}
            className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 gap-2 rounded-xl font-bold"
          >
            <QrCode className="size-4" />
            Ver QR
          </Button>
        </div>
      )}
      {conApuestas.map((p) => (
        <ResultadoCard
          key={p.id}
          partido={p}
          apuestas={porPartido.get(p.id)!}
          resumen={resumenPorPartido.get(p.id)}
          idioma={idioma}
        />
      ))}
      {detallePendiente.length > 0 && (
        <ModalPagoPendiente
          open={pagoOpen}
          onOpenChange={setPagoOpen}
          detalle={detallePendiente}
        />
      )}
    </div>
  );
}
