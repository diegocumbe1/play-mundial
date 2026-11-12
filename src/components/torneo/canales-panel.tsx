"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Monitor, RefreshCw, Smartphone, SkipForward } from "lucide-react";
import { toast } from "sonner";

import {
  cargarPartidoCanal,
  getCanalesMarcador,
  liberarCanalMarcador,
  prepararCanalMarcador,
  recargarPartidoCanal,
  regenerarCanalMarcador,
  type CanalVista,
} from "@/actions/torneos";
import { QrEnlace } from "@/components/torneo/qr-enlace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFechaHoraCO } from "@/lib/fecha-co";
import type { Encuentro } from "@/types";
import { Button } from "@/components/ui/button";

/**
 * Enlaces FIJOS de cada cancha para todo el torneo: uno para la TV y uno para el juez. Se
 * entregan una vez; después el partido de la sala cambia cuando el juez toca «Siguiente
 * partido →» o cuando el owner lo carga desde aquí.
 */
export function CanalesPanel({
  torneoId,
  canchas,
  nombresCanchas,
  encuentros,
  nombreEquipo,
}: {
  torneoId: string;
  canchas: number;
  nombresCanchas: string[];
  /** Todos los partidos del torneo: para mostrar el orden antes de preparar la cancha. */
  encuentros: Encuentro[];
  nombreEquipo: (id: string | null) => string;
}) {
  const [canales, setCanales] = useState<CanalVista[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [elegido, setElegido] = useState<Record<string, string>>({});
  /** Cancha cuyo orden se está revisando antes de preparar sus enlaces. */
  const [revisando, setRevisando] = useState<number | null>(null);
  /** Partidos de la cancha en el orden en que se irán cargando: por hora; los sin fecha no se cargan solos. */
  function ordenDeCancha(n: number) {
    const base = encuentros.filter(
      (e) => e.estado === "programado" && e.equipo_a_id && e.equipo_b_id && !e.sala_marcador && (e.cancha ?? 1) === n,
    );
    const conFecha = base
      .filter((e) => e.programado_at)
      .sort((a, b) => a.programado_at!.localeCompare(b.programado_at!) || a.orden - b.orden);
    return { conFecha, sinFecha: base.filter((e) => !e.programado_at) };
  }
  const nombreCancha = (n: number) => nombresCanchas[n - 1]?.trim() || `Cancha ${n}`;

  useEffect(() => {
    let vigente = true;
    getCanalesMarcador(torneoId).then((r) => {
      if (vigente && r.success) setCanales(r.data);
    });
    return () => {
      vigente = false;
    };
  }, [torneoId]);

  async function recargar_lista() {
    const r = await getCanalesMarcador(torneoId);
    if (r.success) setCanales(r.data);
  }

  const copiar = (url: string) => navigator.clipboard.writeText(url).then(() => toast.success("Enlace copiado"));

  function preparar(cancha: number) {
    startTransition(async () => {
      const r = await prepararCanalMarcador(torneoId, cancha);
      if (!r.success) return void toast.error(r.error);
      if (r.data.cargado) toast.success(`Listo. Cargado: ${r.data.cargado}`);
      else toast.warning(r.data.aviso ?? "Enlaces creados, sin partido cargado todavía.");
      await recargar_lista();
    });
  }

  function cargar(canal: CanalVista, encuentroId?: string) {
    startTransition(async () => {
      let r = await cargarPartidoCanal(canal.id, { encuentroId });
      // Si el partido sigue en juego o no se pudo leer, el owner puede forzar el cambio.
      if (!r.success && /sigue en juego|No se pudo leer/i.test(r.error)) {
        const ok = confirm(`${r.error}\n\n¿Cargar el siguiente de todos modos? Se guarda lo que lleve el juez hasta ahora.`);
        if (!ok) return;
        r = await cargarPartidoCanal(canal.id, { encuentroId, forzar: true });
      }
      if (!r.success) return void toast.error(r.error);
      toast.success(`Cargado: ${r.data.partido}`);
      setElegido((prev) => ({ ...prev, [canal.id]: "" }));
      await recargar_lista();
    });
  }

  function recargar(canal: CanalVista) {
    const ok = confirm(
      "¿Volver a cargar este partido en la sala?\n\nPone otra vez los equipos y las reglas. Lo que ya se había marcado en la sala se perdió con el reinicio y vuelve a 0-0.",
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await recargarPartidoCanal(canal.id);
      if (!r.success) return void toast.error(r.error);
      toast.success(`Sala lista otra vez: ${r.data.partido}`);
      await recargar_lista();
    });
  }

  function liberar(canal: CanalVista) {
    const ok = confirm(
      `¿Quitar «${canal.actual?.texto ?? "el partido"}» de la cancha?\n\nDeja de salir «en vivo» y vuelve a «programado». Se borra lo que se haya marcado en la sala y queda en 0-0 esperando el siguiente.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await liberarCanalMarcador(canal.id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Cancha libre: el partido volvió a programado");
      await recargar_lista();
    });
  }

  function regenerar(canal: CanalVista) {
    const ok = confirm(
      "¿Regenerar los enlaces de esta cancha?\n\nLos actuales (TV y juez) dejan de funcionar y hay que compartir los nuevos. Si hay un partido en juego, su marcador arranca de cero.",
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await regenerarCanalMarcador(canal.id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Enlaces nuevos listos");
      await recargar_lista();
    });
  }

  return (
    <section className="border-border flex flex-col gap-3 rounded-2xl border p-4">
      <div>
        <p className="text-sm font-semibold">Marcador por cancha · enlaces fijos</p>
        <p className="text-muted-foreground text-xs">
          Un enlace para la TV y uno para el juez por cada cancha, para todo el torneo. El partido se cambia con el
          botón «Siguiente partido →» del juez o desde aquí; los enlaces no cambian.
        </p>
      </div>

      {canales === null ? (
        <p className="text-muted-foreground text-xs">Cargando…</p>
      ) : (
        Array.from({ length: canchas }, (_, i) => i + 1).map((n) => {
          const c = canales.find((x) => x.cancha === n);
          if (!c) {
            return (
              <div key={n} className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
                <p className="text-sm font-medium">{nombreCancha(n)}</p>
                <Button size="sm" disabled={pending} onClick={() => setRevisando(n)}>
                  Preparar enlaces
                </Button>
              </div>
            );
          }
          return (
            <div key={c.id} className="bg-muted/40 flex flex-col gap-3 rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{nombreCancha(n)}</p>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => regenerar(c)}>
                  <RefreshCw className="size-3.5" /> Regenerar enlaces
                </Button>
              </div>

              {c.salaOk === false && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                  <p className="min-w-0 flex-1">
                    <b>La pantalla muestra equipos en blanco.</b> El marcador se reinició y la sala volvió a
                    nacer vacía. Vuelve a cargar el partido para que la TV y el juez lo vean.
                  </p>
                  <Button size="sm" disabled={pending} onClick={() => recargar(c)}>
                    Volver a cargar el partido
                  </Button>
                </div>
              )}

              <div className="text-xs">
                <span className="text-muted-foreground">Ahora: </span>
                {c.actual ? (
                  <b>
                    {c.actual.texto}
                    {c.actual.estado === "en_vivo" ? " · en vivo" : ""}
                  </b>
                ) : (
                  "sin partido cargado"
                )}
                <br />
                <span className="text-muted-foreground">Sigue: </span>
                {c.siguiente ?? "no hay más partidos programados"}
              </div>

              <div className="flex flex-col gap-1.5">
                {(
                  [
                    { Icono: Monitor, etiqueta: "TV", url: c.enlaces.tv, titulo: `QR de la TV · ${nombreCancha(n)}` },
                    { Icono: Smartphone, etiqueta: "Juez", url: c.enlaces.juez, titulo: `QR del juez · ${nombreCancha(n)}` },
                  ] as const
                ).map(({ Icono, etiqueta, url, titulo }) => (
                  <div key={etiqueta} className="flex items-center gap-2 text-xs">
                    <Icono className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="w-9 shrink-0 font-medium">{etiqueta}</span>
                    <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline">
                      {url}
                    </a>
                    <button type="button" onClick={() => copiar(url)} aria-label={`Copiar enlace de ${etiqueta}`} className="text-muted-foreground hover:text-foreground">
                      <Copy className="size-3.5" />
                    </button>
                    <QrEnlace url={url} titulo={titulo} etiqueta="QR" variante="ghost" />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {c.actual?.estado === "en_vivo" && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => liberar(c)}>
                    Quitar de en vivo
                  </Button>
                )}
                <Button size="sm" disabled={pending || !c.siguiente} onClick={() => cargar(c)}>
                  <SkipForward className="size-3.5" /> Cargar siguiente partido
                </Button>
                {c.pendientes.length > 0 && (
                  <>
                    <select
                      value={elegido[c.id] ?? ""}
                      onChange={(e) => setElegido((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="border-input bg-background h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs"
                      aria-label="Elegir otro partido"
                    >
                      <option value="">Elegir otro partido…</option>
                      {c.pendientes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.texto}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" disabled={pending || !elegido[c.id]} onClick={() => cargar(c, elegido[c.id])}>
                      Cargar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      <Dialog open={revisando !== null} onOpenChange={(o) => !o && setRevisando(null)}>
        <DialogContent className="sm:max-w-lg">
          {revisando !== null &&
            (() => {
              const { conFecha, sinFecha } = ordenDeCancha(revisando);
              const horas = conFecha.map((e) => e.programado_at);
              const repetidas = horas.filter((h, i) => horas.indexOf(h) !== i).length;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Orden de los partidos · {nombreCancha(revisando)}</DialogTitle>
                    <DialogDescription>
                      Así se irán cargando en la pantalla y en el juez, uno tras otro, según lo programado. El primero se
                      carga ahora. ¿El orden es el correcto?
                    </DialogDescription>
                  </DialogHeader>

                  {conFecha.length === 0 ? (
                    <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      Esta cancha no tiene partidos programados con hora. Programa los partidos con «Armar el día» y vuelve
                      a intentarlo. Si sigues, los enlaces se crean sin partido cargado.
                    </p>
                  ) : (
                    <ol className="border-border divide-border max-h-64 divide-y overflow-y-auto rounded-xl border text-sm">
                      {conFecha.slice(0, 12).map((e, i) => (
                        <li key={e.id} className={`flex flex-wrap items-baseline gap-x-3 px-3 py-2 ${i === 0 ? "bg-primary/10" : ""}`}>
                          <span className="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">{i + 1}</span>
                          <span className="text-muted-foreground w-36 shrink-0 text-xs">{formatFechaHoraCO(e.programado_at!)}</span>
                          <span className="min-w-0 flex-1">
                            {nombreEquipo(e.equipo_a_id)} <span className="text-muted-foreground">vs</span> {nombreEquipo(e.equipo_b_id)}
                            {e.grupo ? <span className="text-muted-foreground text-xs"> · Grupo {e.grupo}</span> : null}
                          </span>
                          {i === 0 && <span className="text-primary text-xs font-semibold">se carga primero</span>}
                        </li>
                      ))}
                      {conFecha.length > 12 && (
                        <li className="text-muted-foreground px-3 py-2 text-xs">y {conFecha.length - 12} partido(s) más…</li>
                      )}
                    </ol>
                  )}

                  {repetidas > 0 && (
                    <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                      Hay {repetidas} partido(s) a la misma hora en esta cancha: se cargan en el orden de la lista.
                    </p>
                  )}
                  {sinFecha.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {sinFecha.length} partido(s) de esta cancha aún no tienen hora y <b>no se cargan solos</b>: los eliges a
                      mano con «Elegir otro partido…».
                    </p>
                  )}

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setRevisando(null)}>
                      Reajustar el orden
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        const n = revisando;
                        setRevisando(null);
                        preparar(n);
                      }}
                    >
                      Confirmar y preparar
                    </Button>
                  </DialogFooter>
                  <p className="text-muted-foreground -mt-1 text-xs">
                    «Reajustar el orden» cierra este aviso: cambia los horarios con «Armar el día» (abajo) y vuelve a
                    preparar los enlaces.
                  </p>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}
