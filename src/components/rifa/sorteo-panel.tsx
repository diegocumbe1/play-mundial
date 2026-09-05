"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Dices,
  Eye,
  ExternalLink,
  PartyPopper,
  Radio,
  Send,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import {
  ingresarResultadoLoteria,
  limpiarSorteo,
  publicarGanadores,
  registrarGanadorInterna,
  revelarBalotas,
  sortearRifaInterna,
} from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SorteoAnimado } from "@/components/rifa/sorteo-animado";
import type { Boleta, BolaSorteo, Ganador, Premio, Rifa } from "@/types";
import {
  anchoNumeros,
  boletasElegibles,
  enmascararNombre,
  formatNumero,
  inicioNumeros,
  labelSorteoPropio,
  posicionPremioDeBola,
  ultimoNumero,
} from "@/lib/rifa";

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
  /** Balotas del sorteo abierto en pantalla. */
  const [enVivo, setEnVivo] = useState<BolaSorteo[] | null>(null);
  /** `true` cuando el organizador está cantando (revelado manual + live público). */
  const [cantando, setCantando] = useState(false);

  const porNumero = new Map(boletas.map((b) => [b.numero, b]));
  const ancho = anchoNumeros(rifa);
  const publicado = ganadores.some((g) => g.publicado);
  const juegan = boletasElegibles(rifa, boletas).length;
  const cantadas = rifa.sorteo_reveladas ?? 0;

  // Reconstruye las balotas del último sorteo guardado (incluidas las suplentes,
  // que no quedan en `ganadores`) para poder repetir la animación.
  const bolasGuardadas = useMemo<BolaSorteo[]>(() => {
    const secuencia = rifa.sorteo_secuencia ?? [];
    if (secuencia.length === 0) return [];
    const ordenados = [...premios].sort((a, b) => a.orden - b.orden);
    return secuencia.map((numero, i) => {
      const pos = posicionPremioDeBola(i, secuencia.length, ordenados.length, rifa.sorteo_orden);
      return {
        orden: i + 1,
        numero,
        premio: pos ? (ordenados[pos - 1]?.descripcion ?? null) : null,
        mayor: pos === 1,
        nombre: porNumero.get(numero)?.comprador_nombre ?? null,
      };
    });
    // `porNumero` se recalcula en cada render junto con `boletas`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifa.sorteo_secuencia, rifa.sorteo_orden, premios, boletas]);

  const sorteoAMedias =
    bolasGuardadas.length > 0 && !publicado && cantadas < bolasGuardadas.length;

  function sortear() {
    startTransition(async () => {
      const r = await sortearRifaInterna(rifa.id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      // El resultado ya quedó firmado en el servidor; ahora se canta a mano.
      setEnVivo(r.data.bolas);
      setCantando(true);
      router.refresh();
    });
  }

  /**
   * Publica el avance del sorteo. La página pública solo puede ver las balotas
   * ya cantadas, así que esto es lo que hace que el live avance para la gente.
   */
  function publicarAvance(indice: number) {
    void revelarBalotas(rifa.id, indice + 1).then((r) => {
      if (!r.success) toast.error(r.error);
    });
  }

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
        <div className="flex flex-col gap-3">
          {/* Sorteo automático con animación tipo baloto */}
          <div className="border-border flex flex-col gap-2 rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Dices className="text-primary size-4" /> Sorteo en vivo
            </p>
            <p className="text-muted-foreground text-xs">
              {labelSorteoPropio(rifa.sorteo_bolas || 1, rifa.sorteo_orden)} Juegan las{" "}
              {rifa.solo_pagadas_juegan ? "boletas pagadas" : "boletas vendidas"}:{" "}
              <b>{juegan}</b> número(s).
            </p>
            <div className="flex flex-wrap gap-2">
              {sorteoAMedias ? (
                <Button
                  disabled={pending}
                  onClick={() => {
                    setCantando(true);
                    setEnVivo(bolasGuardadas);
                  }}
                >
                  <Radio className="size-4" /> Continuar el sorteo
                </Button>
              ) : (
                <Button disabled={pending || publicado || juegan === 0} onClick={sortear}>
                  <Dices className="size-4" />
                  {bolasGuardadas.length > 0 ? "Repetir sorteo" : "Sortear ahora"}
                </Button>
              )}
              {bolasGuardadas.length > 0 && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setCantando(false);
                    setEnVivo(bolasGuardadas);
                  }}
                >
                  <Eye className="size-4" /> Ver la animación
                </Button>
              )}
              {bolasGuardadas.length > 0 && !publicado && (
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => correr(() => limpiarSorteo(rifa.id), "Sorteo borrado")}
                >
                  <Trash2 className="size-4" /> Borrar sorteo
                </Button>
              )}
            </div>
            {bolasGuardadas.length > 0 && !publicado && (
              <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Radio className="size-3.5 text-emerald-500" />
                {cantadas >= bolasGuardadas.length
                  ? "Todas las balotas están cantadas y visibles en la página pública."
                  : `Cantadas ${cantadas} de ${bolasGuardadas.length}: el público solo ve esas.`}
              </p>
            )}
            {cantadas > 0 && !publicado && (
              <p className="text-amber-600 dark:text-amber-400 text-xs">
                Ojo: el público ya vio {cantadas} balota(s). Si repites o borras el
                sorteo, se va a notar.
              </p>
            )}
            {publicado && (
              <p className="text-muted-foreground text-xs">
                Ya publicaste los ganadores: el sorteo queda como está.
              </p>
            )}

            {/* Resultado guardado (sin animar): se puede repetir cuando se quiera */}
            {bolasGuardadas.length > 0 && (
              <div className="border-border mt-1 rounded-xl border border-dashed p-3">
                <SorteoAnimado
                  bolas={bolasGuardadas}
                  ancho={ancho}
                  min={inicioNumeros(rifa)}
                  max={ultimoNumero(rifa)}
                  autoPlay={false}
                />
              </div>
            )}
          </div>

          {/* Salida manual: si el sorteo se hizo por fuera (tómbola física) */}
          <details className="border-border rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Registrar un ganador a mano
            </summary>
            <Label className="text-muted-foreground mt-2 block text-xs">
              Úsalo solo si sorteaste por fuera de la app.
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
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
                variant="outline"
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
          </details>
        </div>
      )}

      {/* El momento del sorteo, a pantalla completa */}
      <Dialog open={enVivo !== null} onOpenChange={(o) => !o && setEnVivo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dices className="text-primary size-5" /> Sorteo de {rifa.nombre}
            </DialogTitle>
            <DialogDescription>
              {labelSorteoPropio(enVivo?.length ?? 1, rifa.sorteo_orden)}{" "}
              {cantando
                ? "Tú marcas el ritmo: cada balota se publica en la página pública apenas la cantas."
                : "Repetición del sorteo guardado."}
            </DialogDescription>
          </DialogHeader>
          {enVivo && (
            <SorteoAnimado
              bolas={enVivo}
              ancho={ancho}
              min={inicioNumeros(rifa)}
              max={ultimoNumero(rifa)}
              modo={cantando ? "manual" : "auto"}
              reveladas={cantando ? cantadas : 0}
              onRevelar={cantando ? publicarAvance : undefined}
              onFin={cantando ? () => router.refresh() : undefined}
            />
          )}
          {cantando && (
            <p className="text-muted-foreground text-center text-xs">
              Comparte el enlace público y la gente ve cada balota en vivo.
            </p>
          )}
        </DialogContent>
      </Dialog>

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
                    <b className="tabular-nums">#{formatNumero(g.numero, ancho)}</b>{" "}
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
                        #{formatNumero(g.numero, ancho)}
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
