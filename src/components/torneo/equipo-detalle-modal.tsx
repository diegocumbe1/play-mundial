"use client";

import { Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ajustarTablaEquipo } from "@/actions/torneos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFechaHoraCO } from "@/lib/fecha-co";
import { nombreCancha } from "@/lib/torneo-avisos-reglas";
import { calcularTabla, etiquetaLugar, labelFase, ORDEN_FASES, resultadoPartido } from "@/lib/torneo-fixture";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import { Input } from "@/components/ui/input";
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
  torneoId,
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
  /** Solo en el panel del organizador: habilita «Ajuste de tabla» (PJ / PG). */
  torneoId?: string;
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
                : tablaReglas.consolacion?.activo && pos + 1 >= tablaReglas.consolacion.desde && pos + 1 <= tablaReglas.consolacion.hasta
                  ? `${tablaReglas.consolacion.nombre?.trim() || "Torneo consolación"} (naranja): no pasa a eliminatorias, por ahora. ${tablaReglas.consolacion.nota}`
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
            {torneoId && (
              <AjusteTabla
                key={equipoId}
                torneoId={torneoId}
                equipoId={equipoId}
                actual={tablaReglas.ajustes?.[equipoId] ?? { pj: 0, pg: 0 }}
                fila={fila}
              />
            )}
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
            Este equipo aún no tiene partidos. Cuando se creen los partidos o se asigne a un grupo, aparecen aquí.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Solo para el organizador. Corrige lo que la tabla MUESTRA de este equipo (PJ y PG) sin tocar sus
 * puntos, sus sets ni a los demás equipos. Útil cuando un equipo se retira y su rival se queda con
 * un partido de más. Se guarda como diferencia: -1 = «un partido menos».
 */
function AjusteTabla({
  torneoId,
  equipoId,
  actual,
  fila,
}: {
  torneoId: string;
  equipoId: string;
  actual: { pj: number; pg: number };
  fila: { pj: number; pg: number; pp: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(actual.pj !== 0 || actual.pg !== 0);
  const [pj, setPj] = useState(String(actual.pj));
  const [pg, setPg] = useState(String(actual.pg));

  const nPj = Number.parseInt(pj, 10);
  const nPg = Number.parseInt(pg, 10);
  const valido = Number.isInteger(nPj) && Number.isInteger(nPg);
  const hayAjuste = actual.pj !== 0 || actual.pg !== 0;
  const sinCambios = valido && nPj === actual.pj && nPg === actual.pg;
  // La fila ya trae el ajuste guardado: se le quita y se le pone el nuevo para ver cómo quedaría.
  const vistaPj = valido ? Math.max(0, fila.pj - actual.pj + nPj) : null;
  const vistaPg = valido ? Math.max(0, fila.pg - actual.pg + nPg) : null;

  function guardar(a: { pj: number; pg: number }) {
    startTransition(async () => {
      const r = await ajustarTablaEquipo(torneoId, equipoId, a);
      if (!r.success) return void toast.error(r.error);
      toast.success(a.pj === 0 && a.pg === 0 ? "Ajuste quitado" : "Ajuste guardado");
      if (a.pj === 0 && a.pg === 0) {
        setPj("0");
        setPg("0");
      }
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2"
      >
        Ajustar PJ / PG en la tabla
      </button>
    );
  }

  return (
    <div className="border-border flex flex-col gap-2 rounded-xl border border-dashed p-3">
      <div>
        <p className="text-sm font-semibold">Ajuste de tabla</p>
        <p className="text-muted-foreground text-xs">
          Úsalo cuando un equipo se retiró y este quedó con un partido de más que los demás. Solo cambia PJ y PG:
          los puntos y los sets no se tocan. Escribe -1 para restar uno.
        </p>
        <details className="mt-1.5 text-xs">
          <summary className="text-primary cursor-pointer font-medium">Cómo se usa, paso a paso</summary>
          <div className="text-muted-foreground mt-1.5 flex flex-col gap-2">
            <p>
              <b className="text-foreground">¿Cuándo?</b> Un equipo se retira, pero ya había jugado contra este. Ese
              partido se conserva (el rival no pierde lo que ganó), así que este equipo queda con un partido y una
              victoria más que los demás del grupo.
            </p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Mira en la tabla cuántos PJ y PG tiene este equipo comparado con los demás.</li>
              <li>
                En «Partidos jugados» escribe <b className="text-foreground">-1</b> para que cuente uno menos. Haz lo
                mismo en «Partidos ganados» si ese partido fue una victoria (o no lo toques si fue una derrota).
              </li>
              <li>Revisa la línea «Quedará»: PG + PP debe sumar PJ.</li>
              <li>Pulsa «Guardar ajuste». La tabla se actualiza sola, también la que ven los visitantes.</li>
            </ol>
            <p>
              <b className="text-foreground">Ejemplo:</b> tenía PJ 4 · PG 2 · PP 2. Con PJ -1 y PG -1 queda PJ 3 · PG 1
              · PP 2. Sus puntos y sus sets siguen igual.
            </p>
            <p>
              <b className="text-foreground">Para deshacerlo:</b> «Quitar ajuste». Vuelve a mostrar lo que dicen los
              partidos jugados.
            </p>
            <p>
              <b className="text-foreground">Ojo:</b> este ajuste no cambia los puntos ni los sets, solo cuántos
              partidos jugó y ganó. Sirve para que la tabla no engañe, no para quitarle puntos al equipo.
            </p>
          </div>
        </details>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Partidos jugados (PJ)
          <Input type="number" inputMode="numeric" step={1} min={-50} max={50} value={pj} onChange={(e) => setPj(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Partidos ganados (PG)
          <Input type="number" inputMode="numeric" step={1} min={-50} max={50} value={pg} onChange={(e) => setPg(e.target.value)} />
        </label>
      </div>
      <p className="text-xs">
        {vistaPj !== null && vistaPg !== null ? (
          <>
            Quedará: <b>PJ {vistaPj} · PG {vistaPg}</b> · PP {fila.pp}
            {vistaPg + fila.pp !== vistaPj && (
              <span className="text-amber-600 dark:text-amber-400"> — PG + PP no suma PJ; revisa los números.</span>
            )}
          </>
        ) : (
          <span className="text-destructive">Escribe números enteros.</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending || !valido || sinCambios} onClick={() => guardar({ pj: nPj, pg: nPg })}>
          {pending ? "Guardando…" : "Guardar ajuste"}
        </Button>
        {hayAjuste && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => guardar({ pj: 0, pg: 0 })}>
            Quitar ajuste
          </Button>
        )}
      </div>
    </div>
  );
}
