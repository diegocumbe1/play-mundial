"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Medal, Radio } from "lucide-react";

import {
  calcularTabla,
  labelFase,
  ORDEN_FASES,
  resultadoPartido,
} from "@/lib/torneo-fixture";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import { cn } from "@/lib/utils";
import type { EncuentroPublico, FaseEncuentro } from "@/types";

const HORA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

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
  autoRefrescar = false,
  onEditar,
}: {
  categorias: { id: string; nombre: string }[];
  equipos: { id: string; nombre: string }[];
  encuentros: EncuentroPublico[];
  tablaReglas: ReglasTorneo["tabla"];
  autoRefrescar?: boolean;
  /** Solo en el panel: tocar un partido abre la carga de resultado. */
  onEditar?: (e: EncuentroPublico) => void;
}) {
  const router = useRouter();
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? null);
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
  const proximos = lista.filter((e) => e.estado === "programado" && e.equipo_a_id && e.equipo_b_id);
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
              <TarjetaPartido key={e.id} e={e} nombre={nombre} destacada onEditar={onEditar} />
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
                    <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} />
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {grupos.length > 0 && (
        <section>
          <Titulo>Posiciones</Titulo>
          <div className="grid gap-3 sm:grid-cols-2">
            {grupos.map((g) => {
              const delGrupo = lista.filter((e) => e.fase === "grupos" && e.grupo === g);
              const ids = [
                ...new Set(delGrupo.flatMap((e) => [e.equipo_a_id, e.equipo_b_id]).filter(Boolean)),
              ] as string[];
              const filas = calcularTabla(ids, delGrupo, tablaReglas);
              return (
                <div key={g} className="border-border overflow-hidden rounded-xl border">
                  <p className="bg-muted/50 px-3 py-1.5 text-xs font-semibold">Grupo {g}</p>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">#</th>
                        <th className="px-1 py-1 text-left font-medium">Equipo</th>
                        <th className="px-1 py-1 font-medium" title="Partidos jugados">PJ</th>
                        <th className="px-1 py-1 font-medium" title="Partidos ganados">PG</th>
                        <th className="px-1 py-1 font-medium" title="Sets a favor - en contra">Sets</th>
                        <th className="px-2 py-1 font-medium" title="Puntos en la tabla">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr
                          key={f.equipoId}
                          className={cn("border-border border-t", i < 2 && "bg-emerald-500/5")}
                        >
                          <td className="px-2 py-1.5">
                            <span className={cn(i < 2 && "font-bold text-emerald-500")}>{i + 1}</span>
                          </td>
                          <td className="max-w-0 truncate px-1 py-1.5 font-medium">{nombre(f.equipoId)}</td>
                          <td className="px-1 py-1.5 text-center">{f.pj}</td>
                          <td className="px-1 py-1.5 text-center">{f.pg}</td>
                          <td className="px-1 py-1.5 text-center">
                            {f.setsFavor}-{f.setsContra}
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
            En verde, los que van clasificando a eliminatorias (dos por grupo).
          </p>
        </section>
      )}

      {proximos.length > 0 && (
        <section>
          <Titulo>Próximos partidos</Titulo>
          <div className="grid gap-2 sm:grid-cols-2">
            {proximos.slice(0, onEditar ? undefined : 8).map((e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} />
            ))}
          </div>
        </section>
      )}

      {resultados.length > 0 && (
        <section>
          <Titulo>Resultados</Titulo>
          <div className="grid gap-2 sm:grid-cols-2">
            {resultados.slice(0, onEditar ? undefined : 12).map((e) => (
              <TarjetaPartido key={e.id} e={e} nombre={nombre} onEditar={onEditar} />
            ))}
          </div>
        </section>
      )}
    </div>
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
}: {
  e: EncuentroPublico;
  nombre: (id: string | null) => string;
  destacada?: boolean;
  onEditar?: (e: EncuentroPublico) => void;
}) {
  const directo = e.estado === "wo" && (!e.equipo_a_id || !e.equipo_b_id);
  const editable = !!onEditar && !!e.equipo_a_id && !!e.equipo_b_id;
  const r = resultadoPartido(e);
  const vivo = e.estado === "en_vivo";
  const etiqueta = e.fase === "grupos" ? `Grupo ${e.grupo}` : labelFase(e.fase as FaseEncuentro);
  const fila = (lado: "a" | "b") => {
    const id = lado === "a" ? e.equipo_a_id : e.equipo_b_id;
    const gano = r.ganador === lado;
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            gano && "font-bold",
            !id && "text-muted-foreground italic",
          )}
        >
          {!id && directo ? "Pasa directo" : nombre(id)}
          {e.estado === "wo" && !directo && gano && (
            <span className="text-muted-foreground ml-1 text-[10px] font-normal">(gana por W.O.)</span>
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
            {e.programado_at ? HORA.format(new Date(e.programado_at)) : "Por programar"}
            {e.cancha ? ` · Cancha ${e.cancha}` : ""}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {fila("a")}
        {fila("b")}
      </div>
      {editable && (
        <p className="text-primary mt-1.5 text-[11px] font-medium">
          {e.estado === "programado" ? "Cargar resultado" : "Editar resultado"}
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
