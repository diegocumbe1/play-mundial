"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, ExternalLink, PartyPopper, Send, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import {
  ingresarResultadoLoteria,
  publicarGanadores,
  registrarGanadorInterna,
} from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Boleta, Ganador, Premio, Rifa } from "@/types";
import { enmascararNombre } from "@/lib/rifa";

/** Panel de sorteo: ingresar resultado (lotería) o ganador manual (interna) + publicar. */
export function SorteoPanel({
  rifa,
  premios,
  boletas,
  ganadores,
}: {
  rifa: Rifa;
  premios: Premio[];
  boletas: Boleta[];
  ganadores: Ganador[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState(rifa.resultado_loteria ?? "");
  const [premioId, setPremioId] = useState(premios[0]?.id ?? "");
  const [numeroManual, setNumeroManual] = useState("");
  const [mensaje, setMensaje] = useState("");

  const porNumero = new Map(boletas.map((b) => [b.numero, b]));

  function correr(accion: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {rifa.tipo === "loteria" ? (
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs">
            Número ganador de la lotería {rifa.loteria ? `(${rifa.loteria})` : ""}
          </Label>
          <div className="flex gap-2">
            <Input
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Ej. 1234"
              inputMode="numeric"
              className="max-w-40"
            />
            <Button
              disabled={pending || !resultado.trim()}
              onClick={() =>
                correr(async () => {
                  const r = await ingresarResultadoLoteria(rifa.id, resultado);
                  if (r.success) {
                    toast.message(
                      `${r.data.ganadores} ganador(es)` +
                        (r.data.sinVender ? ` · ${r.data.sinVender} premio(s) sin vender` : ""),
                    );
                  }
                  return r;
                }, "Sorteo resuelto")
              }
            >
              <Sparkles className="size-4" /> Resolver ganadores
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Se cruzan las cifras del resultado con las boletas
            {rifa.solo_pagadas_juegan ? " pagadas" : " vendidas"}.
          </p>

          {rifa.loteria_url && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={rifa.loteria_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <ExternalLink className="size-3.5" /> Ver resultados oficiales
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(rifa.loteria_url!);
                    toast.success("Enlace copiado");
                  } catch {
                    toast.error("No se pudo copiar");
                  }
                }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                <Copy className="size-3.5" /> Copiar enlace
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs">Ganador (número sorteado)</Label>
          <div className="flex flex-wrap gap-2">
            <select
              value={premioId}
              onChange={(e) => setPremioId(e.target.value)}
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            >
              {premios.map((p) => (
                <option key={p.id} value={p.id}>{p.descripcion}</option>
              ))}
            </select>
            <Input
              value={numeroManual}
              onChange={(e) => setNumeroManual(e.target.value)}
              placeholder="Número"
              inputMode="numeric"
              className="max-w-28"
            />
            <Button
              disabled={pending || !premioId || numeroManual === ""}
              onClick={() =>
                correr(
                  () => registrarGanadorInterna(rifa.id, premioId, Number(numeroManual)),
                  "Ganador registrado",
                )
              }
            >
              <Trophy className="size-4" /> Registrar
            </Button>
          </div>
        </div>
      )}

      {ganadores.length > 0 && (
        <div className="border-border flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">Ganadores</p>
          <ul className="flex flex-col gap-1.5">
            {ganadores.map((g) => {
              const b = porNumero.get(g.numero);
              const premio = premios.find((p) => p.id === g.premio_id);
              return (
                <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <b className="tabular-nums">#{g.numero}</b>{" "}
                    <span className="text-muted-foreground">
                      {b?.comprador_nombre ? `${b.comprador_nombre} → ` : "sin vender → "}
                      {premio?.descripcion}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {g.publicado ? "Publicado" : "Sin publicar"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-1 flex flex-col gap-2">
            <Input
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Mensaje de felicitación (opcional)"
            />
            <div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => correr(() => publicarGanadores(rifa.id, mensaje.trim() || null), "Ganadores publicados")}
              >
                <Send className="size-4" /> Publicar en la página pública
              </Button>
            </div>
          </div>

          {/* Vista previa: exactamente lo que verá el público (enmascarado) */}
          <div className="border-primary/30 bg-primary/5 mt-3 rounded-xl border p-3">
            <p className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Eye className="size-3.5" /> Vista previa pública
            </p>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <PartyPopper className="text-primary size-4" /> ¡Ya hay ganadores!
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {ganadores.map((g, i) => {
                const b = porNumero.get(g.numero);
                const premio = premios.find((p) => p.id === g.premio_id);
                return (
                  <li key={g.id} className="flex items-baseline gap-2">
                    {ganadores.length > 1 && (
                      <span className="bg-primary text-primary-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {i + 1}°
                      </span>
                    )}
                    <span>
                      <b className="tabular-nums">
                        #{String(g.numero).padStart(String(rifa.cantidad_numeros - 1).length, "0")}
                      </b>{" "}
                      — {b?.comprador_nombre ? enmascararNombre(b.comprador_nombre) : "—"}{" "}
                      <span className="text-muted-foreground">({premio?.descripcion})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {mensaje.trim() && (
              <p className="text-muted-foreground mt-2 text-sm italic">“{mensaje.trim()}”</p>
            )}
            <p className="text-muted-foreground mt-2 text-[11px]">
              Los nombres van enmascarados y nunca se muestra el teléfono ni el estado de pago.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
