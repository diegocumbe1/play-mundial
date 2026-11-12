"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Monitor, RefreshCw, Smartphone, SkipForward } from "lucide-react";
import { toast } from "sonner";

import {
  cargarPartidoCanal,
  getCanalesMarcador,
  prepararCanalMarcador,
  regenerarCanalMarcador,
  type CanalVista,
} from "@/actions/torneos";
import { QrEnlace } from "@/components/torneo/qr-enlace";
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
}: {
  torneoId: string;
  canchas: number;
  nombresCanchas: string[];
}) {
  const [canales, setCanales] = useState<CanalVista[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [elegido, setElegido] = useState<Record<string, string>>({});
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

  async function recargar() {
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
      await recargar();
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
      await recargar();
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
      await recargar();
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
                <Button size="sm" disabled={pending} onClick={() => preparar(n)}>
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
    </section>
  );
}
