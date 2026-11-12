"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Medal, Radio } from "lucide-react";

import {
  calcularTabla,
  etiquetaLugar,
  fechaColombia,
  labelFase,
  ORDEN_FASES,
  resultadoPartido,
} from "@/lib/torneo-fixture";
import { formatDiaCO, formatFechaHoraCO } from "@/lib/fecha-co";
import { nombreCancha } from "@/lib/torneo-avisos-reglas";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import { Desplegable } from "@/components/torneo/desplegable";
import { cn } from "@/lib/utils";
import type { EncuentroPublico, FaseEncuentro } from "@/types";

/**
 * Fixture del torneo: en vivo, posiciones, llaves, podio y resultados. La usan
 * el panel del organizador y la página pública. La tabla se CALCULA aquí con
 * las reglas del torneo: nunca se guarda, así nunca queda desalineada.
 *
 * Con `autoRefrescar`, mientras haya partidos en vivo la página se actualiza
 * sola cada 15 s (paso previo al tiempo real con el marcador).
 */
export function FixtureVista({
  categorias,
  equipos,
  encuentros,
  tablaReglas,
  nombresCanchas = [],
  autoRefrescar = false,
  onEditar,
  categoriaInicial = null,
}: {
  /** Categoría que se muestra primero (la elegida por el organizador o la de más inscritos). */
  categoriaInicial?: string | null;
  categorias: { id: string; nombre: string }[];
  equipos: { id: string; nombre: string }[];
  encuentros: EncuentroPublico[];
  tablaReglas: ReglasTorneo["tabla"];
  /** Nombres de las canchas (vacío = "Cancha N"). */
  nombresCanchas?: string[];
  autoRefrescar?: boolean;
  /** Solo en el panel: tocar un partido abre la carga de resultado. */
  onEditar?: (e: EncuentroPublico) => void;
}) {
  const router = useRouter();
  // Torneos guardados antes de existir la regla no la traen: 2, como antes.
  const clasifican = tablaReglas.clasifican ?? 2;
  const [categoriaId, setCategoriaId] = useState(
    categorias.some((c) => c.id === categoriaInicial) ? categoriaInicial : (categorias[0]?.id ?? null),
  );
  const nombre = useMemo(() => {
    const mapa = new Map(equipos.map((e) => [e.id, e.nombre]));
    return (id: string | null) => (id ? (mapa.get(id) ?? "Equipo") : "Por definir");
  }, [equipos]);

  const hayEnVivo = encuentros.some((e) => e.estado === "en_vivo");
  useEffect(() => {
    if (!autoRefrescar || !hayEnVivo) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [autoRefrescar, hayEnVivo, router]);

  const lista = encuentros.filter((e) => (categoriaId ? e.categoria_id === categoriaId : true));
  if (encuentros.length === 0) {
    return (
      <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        Todavía no hay partidos programados.
      </p>
    );
  }

  const enVivo = lista.filter((e) => e.estado === "en_vivo");
  const grupos = [...new Set(lista.filter((e) => e.fase === "grupos").map((e) => e.grupo ?? ""))].sort();
  const fasesElim = ORDEN_FASES.filter(
    (f) => f !== "grupos" && lista.some((e) => e.fase === f),
  );
  const final = lista.find((e) => e.fase === "final");
  const tercero = lista.find((e) => e.fase === "tercer_puesto");
  const pendientes = lista.filter((e) => e.estado === "programado" && e.equipo_a_id && e.equipo_b_id);
  const proximos = pendientes.filter((e) => e.programado_at);
  const porProgramar = pendientes.filter((e) => !e.programado_at);
  const resultados = lista
    .filter((e) => e.estado === "finalizado" || e.estado === "wo")
    .reverse();

  return (
    <div className="flex flex-col gap-6">
      {categorias.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoriaId(c.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                categoriaId === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {final && final.estado === "finalizado" && (
        <Podio final={final} tercero={tercero} nombre={nombre} />
      )}

      {enVivo.length > 0 && (
        <section>
          <Titulo>
            <span className="relative mr-1 inline-flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            En vivo
          </Titulo>
          <div className="grid gap-3 sm:grid-cols-2">
            {enVivo.map((e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} destacada onEditar={onEditar} canchas={nombresCanchas} />
            ))}
          </div>
        </section>
      )}

      {grupos.length > 0 && (
        <section>
          <Titulo>Posiciones</Titulo>
          <div className="grid gap-3 lg:grid-cols-2">
            {grupos.map((g) => {
              const delGrupo = lista.filter((e) => e.fase === "grupos" && e.grupo === g);
              const ids = [
                ...new Set(delGrupo.flatMap((e) => [e.equipo_a_id, e.equipo_b_id]).filter(Boolean)),
              ] as string[];
              const filas = calcularTabla(ids, delGrupo, tablaReglas);
              return (
                <div key={g} className="border-border overflow-hidden rounded-xl border">
                  <p className="bg-muted/50 px-3 py-1.5 text-xs font-semibold sm:text-sm">Grupo {g}</p>
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">#</th>
                        <th className="w-full px-1 py-1 text-left font-medium">Equipo</th>
                        <th className="px-1.5 py-1 font-medium" title="Partidos jugados">PJ</th>
                        <th className="px-1.5 py-1 font-medium" title="Partidos ganados">PG</th>
                        <th className="hidden px-1.5 py-1 font-medium sm:table-cell" title="Partidos perdidos">PP</th>
                        <th className="px-1.5 py-1 font-medium" title="Sets a favor - en contra">Sets</th>
                        <th className="hidden px-1.5 py-1 font-medium sm:table-cell" title="Puntos a favor - en contra">Ptos</th>
                        <th className="px-2 py-1 font-medium" title="Puntos en la tabla">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr
                          key={f.equipoId}
                          className={cn("border-border border-t", i < clasifican && "bg-emerald-500/5")}
                        >
                          <td className="px-2 py-1.5">
                            <span className={cn(i < clasifican && "font-bold text-emerald-500")}>{i + 1}</span>
                          </td>
                          <td className="px-1 py-1.5 font-medium leading-tight break-words">{nombre(f.equipoId)}</td>
                          <td className="px-1.5 py-1.5 text-center tabular-nums">{f.pj}</td>
                          <td className="px-1.5 py-1.5 text-center tabular-nums">{f.pg}</td>
                          <td className="hidden px-1.5 py-1.5 text-center tabular-nums sm:table-cell">{f.pp}</td>
                          <td className="px-1.5 py-1.5 text-center whitespace-nowrap tabular-nums">
                            {f.setsFavor}-{f.setsContra}
                          </td>
                          <td className="hidden px-1.5 py-1.5 text-center whitespace-nowrap tabular-nums sm:table-cell">
                            {f.puntosFavor}-{f.puntosContra}
                          </td>
                          <td className="px-2 py-1.5 text-center font-bold">{f.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            En verde, los que van clasificando a eliminatorias ({clasifican} por grupo). Desempate:
            partidos ganados, cociente de sets y cociente de puntos.
          </p>
        </section>
      )}

      {resultados.length > 0 && (
        <Desplegable titulo="Resultados" cuenta={resultados.length}>
          <PartidosPorFecha
            partidos={resultados}
            orden="desc"
            render={(e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} canchas={nombresCanchas} />
            )}
          />
        </Desplegable>
      )}

      {proximos.length > 0 && (
        <section>
          <Titulo>Próximos partidos</Titulo>
          <PartidosPorFecha
            partidos={proximos}
            orden="asc"
            render={(e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} canchas={nombresCanchas} />
            )}
          />
        </section>
      )}

      {porProgramar.length > 0 && (
        <section>
          <Titulo>Por programar ({porProgramar.length})</Titulo>
          <div className="grid gap-3 sm:grid-cols-2">
            {porProgramar.map((e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} canchas={nombresCanchas} />
            ))}
          </div>
        </section>
      )}

      {fasesElim.length > 0 && (
        <section>
          <Titulo>Eliminatorias</Titulo>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {fasesElim.map((f) => (
              <div key={f} className="flex w-60 shrink-0 flex-col gap-2">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  {labelFase(f)}
                </p>
                {lista
                  .filter((e) => e.fase === f)
                  .map((e) => (
                    <TarjetaPartido
                      key={e.id}
                      e={e}
                      nombre={nombre}
                      onEditar={onEditar}
                      canchas={nombresCanchas}
                      primeraFase={fasesElim[0] ?? null}
                    />
                  ))}
              </div>
            ))}
          </div>
          {lista.some((e) => e.fase !== "grupos" && (!e.equipo_a_id || !e.equipo_b_id) && e.estado !== "wo") && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <span className="border-muted-foreground/40 inline-flex size-4 items-center justify-center rounded-full border border-dashed text-[10px] font-bold">
                ?
              </span>
              Lugar por definir: se llena solo cuando termina el grupo o el partido del que sale.
            </p>
          )}
        </section>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Partidos agrupados por semana y día
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" → Date al mediodía UTC (para formatear sin correr de día). */
const diaUTC = (fecha: string) => new Date(`${fecha}T12:00:00Z`);

/** Lunes de la semana de una fecha "YYYY-MM-DD". */
function lunesDe(fecha: string): string {
  const d = diaUTC(fecha);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Lista de partidos por semana (plegable) y, dentro, por día. Abierta solo la
 * semana más cercana. Los partidos sin fecha van al final, plegados.
 * Agrupa con las fechas de los partidos: no depende de la hora actual, así el
 * servidor y el navegador muestran lo mismo ("Hoy"/"Mañana" se añade al hidratar).
 */
function PartidosPorFecha({
  partidos,
  orden,
  render,
}: {
  partidos: EncuentroPublico[];
  orden: "asc" | "desc";
  render: (e: EncuentroPublico) => React.ReactNode;
}) {
  const ahora = useAhora();
  const signo = orden === "asc" ? 1 : -1;
  const conFecha = partidos
    .filter((e) => e.programado_at)
    .sort((x, y) => signo * (Date.parse(x.programado_at!) - Date.parse(y.programado_at!)) || x.orden - y.orden);
  const sinFecha = partidos.filter((e) => !e.programado_at);

  const semanas: { lunes: string; dias: { fecha: string; partidos: EncuentroPublico[] }[] }[] = [];
  for (const e of conFecha) {
    const fecha = fechaColombia(e.programado_at!);
    const lunes = lunesDe(fecha);
    let semana = semanas.find((s) => s.lunes === lunes);
    if (!semana) semanas.push((semana = { lunes, dias: [] }));
    let dia = semana.dias.find((d) => d.fecha === fecha);
    if (!dia) semana.dias.push((dia = { fecha, partidos: [] }));
    dia.partidos.push(e);
  }

  const hoy = ahora ? fechaColombia(new Date(ahora)) : null;
  const relativo = (fecha: string) => {
    if (!hoy) return null;
    const dias = Math.round((diaUTC(fecha).getTime() - diaUTC(hoy).getTime()) / 86_400_000);
    return dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : dias === -1 ? "Ayer" : null;
  };
  const tituloSemana = (lunes: string) => {
    const domingo = diaUTC(lunes);
    domingo.setUTCDate(domingo.getUTCDate() + 6);
    const esta = hoy && lunesDe(hoy) === lunes ? "Esta semana · " : "";
    return `${esta}${formatDiaCO(lunes, { corto: true })} – ${formatDiaCO(domingo.toISOString(), { corto: true })}`;
  };
  const cuantos = (n: number) => `${n} ${n === 1 ? "partido" : "partidos"}`;

  return (
    <div className="flex flex-col gap-2">
      {semanas.map((s, i) => (
        <details key={s.lunes} open={i === 0} className="group border-border rounded-xl border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span>{tituloSemana(s.lunes)}</span>
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
              {cuantos(s.dias.reduce((n, d) => n + d.partidos.length, 0))}
              <span className="transition-transform group-open:rotate-180">▾</span>
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {s.dias.map((d) => {
              const rel = relativo(d.fecha);
              return (
                <div key={d.fecha}>
                  <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
                    {formatDiaCO(d.fecha)}
                    {rel && <span className="text-primary"> · {rel}</span>}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{d.partidos.map(render)}</div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
      {sinFecha.length > 0 && (
        <details open={semanas.length === 0} className="group border-border rounded-xl border border-dashed">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span>Por programar</span>
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
              {cuantos(sinFecha.length)}
              <span className="transition-transform group-open:rotate-180">▾</span>
            </span>
          </summary>
          <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">{sinFecha.map(render)}</div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cuenta regresiva de los partidos programados ("Hoy · en 3 h", "En 25 min")
// ---------------------------------------------------------------------------
// Un solo reloj para todas las tarjetas. En el servidor no hay hora (null): la
// etiqueta aparece al hidratar, así el HTML del servidor y el del navegador
// coinciden.
let ahoraActual = 0;
const oyentes = new Set<() => void>();
let reloj: ReturnType<typeof setInterval> | undefined;

function suscribirReloj(avisar: () => void) {
  oyentes.add(avisar);
  if (!reloj) {
    ahoraActual = Date.now();
    reloj = setInterval(() => {
      ahoraActual = Date.now();
      oyentes.forEach((f) => f());
    }, 30_000);
  }
  return () => {
    oyentes.delete(avisar);
    if (oyentes.size === 0) {
      clearInterval(reloj);
      reloj = undefined;
    }
  };
}

function useAhora(): number | null {
  return useSyncExternalStore(
    suscribirReloj,
    () => ahoraActual || null,
    () => null,
  );
}

/** Texto y tono de la etiqueta según cuánto falta (días contados en hora de Colombia). */
export function textoCuentaRegresiva(
  iso: string,
  ahora: number,
): { texto: string; tono: "urgente" | "hoy" | "manana" | "normal" | "pasado" } {
  const inicio = new Date(iso).getTime();
  const min = Math.ceil((inicio - ahora) / 60_000);
  if (min <= 0) return { texto: "Por jugar", tono: "pasado" };
  if (min < 60) return { texto: `En ${min} min`, tono: "urgente" };
  const dias = Math.round(
    (Date.parse(`${fechaColombia(iso)}T00:00:00Z`) - Date.parse(`${fechaColombia(new Date(ahora))}T00:00:00Z`)) /
      86_400_000,
  );
  if (dias === 0) return { texto: `Hoy · en ${Math.floor(min / 60)} h`, tono: "hoy" };
  if (dias === 1) return { texto: "Mañana", tono: "manana" };
  return { texto: `En ${dias} días`, tono: "normal" };
}

const TONOS = {
  urgente: "bg-red-500/15 text-red-500",
  hoy: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  manana: "bg-primary/10 text-primary",
  normal: "bg-muted text-muted-foreground",
  pasado: "bg-muted text-muted-foreground italic",
} as const;

function CuentaRegresiva({ iso }: { iso: string }) {
  const ahora = useAhora();
  if (ahora === null) return null;
  const { texto, tono } = textoCuentaRegresiva(iso, ahora);
  return (
    <span
      className={cn(
        "mr-1.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold",
        TONOS[tono],
      )}
    >
      {tono === "urgente" && <span className="mr-1 size-1.5 animate-pulse rounded-full bg-red-500" />}
      {texto}
    </span>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 flex items-center text-sm font-semibold">{children}</p>;
}

function TarjetaPartido({
  e,
  nombre,
  destacada = false,
  onEditar,
  canchas = [],
  primeraFase = null,
}: {
  e: EncuentroPublico;
  nombre: (id: string | null) => string;
  destacada?: boolean;
  onEditar?: (e: EncuentroPublico) => void;
  canchas?: string[];
  /** Primera ronda de la llave: sus lugares vacíos no vienen de otro partido. */
  primeraFase?: FaseEncuentro | null;
}) {
  const directo = e.estado === "wo" && (!e.equipo_a_id || !e.equipo_b_id);
  const definido = !!e.equipo_a_id && !!e.equipo_b_id;
  // En el panel, un cruce sin equipos se abre igual: para ponerle fecha y hora.
  const editable = !!onEditar && (definido || e.fase !== "grupos");
  const r = resultadoPartido(e);
  const vivo = e.estado === "en_vivo";
  const etiqueta = e.fase === "grupos" ? `Grupo ${e.grupo}` : labelFase(e.fase as FaseEncuentro);
  const fila = (lado: "a" | "b") => {
    const id = lado === "a" ? e.equipo_a_id : e.equipo_b_id;
    const gano = r.ganador === lado;
    const lugar = etiquetaLugar(e, lado, primeraFase);
    const origen = lado === "a" ? e.origen_a : e.origen_b;
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-sm leading-tight break-words",
            gano && "font-bold",
            !id && "text-muted-foreground italic",
          )}
        >
          {!id && !directo && lugar && (
            <span
              aria-hidden
              className="border-muted-foreground/40 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed text-[11px] font-bold not-italic"
            >
              ?
            </span>
          )}
          <span className="min-w-0">
            {!id && directo ? "Pasa directo" : id ? nombre(id) : (lugar ?? "Por definir")}
            {id && origen && (
              <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                ({lugar})
              </span>
            )}
          </span>
          {e.estado === "wo" && !directo && gano && (
            <span className="text-muted-foreground ml-1 text-[10px] font-normal">(W.O.: el rival no se presentó)</span>
          )}
        </span>
        <span className="flex shrink-0 gap-1 font-mono text-sm tabular-nums">
          {e.sets.map((s, i) => {
            const enCurso = vivo && i === e.sets.length - 1;
            const propio = lado === "a" ? s[0] : s[1];
            const rival = lado === "a" ? s[1] : s[0];
            return (
              <span
                key={i}
                className={cn(
                  "w-6 rounded text-center",
                  enCurso ? "bg-red-500/15 font-bold text-red-500" : propio > rival ? "font-bold" : "text-muted-foreground",
                )}
              >
                {propio}
              </span>
            );
          })}
        </span>
      </div>
    );
  };

  const Contenedor = editable ? "button" : "div";
  return (
    <Contenedor
      type={editable ? "button" : undefined}
      onClick={editable ? () => onEditar?.(e) : undefined}
      className={cn(
        "block w-full rounded-xl border p-3 text-left",
        destacada ? "border-red-500/40 bg-red-500/5" : "border-border",
        editable && "hover:border-primary/60 transition-colors",
      )}
    >
      <div className="text-muted-foreground mb-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span>{etiqueta}</span>
        {vivo ? (
          <span className="inline-flex items-center gap-1 font-semibold text-red-500">
            <Radio className="size-3" /> Set {e.sets.length}
          </span>
        ) : (
          <span>
            {e.estado === "programado" && e.programado_at && <CuentaRegresiva iso={e.programado_at} />}
            {e.programado_at ? formatFechaHoraCO(e.programado_at) : "Por programar"}
            {e.cancha ? ` · ${nombreCancha(e.cancha, canchas)}` : ""}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {fila("a")}
        {fila("b")}
      </div>
      {editable && (
        <p className="text-primary mt-1.5 text-[11px] font-medium">
          {!definido && e.estado === "programado"
            ? "Programar fecha"
            : e.estado === "programado"
            ? "Cargar resultado"
            : e.estado === "en_vivo"
              ? "Editar resultado"
              : "Ver resultado"}
        </p>
      )}
    </Contenedor>
  );
}

function Podio({
  final,
  tercero,
  nombre,
}: {
  final: EncuentroPublico;
  tercero?: EncuentroPublico;
  nombre: (id: string | null) => string;
}) {
  const campeon = final.ganador_id;
  const sub = campeon === final.equipo_a_id ? final.equipo_b_id : final.equipo_a_id;
  const bronce =
    tercero?.estado === "finalizado" ? tercero.ganador_id : null;
  const puestos = [
    { id: campeon, label: "Campeón", clase: "text-amber-400" },
    { id: sub, label: "Subcampeón", clase: "text-slate-300" },
    { id: bronce, label: "Tercer puesto", clase: "text-orange-400" },
  ];
  return (
    <section className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
      <Titulo>Podio</Titulo>
      <div className="grid grid-cols-3 gap-2 text-center">
        {puestos.map((p) => (
          <div key={p.label} className="rounded-xl bg-white/[0.03] p-3">
            <Medal className={cn("mx-auto size-6", p.clase)} />
            <p className="mt-1 truncate text-sm font-bold">{nombre(p.id)}</p>
            <p className="text-muted-foreground text-[11px]">{p.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
