"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy, Loader2, MessageCircle, PartyPopper, Ticket, Trophy } from "lucide-react";
import { toast } from "sonner";

import { getRifaPublica, reservarNumeros, type RifaPublica } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP, labelCriterioPremio, labelModoCifras } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { getDecoracion, getTema } from "@/lib/temas-rifa";
import { waLink } from "@/lib/whatsapp";
import { Decoracion } from "@/components/rifa/decoracion-rifa";
import { getOrCreateClienteId } from "@/lib/cliente-id";

/** Vista pública de una rifa: embudo de reserva + grilla en vivo (ocupado/libre). */
export function RifaPublicaView({
  slug,
  initial,
}: {
  slug: string;
  initial: RifaPublica;
}) {
  const [data, setData] = useState(initial);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reservadoOk, setReservadoOk] = useState<number[] | null>(null);
  // Se conserva para el mensaje de WhatsApp después de limpiar el formulario.
  const [nombreReservado, setNombreReservado] = useState("");

  const { rifa, premios, grilla, pago, ganadores } = data;
  const t = getTema(rifa.tema).web;
  const disponibles = grilla.filter((c) => !c.ocupado).length;
  const vendidas = rifa.cantidad_numeros - disponibles;
  const pct = rifa.cantidad_numeros > 0 ? Math.round((vendidas / rifa.cantidad_numeros) * 100) : 0;
  const ancho = String(rifa.cantidad_numeros - 1).length;
  const abierta = rifa.estado === "activa";
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });

  const temaVars = {
    minHeight: "100vh",
    position: "relative" as const,
    overflow: "hidden",
    backgroundColor: t.bg,
    color: t.text,
    "--rifa-accent": t.accent,
    "--rifa-accent-ink": t.accentInk,
    "--rifa-surface": t.surface,
    "--rifa-muted": t.muted,
    "--rifa-text": t.text,
    "--rifa-line": t.line,
    "--rifa-ocupado": t.ocupadoBg,
    "--rifa-ocupado-ink": t.ocupadoInk,
  } as React.CSSProperties;

  const refrescar = useCallback(async () => {
    const r = await getRifaPublica(slug);
    if (r.success) setData(r.data);
  }, [slug]);

  useEffect(() => {
    const id = setInterval(refrescar, 20000);
    const onVis = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refrescar]);

  function toggle(n: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  const total = seleccion.size * rifa.precio_boleta;
  const premiosOrdenados = useMemo(
    () => [...premios].sort((a, b) => a.orden - b.orden),
    [premios],
  );
  const premioPrincipal = premiosOrdenados[0];

  function reservar() {
    startTransition(async () => {
      const r = await reservarNumeros({
        slug,
        numeros: [...seleccion],
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        cliente_id: getOrCreateClienteId(),
        consentimiento: true,
      });
      if (!r.success) {
        toast.error(r.error);
        await refrescar();
        return;
      }
      if (r.data.ocupados.length > 0) {
        toast.message(`Algunos ya estaban tomados: ${r.data.ocupados.join(", ")}`);
      }
      setNombreReservado(nombre.trim());
      setReservadoOk(r.data.reservados);
      setSeleccion(new Set());
      setModal(false);
      setNombre("");
      setTelefono("");
      setAcepto(false);
      await refrescar();
    });
  }

  return (
    <div style={temaVars}>
      <Decoracion
        tipo={getDecoracion(rifa.decoracion)}
        accent={t.accent}
        suave={t.ocupadoBg}
        claro={t.surface}
      />
      <div className="relative mx-auto max-w-md px-4 py-6">
        {/* Hero: premio + promesa */}
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rifa-accent)]">
            {rifa.tipo === "loteria" && rifa.loteria ? rifa.loteria : "Rifa"}
          </p>
          <h1 className="text-2xl font-bold text-balance">{rifa.nombre}</h1>
          {premioPrincipal && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm">
              <Trophy className="size-4 text-[var(--rifa-accent)]" />
              <span className="font-semibold">
                {premioPrincipal.tipo === "valor" && premioPrincipal.valor
                  ? formatCOP(premioPrincipal.valor)
                  : premioPrincipal.descripcion}
              </span>
            </p>
          )}
        </div>

        {/* Banda: fecha de juego + valor */}
        <div
          className="mb-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-xl px-4 py-2.5 text-center text-sm font-bold"
          style={{ background: t.accent, color: t.accentInk }}
        >
          {fechaJuegoTxt && <span>Juega el {fechaJuegoTxt}</span>}
          {fechaJuegoTxt && <span aria-hidden>·</span>}
          <span>{formatCOP(rifa.precio_boleta)} por número</span>
        </div>

        {/* Escasez */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--rifa-muted)]">
            <span>Quedan <b style={{ color: t.text }}>{disponibles}</b> de {rifa.cantidad_numeros}</span>
            <span>{pct}% vendido</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--rifa-line)]">
            <div className="h-full rounded-full bg-[var(--rifa-accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Premios (1°, 2°, 3°…) — solo si hay más de uno */}
        {premiosOrdenados.length > 1 && (
          <div
            className="mb-4 rounded-xl border p-3"
            style={{ borderColor: t.line, background: t.surface }}
          >
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="size-4 text-[var(--rifa-accent)]" /> Premios
            </p>
            <ul className="flex flex-col gap-1.5">
              {premiosOrdenados.map((p, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: t.accent, color: t.accentInk }}
                  >
                    {i + 1}°
                  </span>
                  <span className="font-medium">
                    {p.tipo === "valor" && p.valor ? formatCOP(p.valor) : p.descripcion}
                  </span>
                  {p.criterio && (
                    <span className="text-[11px] text-[var(--rifa-muted)]">
                      ({labelCriterioPremio(p.criterio, rifa.formato_cifras)})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Info lotería */}
        {rifa.tipo === "loteria" && rifa.modo_cifras && (
          <p className="mb-4 rounded-lg border p-2 text-center text-xs text-[var(--rifa-muted)]" style={{ borderColor: t.line }}>
            🎯 Gana con las{" "}
            <b style={{ color: t.text }}>
              {labelModoCifras(rifa.modo_cifras, rifa.formato_cifras)}
            </b>
            {rifa.loteria ? ` de la ${rifa.loteria}` : ""}.
            {rifa.loteria_url && (
              <>
                {" "}
                <a
                  href={rifa.loteria_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline text-[var(--rifa-accent)]"
                >
                  Ver resultados
                </a>
              </>
            )}
          </p>
        )}

        {/* Ganadores publicados */}
        {ganadores.length > 0 && (
          <div className="mb-4 rounded-xl border p-3" style={{ borderColor: t.accent, background: t.surface }}>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <PartyPopper className="size-4 text-[var(--rifa-accent)]" /> ¡Ya hay ganadores!
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {ganadores.map((g, i) => (
                <li key={i}>
                  <b className="tabular-nums">#{String(g.numero).padStart(ancho, "0")}</b> — {g.nombre_enmascarado}{" "}
                  <span className="text-[var(--rifa-muted)]">({g.premio})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Grilla pública (ocupado/libre) */}
        {/* 10 columnas fijas: las 100 boletas caben en una sola vista. */}
        <div className="mb-2 grid grid-cols-10 gap-1">
          {grilla.map((c) => {
            const sel = seleccion.has(c.numero);
            const base = "tap-scale flex aspect-square w-full items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors sm:text-xs";
            const cls = c.ocupado
              ? "line-through cursor-not-allowed bg-[var(--rifa-ocupado)] text-[var(--rifa-ocupado-ink)]"
              : sel
                ? "bg-[var(--rifa-accent)] text-[var(--rifa-accent-ink)] ring-2 ring-[var(--rifa-accent)]"
                : "cursor-pointer border bg-[var(--rifa-surface)] border-[var(--rifa-line)] hover:border-[var(--rifa-accent)]";
            return (
              <button
                key={c.numero}
                type="button"
                disabled={c.ocupado || !abierta}
                onClick={() => toggle(c.numero)}
                className={`${base} ${cls}`}
              >
                {String(c.numero).padStart(ancho, "0")}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex justify-center gap-4 text-[11px] text-[var(--rifa-muted)]">
          <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded border bg-[var(--rifa-surface)] border-[var(--rifa-line)]" /> Libre</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-[var(--rifa-ocupado)]" /> Ocupado</span>
        </div>

        {!abierta && (
          <p className="mb-4 text-center text-sm text-[var(--rifa-muted)]">
            Esta rifa {rifa.estado === "sorteada" || rifa.estado === "pagada" ? "ya se sorteó" : "no está recibiendo reservas"}.
          </p>
        )}

        {/* Barra de reserva */}
        {abierta && seleccion.size > 0 && (
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg" style={{ background: t.surface, borderColor: t.line }}>
            <div>
              <p className="text-sm font-semibold">{seleccion.size} número(s)</p>
              <p className="text-xs text-[var(--rifa-muted)]">{formatCOP(total)}</p>
            </div>
            <Button onClick={() => setModal(true)} style={{ background: t.accent, color: t.accentInk }}>
              <Ticket className="size-4" /> Reservar
            </Button>
          </div>
        )}

        {/* Cómo pagar */}
        {pago && (pago.nequi_llave || pago.llave || pago.whatsapp || pago.qr_url) && (
          <div className="mt-6 rounded-xl border p-3" style={{ borderColor: t.line }}>
            <p className="mb-2 text-sm font-semibold">¿Cómo pagar?</p>
            <div className="flex flex-col gap-2">
              {pago.nequi_llave && (
                <PagoLinea label="Nequi" value={pago.nequi_llave} sub={pago.titular ?? undefined} />
              )}
              {pago.llave && (
                <PagoLinea label="Llave / Bre-B" value={pago.llave} sub={pago.titular ?? undefined} />
              )}
            </div>
            {pago.qr_url && (
              <div className="mt-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pago.qr_url} alt="QR de pago" className="size-40 rounded-lg object-contain" />
              </div>
            )}
            {pago.whatsapp && (
              <a
                href={`https://wa.me/${pago.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[var(--rifa-accent)] hover:underline"
              >
                Escribir por WhatsApp →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Modal reserva */}
      <Dialog open={modal} onOpenChange={(o) => !o && setModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar {seleccion.size} número(s)</DialogTitle>
            <DialogDescription>
              {[...seleccion].sort((a, b) => a - b).map((n) => String(n).padStart(ancho, "0")).join(", ")} · {formatCOP(total)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label className="text-muted-foreground mb-1.5 block text-xs">Tu nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div>
              <Label className="text-muted-foreground mb-1.5 block text-xs">Tu teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 000 0000" inputMode="tel" />
            </div>
            <label className="text-muted-foreground flex items-start gap-2 text-xs">
              <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
              <span>
                Autorizo el tratamiento de mis datos (nombre y teléfono) para gestionar esta rifa.
                Las boletas no pagadas no participan en el sorteo.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !nombre.trim() || !telefono.trim() || !acepto}
              onClick={reservar}
              aria-busy={pending}
              className="w-full"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Reservando…" : "Confirmar reserva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación */}
      <Dialog open={reservadoOk !== null} onOpenChange={(o) => !o && setReservadoOk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="text-emerald-500 size-5" /> ¡Reservado!
            </DialogTitle>
            <DialogDescription>
              Guardamos tus números: {reservadoOk?.map((n) => String(n).padStart(ancho, "0")).join(", ")}.
              Ahora realiza el pago para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {pago?.nequi_llave && <PagoLinea label="Nequi" value={pago.nequi_llave} sub={pago.titular ?? undefined} />}
            {pago?.llave && <PagoLinea label="Llave / Bre-B" value={pago.llave} sub={pago.titular ?? undefined} />}
          </div>
          <DialogFooter>
            {pago?.whatsapp ? (
              <a
                href={waLink(
                  pago.whatsapp,
                  `¡Hola! Quiero tomar el/los número(s) ${reservadoOk
                    ?.map((n) => String(n).padStart(ancho, "0"))
                    .join(", ")} de la rifa "${rifa.nombre}". Ya los aparté a nombre de ${nombreReservado || "mí"}. ¿Cómo hago el pago?`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white sm:w-auto"
              >
                <MessageCircle className="size-4" /> Avisar por WhatsApp
              </a>
            ) : (
              <Button onClick={() => setReservadoOk(null)}>Listo</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PagoLinea({ label, value, sub }: { label: string; value: string; sub?: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-[var(--rifa-ocupado)]">
      <div>
        <p className="text-[11px] uppercase text-[var(--rifa-muted)]">{label}</p>
        <p className="font-semibold">{value}</p>
        {sub && <p className="text-xs text-[var(--rifa-muted)]">{sub}</p>}
      </div>
      <button type="button" onClick={copiar} aria-label={`Copiar ${label}`} className="rounded-md p-1.5 hover:bg-black/5">
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
