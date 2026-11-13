"use client";

import { Radio } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFechaHoraCO } from "@/lib/fecha-co";
import { nombreCancha } from "@/lib/torneo-avisos-reglas";
import { calcularTabla, etiquetaLugar, labelFase, ORDEN_FASES, resultadoPartido } from "@/lib/torneo-fixture";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import { cn } from "@/lib/utils";
import type { EncuentroPublico, FaseEncuentro } from "@/types";

/**
 * Ficha de un equipo: su categoría, su grupo y posición, cada partido con su
 * resultado o fecha, y su camino en eliminatorias. Solo usa datos del fixture
 * (los mismos de la página pública), así se puede abrir desde el panel y desde la tabla.
 */
export function EquipoDetalleModal({
  equipoId,
  onCerrar,
  nombre,
  categorias,
  encuentros,
  retiradoIds,
  tablaReglas,
  nombresCanchas = [],
  onAbrirPartido,
}: {
  equipoId: string | null;
  onCerrar: () => void;
  nombre: (id: string | null) => string;
  categorias: { id: string; nombre: string }[];
  encuentros: EncuentroPublico[];
  /** Retirados y rechazados: no cuentan en la tabla. */
  retiradoIds: Set<string>;
  tablaReglas: ReglasTorneo["tabla"];
  nombresCanchas?: string[];
  /** Solo en el panel del organizador: abre el partido para cargar resultado u horario. */
  onAbrirPartido?: (e: EncuentroPublico) => void;
}) {
  if (!equipoId) return null;
  const suyos = encuentros.filter((e) => e.equipo_a_id === equipoId || e.equipo_b_id === equipoId);
  const deGrupos = suyos.filter((e) => e.fase === "grupos");
  const elim = suyos
    .filter((e) => e.fase !== "grupos")
    .sort((a, b) => ORDEN_FASES.indexOf(a.fase) - ORDEN_FASES.indexOf(b.fase));
  const primero = suyos[0] ?? null;
  const categoria = categorias.find((c) => c.id === primero?.categoria_id)?.nombre ?? null;
  const grupo = deGrupos[0]?.grupo ?? null;
  const retirado = retiradoIds.has(equipoId);
  const clasifican = tablaReglas.clasifican ?? 2;

  // Tabla de su grupo (con los mismos partidos que ve el público).
  const delGrupo = deGrupos.length
    ? encuentros.filter((e) => e.fase === "grupos" && e.categoria_id === primero?.categoria_id && e.grupo === grupo)
    : [];
  const ids = (
    [...new Set(delGrupo.flatMap((e) => [e.equipo_a_id, e.equipo_b_id]).filter(Boolean))] as string[]
  ).filter((id) => !retiradoIds.has(id));
  const tabla = calcularTabla(ids, delGrupo, tablaReglas);
  const pos = tabla.findIndex((f) => f.equipoId === equipoId);
  const fila = pos >= 0 ? tabla[pos] : null;

  const porFecha = (a: EncuentroPublico, b: EncuentroPublico) =>
    (a.programado_at ?? "9").localeCompare(b.programado_at ?? "9") || a.ronda - b.ronda || a.orden - b.orden;
  const partidosGrupo = [...deGrupos].sort(porFecha);

  function abrir(e: EncuentroPublico) {
    if (!onAbrirPartido) return;
    onCerrar();
    onAbrirPartido(e);
  }

  function partido(e: EncuentroPublico) {
    const lado = e.equipo_a_id === equipoId ? "a" : "b";
    const rivalId = lado === "a" ? e.equipo_b_id : e.equipo_a_id;
    const lugarRival = etiquetaLugar(e, lado === "a" ? "b" : "a", null);
    const rival = rivalId ? nombre(rivalId) : (lugarRival ?? "Por definir");
    const r = resultadoPartido(e);
    const jugado = e.estado === "finalizado" || e.estado === "wo";
    const gano = jugado && r.ganador === lado;
    const perdio = jugado && r.ganador !== null && r.ganador !== lado;
    const propios = lado === "a" ? r.setsA : r.setsB;
    const ajenos = lado === "a" ? r.setsB : r.setsA;
    const detalle = e.sets.map(([a, b]) => (lado === "a" ? `${a}-${b}` : `${b}-${a}`)).join(", ");
    const Contenedor = onAbrirPartido ? "button" : "div";
    return (
      <li key={e.id}>
        <Contenedor
          type={onAbrirPartido ? "button" : undefined}
          onClick={onAbrirPartido ? () => abrir(e) : undefined}
          className={cn(
            "border-border flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left",
            onAbrirPartido && "hover:border-primary/60 transition-colors",
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              <span className="text-muted-foreground font-normal">vs </span>
              {rival}
            </p>
            <p className="text-muted-foreground text-xs">
              {e.estado === "en_vivo" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-red-500">
                  <Radio className="size-3" /> En vivo · set {e.sets.length}
                </span>
              ) : e.programado_at ? (
                `${formatFechaHoraCO(e.programado_at)}${e.cancha ? ` · ${nombreCancha(e.cancha, nombresCanchas)}` : ""}`
              ) : jugado ? (
                "Jugado"
              ) : (
                "Por programar (sin fecha)"
              )}
              {e.fase !== "grupos" && ` · ${labelFase(e.fase as FaseEncuentro)}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {jugado || e.estado === "en_vivo" ? (
              <>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    gano && "text-emerald-600 dark:text-emerald-400",
                    perdio && "text-destructive",
                  )}
                >
                  {e.estado === "wo" ? (gano ? "Ganó por W.O." : "Perdió por W.O.") : `${propios} - ${ajenos}`}
                  {jugado && !(e.estado === "wo") && (gano ? " ✓" : perdio ? " ✗" : "")}
                </p>
                {detalle && <p className="text-muted-foreground text-[11px] tabular-nums">{detalle}</p>}
              </>
            ) : (
              <span className="text-muted-foreground text-xs">Pendiente</span>
            )}
          </div>
        </Contenedor>
      </li>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{nombre(equipoId)}</DialogTitle>
          <DialogDescription>
            {[categoria, grupo ? `Grupo ${grupo}` : null, retirado ? "Retirado" : null].filter(Boolean).join(" · ") ||
              "Todavía sin partidos"}
          </DialogDescription>
        </DialogHeader>

        {fila && (
          <section className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { l: "Posición", v: `${pos + 1}° de ${tabla.length}`, ok: pos < clasifican },
                { l: "Puntos", v: String(fila.pts) },
                { l: "PJ · PG · PP", v: `${fila.pj} · ${fila.pg} · ${fila.pp}` },
                { l: "Sets", v: `${fila.setsFavor}-${fila.setsContra}` },
              ].map((x) => (
                <div
                  key={x.l}
                  className={cn(
                    "border-border rounded-xl border p-2",
                    x.ok && "border-emerald-500/40 bg-emerald-500/5",
                  )}
                >
                  <p className="text-muted-foreground text-[11px]">{x.l}</p>
                  <p className={cn("text-sm font-bold", x.ok && "text-emerald-600 dark:text-emerald-400")}>{x.v}</p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {pos < clasifican
                ? `Va clasificando a eliminatorias (pasan ${clasifican} por grupo).`
                : `Fuera de los ${clasifican} que pasan por grupo, por ahora.`}
            </p>

            <div className="border-border overflow-hidden rounded-xl border">
              <table className="w-full text-xs">
                <tbody>
                  {tabla.map((f, i) => (
                    <tr
                      key={f.equipoId}
                      className={cn(
                        "border-border border-t first:border-t-0",
                        f.equipoId === equipoId && "bg-primary/10 font-semibold",
                      )}
                    >
                      <td className="w-6 px-2 py-1">{i + 1}</td>
                      <td className="px-1 py-1">{nombre(f.equipoId)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{f.pj} PJ</td>
                      <td className="px-2 py-1 text-right font-bold tabular-nums">{f.pts} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {partidosGrupo.length > 0 && (
          <section>
            <p className="mb-1.5 text-sm font-semibold">
              Fase de grupos <span className="text-muted-foreground font-normal">({partidosGrupo.length})</span>
            </p>
            <ul className="flex flex-col gap-1.5">{partidosGrupo.map(partido)}</ul>
          </section>
        )}

        {elim.length > 0 && (
          <section>
            <p className="mb-1.5 text-sm font-semibold">Eliminatorias</p>
            <ul className="flex flex-col gap-1.5">{elim.map(partido)}</ul>
          </section>
        )}

        {suyos.length === 0 && (
          <p className="border-border text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Este equipo aún no tiene partidos. Cuando se arme el fixture o se asigne a un grupo, aparecen aquí.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
