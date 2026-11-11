"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { programarDia } from "@/actions/torneos";
import { Campo } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFechaHoraCO } from "@/lib/fecha-co";
import { fechaColombia } from "@/lib/torneo-fixture";
import { choquePartido, type RestriccionesEquipo } from "@/lib/torneo-restricciones";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
import type { Encuentro, EquipoTorneo, Torneo } from "@/types";

type Turno = { key: number; hora: string; cancha: string; a: string; b: string };

const horaColombia = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(11, 16);

function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = (h * 60 + m + min) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * «Armar el día»: el organizador elige un día y, turno por turno (hora y
 * cancha), qué partido se juega. Sirve para reprogramar a mano, como la
 * programación oficial que se publica antes de cada jornada. Los partidos son
 * los del fixture; aquí solo se decide cuándo se juega cada uno.
 */
export function ArmarDia({
  torneo,
  equipos,
  encuentros,
  calendario,
  nombresCanchas,
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  encuentros: Encuentro[];
  calendario: ReglasTorneo["calendario"];
  nombresCanchas: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [siguiente, setSiguiente] = useState(1);

  const canchas = Math.max(1, torneo.cantidad_canchas);
  const duracion = torneo.duracion_partido_minutos ?? 45;
  const nombreCancha = (n: number) => nombresCanchas[n - 1]?.trim() || `Cancha ${n}`;
  const nombre = (id: string | null) => equipos.find((e) => e.id === id)?.nombre ?? "Por definir";
  const restricciones = new Map<string, RestriccionesEquipo | undefined>(
    equipos.map((e) => [e.id, e.restricciones_horario as RestriccionesEquipo | undefined]),
  );

  // Partidos que se pueden poner en un turno: no jugados y con los dos equipos definidos.
  const asignables = encuentros
    .filter((e) => e.estado === "programado" && e.equipo_a_id && e.equipo_b_id)
    .sort(
      (x, y) =>
        (x.programado_at ? 1 : 0) - (y.programado_at ? 1 : 0) ||
        (x.grupo ?? "").localeCompare(y.grupo ?? "") ||
        x.ronda - y.ronda ||
        x.orden - y.orden,
    );
  const porId = new Map(encuentros.map((e) => [e.id, e]));
  const etiqueta = (e: Encuentro) =>
    `${e.grupo ? `Grupo ${e.grupo} · ` : ""}${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`;

  // Ya jugados o en vivo ese día: ocupan su turno y no se editan.
  const fijos = fecha
    ? encuentros
        .filter((e) => e.estado !== "programado" && e.programado_at && fechaColombia(e.programado_at) === fecha)
        .sort((x, y) => x.programado_at!.localeCompare(y.programado_at!))
    : [];

  function armarTurnos(f: string): Turno[] {
    const deEseDia = encuentros
      .filter((e) => e.estado === "programado" && e.programado_at && e.equipo_a_id && e.equipo_b_id && fechaColombia(e.programado_at) === f)
      .sort((x, y) => x.programado_at!.localeCompare(y.programado_at!) || (x.cancha ?? 1) - (y.cancha ?? 1));
    if (deEseDia.length > 0) {
      return deEseDia.map((e, i) => ({
        key: i + 1,
        hora: horaColombia(e.programado_at!),
        cancha: String(e.cancha ?? 1),
        a: e.equipo_a_id!,
        b: e.equipo_b_id!,
      }));
    }
    // Día vacío: turnos listos según el calendario del torneo, sin partido elegido.
    return Array.from({ length: Math.max(1, calendario.partidos_por_dia) }, (_, k) => ({
      key: k + 1,
      hora: sumarMinutos(calendario.hora_inicio, Math.floor(k / canchas) * duracion),
      cancha: String((k % canchas) + 1),
      a: "",
      b: "",
    }));
  }

  function elegirFecha(f: string) {
    setFecha(f);
    const t = f ? armarTurnos(f) : [];
    setTurnos(t);
    setSiguiente(t.length + 1);
  }

  function abrir() {
    // Primer día con partidos por jugar (o hoy si no hay).
    const hoy = fechaColombia(new Date());
    const dias = encuentros
      .filter((e) => e.estado === "programado" && e.programado_at)
      .map((e) => fechaColombia(e.programado_at!))
      .sort();
    elegirFecha(dias.find((d) => d >= hoy) ?? hoy);
    setAbierto(true);
  }

  const cambiar = (key: number, parche: Partial<Turno>) =>
    setTurnos((prev) => prev.map((t) => (t.key === key ? { ...t, ...parche } : t)));

  function agregarTurno() {
    const ultimo = turnos[turnos.length - 1];
    setTurnos([
      ...turnos,
      {
        key: siguiente,
        hora: ultimo ? sumarMinutos(ultimo.hora, duracion) : calendario.hora_inicio,
        cancha: ultimo?.cancha ?? "1",
        a: "",
        b: "",
      },
    ]);
    setSiguiente(siguiente + 1);
  }

  const llenos = turnos.filter((t) => t.a && t.b && t.a !== t.b);
  const equiposDelDia = new Map<string, number>();
  for (const e of fijos) {
    for (const id of [e.equipo_a_id, e.equipo_b_id]) if (id) equiposDelDia.set(id, (equiposDelDia.get(id) ?? 0) + 1);
  }
  for (const t of llenos) for (const id of [t.a, t.b]) equiposDelDia.set(id, (equiposDelDia.get(id) ?? 0) + 1);
  const turnosRepetidos = new Set<string>();
  const vistos = new Set<string>();
  for (const t of turnos) {
    const k = `${t.hora}|${t.cancha}`;
    if (vistos.has(k)) turnosRepetidos.add(k);
    vistos.add(k);
  }

  /** Partido del fixture (sin jugar) con ese cruce, para mostrar su grupo. */
  const cruce = (t: Turno) =>
    encuentros.find(
      (e) =>
        e.estado === "programado" &&
        ((e.equipo_a_id === t.a && e.equipo_b_id === t.b) || (e.equipo_a_id === t.b && e.equipo_b_id === t.a)),
    );

  function avisoDe(t: Turno): string | null {
    if (turnosRepetidos.has(`${t.hora}|${t.cancha}`)) return "Dos partidos a la misma hora y cancha.";
    if (!t.a || !t.b || !t.hora || !fecha) return null;
    if (t.a === t.b) return "Elige dos equipos distintos.";
    const ids = [t.a, t.b];
    const choque = choquePartido(
      new Date(`${fecha}T${t.hora}:00-05:00`),
      ids.map((id) => ({ nombre: nombre(id), restricciones: restricciones.get(id) })),
    );
    if (choque) return choque;
    const repetidos = ids.filter((id) => (equiposDelDia.get(id) ?? 0) > 1).map(nombre);
    return repetidos.length > 0 ? `${repetidos.join(" y ")} juega(n) más de una vez este día.` : null;
  }

  // Partidos que estaban ese día y se están quitando.
  const quitados = fecha
    ? encuentros.filter(
        (e) =>
          e.estado === "programado" &&
          e.programado_at &&
          fechaColombia(e.programado_at) === fecha &&
          !llenos.some(
            (t) =>
              (e.equipo_a_id === t.a && e.equipo_b_id === t.b) || (e.equipo_a_id === t.b && e.equipo_b_id === t.a),
          ),
      ).length
    : 0;

  function guardar() {
    startTransition(async () => {
      const r = await programarDia(torneo.id, {
        fecha,
        turnos: llenos.map((t) => ({ hora: t.hora, cancha: Number(t.cancha) || 1, equipoAId: t.a, equipoBId: t.b })),
      });
      if (!r.success) return void toast.error(r.error);
      const base = `Día guardado: ${r.data.programados} partido(s)` + (r.data.creados ? ` · ${r.data.creados} cruce(s) nuevo(s)` : "") + (r.data.liberados ? ` · ${r.data.liberados} quedaron por programar` : "");
      if (r.data.avisos.length > 0) toast.warning(`${base}. Ojo: ${r.data.avisos.join(". ")}.`);
      else toast.success(base);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div>
        <Button size="sm" variant="outline" onClick={abrir} disabled={encuentros.length === 0}>
          <CalendarDays className="size-3.5" /> Armar el día (elegir quién juega a cada hora)
        </Button>
      </div>
    );
  }

  const opcionesEquipos = [...equipos]
    .filter((e) => e.estado === "confirmado" || e.estado === "pendiente")
    .sort((x, y) => x.nombre.localeCompare(y.nombre))
    .map((e) => (
      <option key={e.id} value={e.id}>
        {e.nombre}
      </option>
    ));
  const selectCls = "border-input bg-background h-9 min-w-0 rounded-md border px-2 text-sm";

  return (
    <section className="border-border flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Armar el día</p>
        <Button size="sm" variant="ghost" onClick={() => setAbierto(false)} disabled={pending}>
          Cerrar
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Elige el día y, para cada hora, los dos equipos que juegan (cualquiera contra cualquiera, o «Del fixture» para traer un cruce ya creado).
        Lo que ya estaba programado ese día aparece listo para cambiarlo; si quitas un partido, queda
        «Por programar». Los partidos jugados o en vivo no se tocan.
      </p>

      <Campo label="Día">
        <Input type="date" value={fecha} onChange={(e) => elegirFecha(e.target.value)} className="max-w-48" />
      </Campo>

      {fijos.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
          {fijos.map((e) => (
            <li key={e.id}>
              🔒 {formatFechaHoraCO(e.programado_at!)} · {etiqueta(e)} ({e.estado === "en_vivo" ? "en vivo" : "jugado"})
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        {turnos.map((t) => {
          const aviso = avisoDe(t);
          return (
            <div key={t.key} className="bg-muted/40 flex flex-col gap-1.5 rounded-xl p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="time"
                  value={t.hora}
                  onChange={(e) => cambiar(t.key, { hora: e.target.value })}
                  aria-label="Hora"
                  className="w-28"
                />
                {canchas > 1 && (
                  <select
                    value={t.cancha}
                    onChange={(e) => cambiar(t.key, { cancha: e.target.value })}
                    className={selectCls}
                    aria-label="Cancha"
                  >
                    {Array.from({ length: canchas }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {nombreCancha(i + 1)}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={t.a}
                  onChange={(e) => cambiar(t.key, { a: e.target.value })}
                  className={`${selectCls} flex-1 basis-40`}
                  aria-label="Equipo A"
                >
                  <option value="">Equipo A…</option>
                  {opcionesEquipos}
                </select>
                <span className="text-muted-foreground text-xs font-semibold">VS</span>
                <select
                  value={t.b}
                  onChange={(e) => cambiar(t.key, { b: e.target.value })}
                  className={`${selectCls} flex-1 basis-40`}
                  aria-label="Equipo B"
                >
                  <option value="">Equipo B…</option>
                  {opcionesEquipos}
                </select>
                <select
                  value=""
                  onChange={(e) => {
                    const m = porId.get(e.target.value);
                    if (m) cambiar(t.key, { a: m.equipo_a_id!, b: m.equipo_b_id! });
                  }}
                  className={`${selectCls} w-36`}
                  aria-label="Cargar cruce del fixture"
                >
                  <option value="">Del fixture…</option>
                  {asignables.map((e) => (
                    <option key={e.id} value={e.id}>
                      {etiqueta(e)}
                    </option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Quitar turno"
                  onClick={() => setTurnos((prev) => prev.filter((x) => x.key !== t.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {t.a && t.b && t.a !== t.b && (
                <p className="text-muted-foreground text-xs">
                  {cruce(t)
                    ? `Cruce del fixture${cruce(t)!.grupo ? ` · Grupo ${cruce(t)!.grupo}` : ""}`
                    : "Cruce nuevo: se crea como partido adicional (no está en el fixture)."}
                </p>
              )}
              {aviso && <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {aviso} Puedes guardarlo igual.</p>}
            </div>
          );
        })}
        {turnos.length === 0 && <p className="text-muted-foreground text-xs">Este día no tiene turnos. Agrega uno.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={agregarTurno} disabled={pending || !fecha}>
          <Plus className="size-3.5" /> Agregar turno
        </Button>
        <div className="flex items-center gap-2">
          {quitados > 0 && (
            <span className="text-muted-foreground text-xs">{quitados} partido(s) quedarán por programar</span>
          )}
          <Button size="sm" onClick={guardar} disabled={pending || !fecha || (llenos.length === 0 && quitados === 0)}>
            Guardar día
          </Button>
        </div>
      </div>
    </section>
  );
}
