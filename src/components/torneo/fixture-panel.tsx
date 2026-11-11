"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  Volume2,
  Copy,
  Download,
  GitFork,
  MessageCircle,
  Monitor,
  Pencil,
  Smartphone,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import {
  abrirMarcador,
  armarLlaveAnticipada,
  editarHorarioEncuentro,
  generarEliminatorias,
  programarPartidos,
  generarFixture,
  guardarResultado,
  intercambiarHorarios,
  marcarArbitrajePagado,
  probarVozPartido,
  traerMarcador,
  type OpcionesFixture,
} from "@/actions/torneos";
import { Campo, InfoToggle, Segmentado, Selector } from "@/components/torneo/campos";
import { FixtureVista } from "@/components/torneo/fixture-vista";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { formatFechaHoraCO } from "@/lib/fecha-co";
import { formatCOP } from "@/lib/torneos";
import {
  COLORES_MARCADOR,
  OPCIONES_MARCADOR_POR_DEFECTO,
  VOCES_MARCADOR,
  type OpcionesMarcador,
  type VozMarcador,
} from "@/lib/marcador-voz";
import {
  armarGrupos,
  categoriaInicial,
  etiquetaLugar,
  labelFase,
  todosContraTodos,
  validarSets,
} from "@/lib/torneo-fixture";
import { textoAlargue, type ReglasTorneo } from "@/lib/torneo-reglas";
import {
  choquePartido,
  leerRestricciones,
  resumenRestricciones,
  tieneRestricciones,
  type RestriccionesEquipo,
} from "@/lib/torneo-restricciones";
import type { CategoriaTorneo, Encuentro, EncuentroPublico, EquipoTorneo, Torneo } from "@/types";

type Modo = OpcionesFixture["modo"];

const MODO_POR_FORMATO: Record<Torneo["formato"], Modo> = {
  grupos_eliminacion: "grupos",
  todos_contra_todos: "liga",
  eliminacion_directa: "eliminacion",
  personalizado: "grupos",
};

/**
 * Fixture del organizador: generar partidos por categoría, pasar a
 * eliminatorias y cargar resultados (tocando cada partido). La tabla y la
 * llave se actualizan solas con cada resultado.
 */
export function FixturePanel({
  torneo,
  categorias,
  equipos,
  encuentros,
  reglas,
  marcadorDisponible = false,
  partidoInicial,
}: {
  torneo: Torneo;
  categorias: CategoriaTorneo[];
  equipos: EquipoTorneo[];
  encuentros: Encuentro[];
  reglas: ReglasTorneo;
  /** Si dc-sport-score está configurado: el juez puede marcar en vivo. */
  marcadorDisponible?: boolean;
  /** Partido que se abre al entrar (enlace de una notificación). */
  partidoInicial?: string;
}) {
  const [editando, setEditando] = useState<EncuentroPublico | null>(
    () => encuentros.find((e) => e.id === partidoInicial && e.equipo_a_id && e.equipo_b_id) ?? null,
  );
  function cerrarPartido() {
    setEditando(null);
    // Sin esto, recargar la página volvería a abrir el partido de la notificación.
    if (partidoInicial) window.history.replaceState(null, "", window.location.pathname);
  }
  // Sin categorías, el torneo entero es una sola "categoría".
  const grupos: { id: string | null; nombre: string }[] =
    categorias.length > 0 ? categorias : [{ id: null, nombre: "Torneo" }];
  const nombre = (id: string | null) => equipos.find((e) => e.id === id)?.nombre ?? "Por definir";
  const restricciones = new Map<string, RestriccionesEquipo>(
    equipos.map((e) => [e.id, leerRestricciones(e.restricciones_horario)]),
  );
  // Partidos con fecha, aún sin jugar, que chocan con las restricciones de un equipo.
  const conflictos = encuentros.flatMap((e) => {
    if (e.estado !== "programado" || !e.programado_at || !e.equipo_a_id || !e.equipo_b_id) return [];
    const motivo = choquePartido(e.programado_at, [
      { nombre: nombre(e.equipo_a_id), restricciones: restricciones.get(e.equipo_a_id) },
      { nombre: nombre(e.equipo_b_id), restricciones: restricciones.get(e.equipo_b_id) },
    ]);
    return motivo ? [{ encuentro: e, motivo }] : [];
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {grupos.map((c) => (
          <ControlCategoria
            key={c.id ?? "torneo"}
            torneo={torneo}
            categoriaId={c.id}
            nombre={c.nombre}
            confirmados={
              equipos.filter(
                (e) => e.estado === "confirmado" && (c.id ? e.categoria_id === c.id : true),
              ).length
            }
            encuentros={encuentros.filter((e) => e.categoria_id === c.id)}
            clasificanPorDefecto={reglas.tabla.clasifican}
            calendario={reglas.calendario}
            conflictos={conflictos.filter((x) => x.encuentro.categoria_id === c.id)}
            nombreEquipo={nombre}
            onAbrirPartido={setEditando}
          />
        ))}
      </div>

      <FixtureVista
        categorias={categorias}
        equipos={equipos}
        encuentros={encuentros}
        tablaReglas={reglas.tabla}
        categoriaInicial={categoriaInicial(
          categorias,
          equipos.filter((e) => e.estado === "pendiente" || e.estado === "confirmado"),
          reglas.publico.categoria_inicial,
        )}
        nombresCanchas={reglas.juego.nombres_canchas}
        onEditar={setEditando}
      />

      <ResultadoModal
        // Siempre la versión más reciente: tras guardar horario o resultado se refresca.
        encuentro={editando ? (encuentros.find((e) => e.id === editando.id) ?? editando) : null}
        nombre={nombre}
        restricciones={restricciones}
        partidos={encuentros}
        juego={reglas.juego}
        marcadorDisponible={marcadorDisponible}
        canchas={torneo.cantidad_canchas}
        primeraFase={
          (["octavos", "cuartos", "semifinal", "final"] as const).find((f) =>
            encuentros.some((e) => e.fase === f),
          ) ?? null
        }
        onCerrar={cerrarPartido}
      />
    </div>
  );
}

function ControlCategoria({
  torneo,
  categoriaId,
  nombre,
  confirmados,
  encuentros,
  clasificanPorDefecto,
  calendario,
  conflictos,
  nombreEquipo,
  onAbrirPartido,
}: {
  torneo: Torneo;
  categoriaId: string | null;
  nombre: string;
  confirmados: number;
  encuentros: Encuentro[];
  /** Regla del torneo: cuántos pasan por grupo. */
  clasificanPorDefecto: number;
  calendario: ReglasTorneo["calendario"];
  /** Partidos programados que chocan con las restricciones de horario de un equipo. */
  conflictos: { encuentro: Encuentro; motivo: string }[];
  nombreEquipo: (id: string | null) => string;
  onAbrirPartido: (e: Encuentro) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rehacer, setRehacer] = useState(false);
  const [modo, setModo] = useState<Modo>(MODO_POR_FORMATO[torneo.formato]);
  const [porGrupo, setPorGrupo] = useState("4");
  const [fecha, setFecha] = useState(torneo.fecha_inicio ?? new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("17:00");
  const [dias, setDias] = useState("7");
  const [clasifican, setClasifican] = useState(String(clasificanPorDefecto));

  const deGrupos = encuentros.filter((e) => e.fase === "grupos");
  const hayLlave = encuentros.some((e) => e.fase !== "grupos");
  const jugados = encuentros.filter((e) => e.estado === "finalizado" || e.estado === "wo").length;
  const conResultados = encuentros.some(
    (e) => e.estado === "en_vivo" || (e.estado === "finalizado" && e.sets.length > 0),
  );
  const pendientesGrupos = deGrupos.filter((e) => e.estado !== "finalizado" && e.estado !== "wo").length;
  const mostrarFormulario = encuentros.length === 0 || rehacer;

  // Vista previa: cuántos grupos y partidos va a crear.
  const ficticios = Array.from({ length: confirmados }, (_, i) => i);
  const previa =
    modo === "eliminacion"
      ? `Llave de eliminación directa con ${confirmados} equipos.`
      : (() => {
          const gs = modo === "liga" ? [ficticios] : armarGrupos(ficticios, Number(porGrupo) || 4).map((g) => g.equipos);
          const partidos = gs.reduce((s, g) => s + todosContraTodos(g).flat().length, 0);
          return modo === "liga"
            ? `Todos contra todos: ${partidos} partidos.`
            : `${gs.length} grupos (${gs.map((g) => g.length).join(", ")} equipos) · ${partidos} partidos.`;
        })();

  function generar() {
    startTransition(async () => {
      const r = await generarFixture(torneo.id, categoriaId, {
        modo,
        por_grupo: Number(porGrupo) || 4,
        fecha_inicio: fecha,
        hora_inicio: hora,
        dias_entre_jornadas: Number(dias) || 0,
      });
      if (!r.success) return void toast.error(r.error);
      toast.success(`Fixture de ${nombre}: ${r.data.partidos} partidos`);
      setRehacer(false);
      router.refresh();
    });
  }

  const sinFecha = encuentros.filter(
    (e) => e.estado === "programado" && !e.programado_at && e.equipo_a_id && e.equipo_b_id,
  ).length;
  const conFechaSinJugar = encuentros.filter(
    (e) => e.estado === "programado" && e.programado_at && e.equipo_a_id && e.equipo_b_id,
  ).length;

  function llaveAnticipada() {
    startTransition(async () => {
      const r = await armarLlaveAnticipada(torneo.id, categoriaId);
      if (!r.success) return void toast.error(r.error);
      toast.success(`Llave de ${nombre} armada: ${r.data.partidos} partidos`);
      router.refresh();
    });
  }

  function eliminatorias() {
    startTransition(async () => {
      const r = await generarEliminatorias(torneo.id, categoriaId, Number(clasifican) || 2, fecha, hora);
      if (!r.success) return void toast.error(r.error);
      toast.success(`Eliminatorias de ${nombre} listas`);
      router.refresh();
    });
  }

  return (
    <section className="border-border rounded-2xl border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold">{nombre}</p>
        <span className="text-muted-foreground text-xs">
          {confirmados} confirmados
          {encuentros.length > 0 ? ` · ${jugados}/${encuentros.length} jugados` : ""}
        </span>
      </div>

      {mostrarFormulario ? (
        <div className="flex flex-col gap-3">
          <Campo label="Formato">
            <Segmentado
              value={modo}
              onChange={(v) => setModo(v as Modo)}
              options={[
                { value: "grupos", label: "Grupos + llave" },
                { value: "liga", label: "Liga" },
                { value: "eliminacion", label: "Eliminación" },
              ]}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            {modo === "grupos" && (
              <Campo label="Equipos por grupo">
                <Input inputMode="numeric" value={porGrupo} onChange={(e) => setPorGrupo(e.target.value.replace(/\D/g, ""))} />
              </Campo>
            )}
            {modo !== "eliminacion" && (
              <Campo label="Días entre jornadas">
                <Input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} />
              </Campo>
            )}
            <Campo label="Primer partido">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo label="Hora">
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Campo>
          </div>
          <p className="text-muted-foreground text-xs">
            {confirmados < 2 ? "Confirma al menos 2 equipos para generar el fixture." : previa}{" "}
            Se reparten en {torneo.cantidad_canchas} cancha(s), partidos de{" "}
            {torneo.duracion_partido_minutos ?? 45} min.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={generar} disabled={pending || confirmados < 2}>
              <CalendarPlus className="size-3.5" /> Generar fixture
            </Button>
            {rehacer && (
              <Button size="sm" variant="ghost" onClick={() => setRehacer(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {deGrupos.length > 0 && !hayLlave && (
            pendientesGrupos > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs">
                  Faltan {pendientesGrupos} partido(s) de grupos. Puedes armar la llave desde ya
                  (estilo Mundial): los cruces quedan a la vista («1° A vs {clasificanPorDefecto}° B»)
                  y cada lugar se llena solo cuando termina su grupo. Clasifican{" "}
                  {clasificanPorDefecto} por grupo (se cambia en Configuración).
                </p>
                <Button size="sm" variant="outline" className="self-start" onClick={llaveAnticipada} disabled={pending}>
                  <GitFork className="size-3.5" /> Armar llave ahora
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <Campo label="Clasifican">
                    <Input inputMode="numeric" value={clasifican} onChange={(e) => setClasifican(e.target.value.replace(/\D/g, ""))} />
                  </Campo>
                  <Campo label="Fecha">
                    <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                  </Campo>
                  <Campo label="Hora">
                    <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                  </Campo>
                </div>
                <Button size="sm" onClick={eliminatorias} disabled={pending}>
                  <Trophy className="size-3.5" /> Generar eliminatorias
                </Button>
              </div>
            )
          )}
          {hayLlave && (
            <p className="text-muted-foreground text-xs">
              Llave armada: los lugares «?» se llenan solos al terminar cada grupo y los ganadores
              avanzan solos al cargar cada resultado.
            </p>
          )}
          {conflictos.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold">
                {conflictos.length} partido(s) chocan con las restricciones de horario
              </p>
              <ul className="flex flex-col gap-1 text-xs">
                {conflictos.slice(0, 6).map(({ encuentro: e, motivo }) => (
                  <li key={e.id}>
                    <button type="button" className="text-left hover:underline" onClick={() => onAbrirPartido(e)}>
                      {formatFechaHoraCO(e.programado_at!)} · {nombreEquipo(e.equipo_a_id)} vs{" "}
                      {nombreEquipo(e.equipo_b_id)}: <b>{motivo}</b>
                    </button>
                  </li>
                ))}
                {conflictos.length > 6 && <li>y {conflictos.length - 6} más…</li>}
              </ul>
              <p className="text-muted-foreground text-xs">
                Toca uno para cambiarle la hora a mano, o usa «Reprogramar» para moverlos solos.
              </p>
            </div>
          )}
          <ProgramarPartidos
            torneoId={torneo.id}
            categoriaId={categoriaId}
            calendario={calendario}
            conflictos={conflictos.length}
            conFecha={conFechaSinJugar}
            sinFecha={sinFecha}
          />
          {!conResultados && (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => setRehacer(true)}>
              Rehacer fixture
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

type LecturaMarcador = Extract<Awaited<ReturnType<typeof traerMarcador>>, { success: true }>["data"];
type EnlacesMarcador = LecturaMarcador["enlaces"];

const setsEnTexto = (sets: [number, number][]) => sets.map(([x, y]) => `${x}-${y}`).join(", ");

const filasDeSets = (sets: [number, number][], total: number): [string, string][] =>
  Array.from({ length: total }, (_, i) => {
    const s = sets[i];
    return s ? [String(s[0]), String(s[1])] : ["", ""];
  });

/**
 * Carga del marcador por sets, con validación en vivo según las reglas. Si el
 * juez ya terminó, solo se ofrece aceptar su resultado o corregirlo. Un partido
 * finalizado se muestra como resumen: cambiarlo es una corrección que se confirma.
 */
function ResultadoModal({
  encuentro,
  nombre,
  restricciones,
  partidos,
  juego,
  marcadorDisponible,
  canchas,
  primeraFase,
  onCerrar,
}: {
  encuentro: EncuentroPublico | null;
  nombre: (id: string | null) => string;
  restricciones: Map<string, RestriccionesEquipo>;
  /** Todos los partidos del torneo (para intercambiar horario con otro). */
  partidos: Encuentro[];
  juego: ReglasTorneo["juego"];
  marcadorDisponible: boolean;
  canchas: number;
  primeraFase: Encuentro["fase"] | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sets, setSets] = useState<[string, string][]>([]);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<EnlacesMarcador | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Resultado que el juez dio por terminado, pendiente de aceptar o corregir. */
  const [propuesta, setPropuesta] = useState<LecturaMarcador | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  /** Antes de abrir el marcador: colores y voz elegidos (null = panel cerrado). */
  const [opcionesVoz, setOpcionesVoz] = useState<OpcionesMarcador | null>(null);
  /** Cambio que afecta un resultado ya guardado, a la espera de confirmación. */
  const [confirmar, setConfirmar] = useState<{
    texto: string;
    input: Parameters<typeof guardarResultado>[1];
    ok: string;
  } | null>(null);

  // Partido en vivo con sala: al abrirlo se lee solo lo que lleva el juez.
  const leerAlAbrir =
    marcadorDisponible && encuentro?.estado === "en_vivo" && encuentro.sala_marcador
      ? encuentro.id
      : null;

  if (encuentro && encuentro.id !== ultimoId) {
    setUltimoId(encuentro.id);
    setEnlaces(null);
    setAviso(null);
    setOpcionesVoz(null);
    setPropuesta(null);
    setCorrigiendo(false);
    setConfirmar(null);
    setLeyendo(!!leerAlAbrir);
    setSets(filasDeSets(encuentro.sets, juego.sets));
  } else if (!encuentro && ultimoId) {
    // Al cerrar se olvida todo: al reabrirlo debe reflejar lo último guardado.
    setUltimoId(null);
  }

  const aplicarLectura = useCallback(
    (d: LecturaMarcador) => {
      setEnlaces(d.enlaces);
      setCorrigiendo(false);
      // Sala aún sin puntos: se conserva lo que ya estuviera guardado.
      if (d.sets.length > 0) setSets(filasDeSets(d.sets, juego.sets));
      setPropuesta(d.terminado ? d : null);
      setAviso(d.terminado ? null : "Partido en curso. Puedes guardar el parcial con “Guardar en vivo”.");
    },
    [juego.sets],
  );

  useEffect(() => {
    if (!leerAlAbrir) return;
    let vigente = true;
    traerMarcador(leerAlAbrir)
      .then((r) => {
        if (!vigente) return;
        if (r.success) aplicarLectura(r.data);
        else setAviso(`${r.error} Puedes cargar el resultado a mano.`);
      })
      .catch(() => {
        if (vigente) setAviso("No se pudo leer el marcador. Puedes cargar el resultado a mano.");
      })
      .finally(() => {
        if (vigente) setLeyendo(false);
      });
    return () => {
      vigente = false;
    };
  }, [leerAlAbrir, aplicarLectura]);

  // Con el modal abierto se revisa si el juez ya terminó (o si deshizo y sigue jugando).
  // Solo cambia la propuesta: nunca pisa lo que el organizador esté escribiendo.
  const vigilar = marcadorDisponible && enlaces && !corrigiendo && encuentro ? encuentro.id : null;
  useEffect(() => {
    if (!vigilar) return;
    const t = setInterval(() => {
      traerMarcador(vigilar)
        .then((r) => {
          if (r.success) setPropuesta(r.data.terminado ? r.data : null);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [vigilar]);

  if (!encuentro) return null;

  const horario = (
    <HorarioPartido
      key={`h-${encuentro.id}`}
      encuentro={encuentro}
      equipos={[encuentro.equipo_a_id, encuentro.equipo_b_id]
        .filter((id): id is string => !!id)
        .map((id) => ({ nombre: nombre(id), restricciones: restricciones.get(id) }))}
      // Partidos no jugados con los que se puede cambiar el turno.
      candidatos={partidos
        .filter(
          (p) =>
            p.id !== encuentro.id &&
            p.estado === "programado" &&
            (p.programado_at || encuentro.programado_at) &&
            p.equipo_a_id &&
            p.equipo_b_id,
        )
        .sort((x, y) => (x.programado_at ?? "9").localeCompare(y.programado_at ?? "9"))
        .map((p) => ({
          id: p.id,
          texto: `${p.programado_at ? formatFechaHoraCO(p.programado_at) : "Sin fecha"} · ${nombre(p.equipo_a_id)} vs ${nombre(p.equipo_b_id)}${p.grupo ? ` (Grupo ${p.grupo})` : ""}`,
        }))}
      canchas={canchas}
      nombresCanchas={juego.nombres_canchas}
    />
  );

  // Cruce de la llave todavía sin equipos: solo se le puede poner fecha.
  if (!encuentro.equipo_a_id || !encuentro.equipo_b_id) {
    const lugar = (lado: "a" | "b") => {
      const id = lado === "a" ? encuentro.equipo_a_id : encuentro.equipo_b_id;
      return id ? nombre(id) : (etiquetaLugar(encuentro, lado, primeraFase) ?? "Por definir");
    };
    return (
      <Dialog open onOpenChange={(o) => !o && onCerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lugar("a")} vs {lugar("b")}
            </DialogTitle>
            <DialogDescription>
              {labelFase(encuentro.fase)}. El cruce se completa solo cuando termina el grupo o el
              partido del que sale cada equipo. Mientras tanto puedes dejarle fecha y hora.
            </DialogDescription>
          </DialogHeader>
          {horario}
        </DialogContent>
      </Dialog>
    );
  }

  const numericos = sets
    .map(([a, b]) => [Number(a) || 0, Number(b) || 0] as [number, number])
    .filter(([a, b]) => a > 0 || b > 0);
  const problemaFinal = validarSets(numericos, juego, true);
  const problemaVivo = validarSets(numericos, juego, false);
  const a = nombre(encuentro.equipo_a_id);
  const b = nombre(encuentro.equipo_b_id);
  const terminado = encuentro.estado === "finalizado" || encuentro.estado === "wo";
  const guardados = encuentro.sets;
  const sinCambios =
    encuentro.estado === "finalizado" && setsEnTexto(numericos) === setsEnTexto(guardados);

  /** Avisa qué se va a recalcular antes de cambiar un resultado ya guardado. */
  const consecuencias =
    encuentro.fase === "grupos"
      ? "La tabla de posiciones se recalculará."
      : "La llave se actualizará: si cambia el ganador, también cambia quién avanza.";
  const resultadoActual =
    encuentro.estado === "wo"
      ? `W.O., gana ${nombre(encuentro.ganador_id)}`
      : `${setsEnTexto(guardados)}, gana ${nombre(encuentro.ganador_id)}`;

  function guardarFinal() {
    const input = { tipo: "sets" as const, sets: numericos, estado: "finalizado" as const };
    if (!terminado) {
      return enviar(input, corrigiendo ? "Resultado corregido" : "Partido finalizado");
    }
    const ganaA = numericos.filter(([x, y]) => x > y).length * 2 > numericos.length;
    setConfirmar({
      texto: `Resultado actual: ${resultadoActual}. Nuevo resultado: ${setsEnTexto(numericos)}, gana ${ganaA ? a : b}. ${consecuencias}`,
      input,
      ok: "Resultado corregido",
    });
  }

  function declararWO(ganador: "a" | "b") {
    const nombreGanador = ganador === "a" ? a : b;
    const input = { tipo: "wo" as const, ganador };
    const ok = `Gana ${nombreGanador} por W.O.`;
    if (!terminado) return enviar(input, ok);
    setConfirmar({
      texto: `Resultado actual: ${resultadoActual}. Nuevo resultado: gana ${nombreGanador} por W.O. y se borran los sets. ${consecuencias}`,
      input,
      ok,
    });
  }

  function volverAlResumen() {
    setCorrigiendo(false);
    setConfirmar(null);
    if (terminado) setSets(filasDeSets(guardados, juego.sets));
  }

  function enviar(input: Parameters<typeof guardarResultado>[1], ok: string) {
    if (!encuentro) return;
    startTransition(async () => {
      const r = await guardarResultado(encuentro.id, input);
      if (!r.success) return void toast.error(r.error);
      toast.success(ok);
      onCerrar();
      router.refresh();
    });
  }

  function abrir(opciones?: OpcionesMarcador) {
    if (!encuentro) return;
    startTransition(async () => {
      const r = await abrirMarcador(encuentro.id, opciones);
      if (!r.success) return void toast.error(r.error);
      setOpcionesVoz(null);
      setEnlaces(r.data);
      toast.success("Marcador listo: compártelo con el juez");
      router.refresh();
    });
  }

  function traer() {
    if (!encuentro) return;
    startTransition(async () => {
      const r = await traerMarcador(encuentro.id);
      if (!r.success) return void toast.error(r.error);
      aplicarLectura(r.data);
    });
  }

  function corregir() {
    if (!propuesta) return;
    // El set a medias se incluye para completarlo; si no se jugó, se borra.
    const conAbierto = propuesta.setSinTerminar ? [...propuesta.sets, propuesta.setSinTerminar] : propuesta.sets;
    setSets(filasDeSets(conAbierto, juego.sets));
    setCorrigiendo(true);
  }

  const setNum = (i: number, lado: 0 | 1, v: string) =>
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? (lado === 0 ? [v.replace(/\D/g, ""), s[1]] : [s[0], v.replace(/\D/g, "")]) : s)),
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {a} vs {b}
          </DialogTitle>
          <DialogDescription>
            {encuentro.fase === "grupos" ? `Grupo ${encuentro.grupo}` : labelFase(encuentro.fase)} ·
            {juego.sets === 1 ? " 1 set" : ` mejor de ${juego.sets}`} a {juego.puntos_set}
            {juego.sets > 1 ? ` (decisivo a ${juego.puntos_decisivo})` : ""}. {textoAlargue(juego)}
          </DialogDescription>
        </DialogHeader>

        {horario}
        <ArbitrajeCasilla
          key={encuentro.id}
          encuentroId={encuentro.id}
          inicial={!!encuentro.arbitraje_pagado}
          valorPorDefecto={juego.valor_arbitraje}
        />

        {terminado && !corrigiendo ? (
          <ResumenPartido
            encuentro={encuentro}
            ganador={nombre(encuentro.ganador_id)}
            equipoA={a}
            equipoB={b}
            pending={pending}
            onCorregir={() => setCorrigiendo(true)}
          />
        ) : leyendo ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Leyendo el marcador del juez…</p>
        ) : propuesta && !corrigiendo ? (
          <PropuestaJuez
            propuesta={propuesta}
            juego={juego}
            equipoA={a}
            equipoB={b}
            pending={pending}
            onAceptar={() =>
              enviar({ tipo: "sets", sets: propuesta.sets, estado: "finalizado" }, "Resultado aceptado")
            }
            onCorregir={corregir}
          />
        ) : (
          <>
        {corrigiendo && (
          <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-xl p-3">
            <p className="text-xs">
              {terminado
                ? "Estás corrigiendo un partido ya finalizado. Nada cambia hasta que lo confirmes."
                : "Estás corrigiendo el resultado del juez. El oficial será el que guardes aquí."}
            </p>
            <Button size="sm" variant="ghost" onClick={volverAlResumen} disabled={pending}>
              Volver
            </Button>
          </div>
        )}
        {marcadorDisponible && !corrigiendo && (
          <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3">
            <p className="text-sm font-semibold">Marcador del juez (opcional)</p>
            <p className="text-muted-foreground text-xs">
              El juez marca los puntos en vivo desde su celular. Cuando termine, aquí aparecerá
              su resultado para aceptarlo o corregirlo.
            </p>
            <div className="flex flex-wrap gap-2">
              {!encuentro.sala_marcador && !enlaces ? (
                opcionesVoz ? (
                  <OpcionesVozMarcador
                    encuentroId={encuentro.id}
                    opciones={opcionesVoz}
                    onChange={setOpcionesVoz}
                    equipoA={a}
                    equipoB={b}
                    pending={pending}
                    onAbrir={() => abrir(opcionesVoz)}
                    onCancelar={() => setOpcionesVoz(null)}
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpcionesVoz(OPCIONES_MARCADOR_POR_DEFECTO)}
                    disabled={pending}
                  >
                    <Smartphone className="size-3.5" /> Abrir marcador para el juez
                  </Button>
                )
              ) : (
                <>
                  <Button size="sm" onClick={traer} disabled={pending}>
                    <Download className="size-3.5" /> Traer marcador
                  </Button>
                  {!enlaces && (
                    <Button size="sm" variant="ghost" onClick={() => abrir()} disabled={pending}>
                      Ver enlaces
                    </Button>
                  )}
                </>
              )}
            </div>
            {enlaces && <EnlacesJuez enlaces={enlaces} partido={`${a} vs ${b}`} />}
            {aviso && <p className="text-xs text-sky-500">{aviso}</p>}
          </div>
        )}

        <div className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2 text-sm">
          <span />
          <span className="text-muted-foreground truncate text-center text-xs">{a}</span>
          <span className="text-muted-foreground truncate text-center text-xs">{b}</span>
          {sets.map(([sa, sb], i) => (
            <div key={i} className="contents">
              <span className="text-muted-foreground text-xs">
                Set {i + 1}
                {juego.sets > 1 && i === juego.sets - 1 ? " (decisivo)" : ""}
              </span>
              <Input inputMode="numeric" value={sa} onChange={(e) => setNum(i, 0, e.target.value)} className="text-center" aria-label={`Set ${i + 1} ${a}`} />
              <Input inputMode="numeric" value={sb} onChange={(e) => setNum(i, 1, e.target.value)} className="text-center" aria-label={`Set ${i + 1} ${b}`} />
            </div>
          ))}
        </div>

        <p className={problemaFinal ? "text-xs text-amber-600 dark:text-amber-400" : "text-xs text-emerald-600 dark:text-emerald-400"}>
          {numericos.length === 0
            ? "Escribe los puntos de cada set."
            : problemaFinal ?? (terminado ? "El marcador es válido." : "Marcador completo: puedes finalizar el partido.")}
        </p>

        {confirmar ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold">¿Confirmas este cambio?</p>
            <p className="text-xs leading-relaxed">{confirmar.texto}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={pending} onClick={() => enviar(confirmar.input, confirmar.ok)}>
                Sí, confirmar
              </Button>
            </div>
          </div>
        ) : (
          <>
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <span className="text-muted-foreground flex w-full flex-wrap items-center gap-1 text-xs">
            Declarar W.O.
            <InfoToggle>
              <b>W.O.</b> (walkover) significa perder el partido por no presentarse: el rival gana
              sin jugar. Marca aquí qué equipo no se presentó. Si el partido sí se jugó, usa los
              sets de arriba.
            </InfoToggle>
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => declararWO("b")}>
            No se presentó {a}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => declararWO("a")}>
            No se presentó {b}
          </Button>
          {encuentro.estado !== "programado" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                setConfirmar({
                  texto: `Se borrará el resultado guardado y el partido volverá a quedar programado. ${consecuencias}`,
                  input: { tipo: "reiniciar" },
                  ok: "Partido reiniciado",
                })
              }
            >
              Reiniciar
            </Button>
          )}
        </div>

        <DialogFooter>
          {!terminado && (
            <Button
              variant="outline"
              disabled={pending || numericos.length === 0 || !!problemaVivo}
              onClick={() =>
                enviar({ tipo: "sets", sets: numericos, estado: "en_vivo" }, "Marcador en vivo guardado")
              }
            >
              Guardar en vivo
            </Button>
          )}
          <Button disabled={pending || !!problemaFinal || sinCambios} onClick={guardarFinal}>
            {corrigiendo ? "Guardar corrección" : "Finalizar partido"}
          </Button>
        </DialogFooter>
          </>
        )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "YYYY-MM-DD" y "HH:MM" en hora de Colombia de un ISO. */
function partesColombia(iso: string | null): { fecha: string; hora: string } {
  if (!iso) return { fecha: "", hora: "19:00" };
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString();
  return { fecha: d.slice(0, 10), hora: d.slice(11, 16) };
}

/** Fecha, hora y cancha de un partido: el organizador las cambia a mano. */
function HorarioPartido({
  encuentro,
  equipos,
  candidatos,
  canchas,
  nombresCanchas,
}: {
  encuentro: EncuentroPublico;
  /** Los equipos del partido con sus restricciones de horario. */
  equipos: { nombre: string; restricciones: RestriccionesEquipo | undefined }[];
  /** Otros partidos no jugados con los que se puede intercambiar el horario. */
  candidatos: { id: string; texto: string }[];
  canchas: number;
  nombresCanchas: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const inicial = partesColombia(encuentro.programado_at);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [cancha, setCancha] = useState(String(encuentro.cancha ?? 1));
  const [intercambio, setIntercambio] = useState("");
  const jugado = encuentro.estado !== "programado";

  function intercambiar() {
    if (!intercambio) return;
    startTransition(async () => {
      const r = await intercambiarHorarios(encuentro.id, intercambio);
      if (!r.success) return void toast.error(r.error);
      if (r.data.aviso) toast.warning(`Horarios intercambiados, pero: ${r.data.aviso}.`);
      else toast.success("Horarios intercambiados");
      setIntercambio("");
      setEditando(false);
      router.refresh();
    });
  }
  const nombreCancha = (n: number) => nombresCanchas[n - 1]?.trim() || `Cancha ${n}`;

  function guardar(quitar: boolean) {
    startTransition(async () => {
      const r = await editarHorarioEncuentro(encuentro.id, {
        fecha: quitar ? null : fecha || null,
        hora,
        cancha: Number(cancha) || 1,
      });
      if (!r.success) return void toast.error(r.error);
      if (r.data.aviso) toast.warning(`Horario guardado, pero ${r.data.aviso}.`);
      else toast.success(quitar ? "El partido quedó por programar" : "Horario guardado");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>
          <CalendarClock className="text-muted-foreground mr-1.5 inline size-4 align-[-3px]" />
          {encuentro.programado_at
            ? `${formatFechaHoraCO(encuentro.programado_at)}${canchas > 1 && encuentro.cancha ? ` · ${nombreCancha(encuentro.cancha)}` : ""}`
            : "Por programar"}
        </span>
        {!editando && (
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
            <Pencil className="size-3.5" /> {encuentro.programado_at ? "Cambiar" : "Programar"}
          </Button>
        )}
      </div>
      {editando && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" />
          </div>
          {equipos.some((e) => tieneRestricciones(e.restricciones)) && (
            <ul className="text-muted-foreground text-xs">
              {equipos
                .filter((e) => tieneRestricciones(e.restricciones))
                .map((e) => (
                  <li key={e.nombre}>
                    <b>{e.nombre}</b>: {resumenRestricciones(e.restricciones)}
                  </li>
                ))}
            </ul>
          )}
          {fecha && hora && (() => {
            const choque = choquePartido(new Date(`${fecha}T${hora}:00-05:00`), equipos);
            return choque ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {choque}. Puedes guardarlo igual.</p>
            ) : null;
          })()}
          {canchas > 1 && (
            <select
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              aria-label="Cancha"
            >
              {Array.from({ length: canchas }, (_, i) => (
                <option key={i} value={i + 1}>
                  {nombreCancha(i + 1)}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {encuentro.programado_at && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => guardar(true)}>
                Quitar fecha
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={pending || !fecha || !hora} onClick={() => guardar(false)}>
              Guardar horario
            </Button>
          </div>
          {!jugado && candidatos.length > 0 && (
            <div className="border-border flex flex-col gap-2 border-t pt-2">
              <p className="text-muted-foreground text-xs">
                <b>Intercambiar horario</b> con otro partido: este pasa a su turno y aquel a este. Así
                cambias quién juega a esta hora sin romper los cruces del grupo.
              </p>
              <select
                value={intercambio}
                onChange={(e) => setIntercambio(e.target.value)}
                className="border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm"
                aria-label="Partido con el que intercambiar"
              >
                <option value="">Elige el partido…</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.texto}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="self-end" disabled={pending || !intercambio} onClick={intercambiar}>
                Intercambiar horarios
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

type Propuesta = Extract<Awaited<ReturnType<typeof programarPartidos>>, { success: true }>["data"];

/**
 * Programa los partidos sin fecha en los próximos días de juego del
 * calendario. Primero muestra la propuesta; se guarda al confirmar.
 */
function ProgramarPartidos({
  torneoId,
  categoriaId,
  calendario,
  sinFecha,
  conflictos,
  conFecha,
}: {
  torneoId: string;
  categoriaId: string | null;
  calendario: ReglasTorneo["calendario"];
  sinFecha: number;
  /** Programados que chocan con restricciones de horario. */
  conflictos: number;
  /** Programados (con fecha) que aún no se juegan. */
  conFecha: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(() => partesColombia(new Date().toISOString()).fecha);
  const [dias, setDias] = useState(String(Math.max(1, calendario.dias_juego.length || 1)));
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  type ModoProgramar = "sin_fecha" | "conflictos" | "todo";
  const [modo, setModo] = useState<ModoProgramar>(conflictos > 0 ? "conflictos" : "sin_fecha");

  const textoCalendario =
    (calendario.dias_juego.length > 0
      ? [...calendario.dias_juego].sort().map((d) => DIAS_SEMANA[d]).join(", ")
      : "todos los días") +
    ` desde las ${calendario.hora_inicio}, ${calendario.partidos_por_dia} partido(s) por día`;

  function correr(aplicar: boolean) {
    startTransition(async () => {
      const r = await programarPartidos(torneoId, categoriaId, { desde, dias: Number(dias) || 1, modo }, aplicar);
      if (!r.success) return void toast.error(r.error);
      if (!aplicar) return void setPropuesta(r.data);
      toast.success(
        `${r.data.propuesta.length} partidos programados` +
          (r.data.sinCupo.length > 0 ? ` · ${r.data.sinCupo.length} quedaron por programar` : ""),
      );
      setPropuesta(null);
      setAbierto(false);
      router.refresh();
    });
  }

  if (sinFecha === 0 && conFecha === 0) return null;
  if (!abierto) {
    const abrir = (m: ModoProgramar) => {
      setModo(m);
      setPropuesta(null);
      setAbierto(true);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {sinFecha > 0 && (
          <Button size="sm" variant="outline" onClick={() => abrir(conflictos > 0 ? "conflictos" : "sin_fecha")}>
            <CalendarClock className="size-3.5" /> Programar partidos ({sinFecha} sin fecha)
          </Button>
        )}
        {conflictos > 0 && sinFecha === 0 && (
          <Button size="sm" variant="outline" onClick={() => abrir("conflictos")}>
            <CalendarClock className="size-3.5" /> Reprogramar los que chocan ({conflictos})
          </Button>
        )}
        {conFecha > 0 && (
          <Button size="sm" variant="ghost" onClick={() => abrir("todo")}>
            Reprogramar todo lo no jugado
          </Button>
        )}
      </div>
    );
  }
  const opcionesModo: { value: ModoProgramar; label: string }[] = [
    ...(sinFecha > 0 ? [{ value: "sin_fecha" as const, label: `Solo sin fecha (${sinFecha})` }] : []),
    ...(conflictos > 0 ? [{ value: "conflictos" as const, label: `Sin fecha + los que chocan (${conflictos})` }] : []),
    { value: "todo", label: "Rehacer todo lo no jugado" },
  ];

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">
        Calendario: {textoCalendario}. Se cambia en Configuración. Alterna grupos, nadie juega dos
        veces el mismo día y van primero los equipos con menos partidos.
      </p>
      <Campo
        label="Qué programar"
        info={
          <>
            <b>Solo sin fecha</b>: no toca lo ya programado. <b>Los que chocan</b>: mueve los
            partidos cuya hora no le sirve a un equipo según sus restricciones. <b>Rehacer todo</b>:
            vuelve a repartir todos los partidos no jugados desde la fecha «Desde» respetando las
            restricciones (útil si cambiaste varias). Los partidos jugados nunca se tocan.
          </>
        }
      >
        <Segmentado
          value={modo}
          onChange={(v) => { setModo(v as ModoProgramar); setPropuesta(null); }}
          options={opcionesModo}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Desde">
          <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPropuesta(null); }} />
        </Campo>
        <Campo label="Días de juego">
          <Input
            inputMode="numeric"
            value={dias}
            onChange={(e) => { setDias(e.target.value.replace(/\D/g, "")); setPropuesta(null); }}
          />
        </Campo>
      </div>

      {propuesta && propuesta.sinCupo.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <p className="font-semibold">{propuesta.sinCupo.length} partido(s) quedarán «Por programar»:</p>
          {propuesta.sinCupo.slice(0, 6).map((x, i) => (
            <p key={i}>
              {x.a} vs {x.b}: {x.motivo}
            </p>
          ))}
          {propuesta.sinCupo.length > 6 && <p>y {propuesta.sinCupo.length - 6} más…</p>}
        </div>
      )}
      {propuesta && (
        propuesta.propuesta.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No hay turnos libres en esos días para los partidos pendientes.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border text-sm">
            {propuesta.propuesta.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5">
                <span className="text-muted-foreground w-36 shrink-0 text-xs">
                  {formatFechaHoraCO(p.programado_at)}
                  {p.antes && p.antes !== p.programado_at && (
                    <span className="block line-through opacity-70">{formatFechaHoraCO(p.antes)}</span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">{p.grupo ? `Grupo ${p.grupo}` : labelFase(p.fase as Encuentro["fase"])}</span>
                <span className="min-w-0">
                  {p.a} <span className="text-muted-foreground">vs</span> {p.b}
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setAbierto(false); setPropuesta(null); }}>
          Cancelar
        </Button>
        {propuesta && (propuesta.propuesta.length > 0 || (modo !== "sin_fecha" && propuesta.sinCupo.length > 0)) ? (
          <Button size="sm" disabled={pending} onClick={() => correr(true)}>
            Guardar programación
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => correr(false)}>
            Ver propuesta
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Casilla opcional del organizador: ¿ya se pagó el arbitraje? Se guarda al
 * marcarla. Solo existe en el panel: ni el juez ni la página pública la ven.
 */
function ArbitrajeCasilla({
  encuentroId,
  inicial,
  valorPorDefecto,
}: {
  encuentroId: string;
  inicial: boolean;
  /** Valor del arbitraje por partido (Configuración → reglas). 0 = no se registra dinero. */
  valorPorDefecto: number;
}) {
  const router = useRouter();
  const [pagado, setPagado] = useState(inicial);
  const [valor, setValor] = useState(valorPorDefecto > 0 ? String(valorPorDefecto) : "");
  const [pending, startTransition] = useTransition();

  function guardar(nuevo: boolean, monto: string) {
    setPagado(nuevo);
    startTransition(async () => {
      const r = await marcarArbitrajePagado(encuentroId, nuevo, Number(monto) || 0);
      if (!r.success) {
        setPagado(!nuevo);
        return void toast.error(r.error);
      }
      if (nuevo && Number(monto) > 0) toast.success(`Arbitraje ${formatCOP(Number(monto))}: quedó como ingreso del torneo`);
      router.refresh();
    });
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={pagado}
          disabled={pending}
          onChange={(e) => guardar(e.target.checked, valor)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          Arbitraje pagado
          <span className="text-muted-foreground block text-xs">
            Con valor, queda como ingreso del torneo (Finanzas). Solo lo ves tú: no aparece para el
            juez ni en la página pública.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-2 pl-6">
        <div className="w-36">
          <InputMoneda value={valor} onChange={setValor} placeholder="Valor cobrado" />
        </div>
        {pagado && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => guardar(true, valor)}>
            Guardar valor
          </Button>
        )}
      </div>
    </div>
  );
}

/** Sets de un partido, de solo lectura, con el ganador de cada uno resaltado. */
function TablaSets({
  sets,
  equipoA,
  equipoB,
}: {
  sets: [number, number][];
  equipoA: string;
  equipoB: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 text-sm">
      <span />
      <span className="text-muted-foreground max-w-24 truncate text-center text-xs">{equipoA}</span>
      <span className="text-muted-foreground max-w-24 truncate text-center text-xs">{equipoB}</span>
      {sets.map(([x, y], i) => (
        <div key={i} className="contents">
          <span className="text-muted-foreground text-xs">Set {i + 1}</span>
          <span className={x > y ? "text-center font-semibold" : "text-center"}>{x}</span>
          <span className={y > x ? "text-center font-semibold" : "text-center"}>{y}</span>
        </div>
      ))}
    </div>
  );
}

/** Partido terminado: solo se consulta. Cambiarlo es una acción aparte. */
function ResumenPartido({
  encuentro,
  ganador,
  equipoA,
  equipoB,
  pending,
  onCorregir,
}: {
  encuentro: EncuentroPublico;
  ganador: string;
  equipoA: string;
  equipoB: string;
  pending: boolean;
  onCorregir: () => void;
}) {
  const { sets, resultado_juez: juez } = encuentro;
  const setsA = sets.filter(([x, y]) => x > y).length;
  const setsB = sets.length - setsA;
  const perdedor = ganador === equipoA ? equipoB : equipoA;
  const coincide = juez && encuentro.estado === "finalizado" && setsEnTexto(juez.sets) === setsEnTexto(sets);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3">
        <p className="text-sm font-semibold">Partido finalizado</p>
        {encuentro.estado === "finalizado" && <TablaSets sets={sets} equipoA={equipoA} equipoB={equipoB} />}
      </div>

      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        {encuentro.estado === "wo"
          ? `Gana ${ganador} por W.O.: ${perdedor} no se presentó.`
          : `Gana ${ganador} ${Math.max(setsA, setsB)}-${Math.min(setsA, setsB)} en sets.`}
      </p>

      {juez && (
        <p className="text-muted-foreground text-xs">
          {coincide
            ? "Coincide con lo que reportó el juez."
            : `Corregido por el organizador. El juez reportó: ${
                juez.sets.length > 0 ? setsEnTexto(juez.sets) : "ningún set terminado"
              }${juez.set_sin_terminar ? ` (un set quedó ${juez.set_sin_terminar.join("-")} sin terminar)` : ""}.`}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onCorregir}>
          <Pencil className="size-3.5" /> Corregir resultado
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Lo que reportó el juez: el organizador lo acepta tal cual o lo corrige. */
function PropuestaJuez({
  propuesta,
  juego,
  equipoA,
  equipoB,
  pending,
  onAceptar,
  onCorregir,
}: {
  propuesta: LecturaMarcador;
  juego: ReglasTorneo["juego"];
  equipoA: string;
  equipoB: string;
  pending: boolean;
  onAceptar: () => void;
  onCorregir: () => void;
}) {
  const { sets, setSinTerminar } = propuesta;
  const problema = validarSets(sets, juego, true);
  const setsA = sets.filter(([x, y]) => x > y).length;
  const setsB = sets.length - setsA;
  const ganador = setsA > setsB ? equipoA : equipoB;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3">
        <p className="text-sm font-semibold">Resultado del juez</p>
        {sets.length === 0 ? (
          <p className="text-muted-foreground text-xs">El juez no alcanzó a terminar ningún set.</p>
        ) : (
          <TablaSets sets={sets} equipoA={equipoA} equipoB={equipoB} />
        )}
        {setSinTerminar && (
          <p className="text-muted-foreground text-xs">
            Un set quedó {setSinTerminar[0]}-{setSinTerminar[1]} sin terminar y no cuenta.
          </p>
        )}
      </div>

      <p className={problema ? "text-sm text-amber-600 dark:text-amber-400" : "text-sm font-medium text-emerald-600 dark:text-emerald-400"}>
        {problema
          ? `El juez finalizó antes de tiempo y este resultado no se puede aceptar. ${problema} Corrígelo para continuar.`
          : `Gana ${ganador} ${Math.max(setsA, setsB)}-${Math.min(setsA, setsB)} en sets.`}
      </p>

      <DialogFooter>
        <Button variant={problema ? "default" : "outline"} disabled={pending} onClick={onCorregir}>
          <Pencil className="size-3.5" /> Corregir
        </Button>
        {!problema && (
          <Button disabled={pending} onClick={onAceptar}>
            <Check className="size-3.5" /> Aceptar resultado
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

/** Enlaces para el juez (celular) y la pantalla de la cancha. */
/**
 * Antes de abrir el marcador: cómo anuncia la voz a los equipos (por nombre,
 * por defecto, o por color), los colores de cada uno y quién habla. El juez
 * puede cambiar la voz durante el partido desde el menú ☰ del marcador.
 */
function OpcionesVozMarcador({
  encuentroId,
  opciones,
  onChange,
  equipoA,
  equipoB,
  pending,
  onAbrir,
  onCancelar,
}: {
  encuentroId: string;
  opciones: OpcionesMarcador;
  onChange: (o: OpcionesMarcador) => void;
  equipoA: string;
  equipoB: string;
  pending: boolean;
  onAbrir: () => void;
  onCancelar: () => void;
}) {
  const setColor = (lado: 0 | 1, color: string) => {
    const colores: [string, string] = [...opciones.colores];
    colores[lado] = color;
    // Si eligen el color del rival, se intercambian para que nunca queden iguales.
    if (colores[0] === colores[1]) colores[1 - lado] = opciones.colores[lado];
    onChange({ ...opciones, colores });
  };
  const porColor = opciones.anuncio === "color";
  const [probando, setProbando] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  async function probar() {
    setProbando(true);
    audio.current?.pause();
    // Se crea dentro del toque: así iPhone deja sonarlo cuando llega el audio.
    const el = (audio.current ??= new Audio());
    try {
      const r = await probarVozPartido(encuentroId, opciones);
      if (!r.success) return void toast.error(r.error);
      el.src = `data:audio/mpeg;base64,${r.data.audio}`;
      await el.play().catch(() => toast.error("Toca otra vez «Probar voz» para escucharla"));
    } finally {
      setProbando(false);
    }
  }
  return (
    <div className="flex w-full flex-col gap-3">
      <Campo
        label="La voz anuncia a cada equipo por"
        info={
          <>
            <b>Nombre</b>: «{equipoA}, 5. {equipoB}, 3». <b>Color</b>: «Azul, 5. Rojo, 3». El
            color sirve si los nombres son largos o difíciles de pronunciar.
          </>
        }
      >
        <Segmentado
          value={opciones.anuncio}
          onChange={(v) => onChange({ ...opciones, anuncio: v === "color" ? "color" : "nombre" })}
          options={[
            { value: "nombre", label: "Nombre del equipo" },
            { value: "color", label: "Color del equipo" },
          ]}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        {([equipoA, equipoB] as const).map((nombreEquipo, i) => {
          const lado = i as 0 | 1;
          return (
            <Campo key={lado} label={`Color de ${nombreEquipo}`}>
              <div className="flex items-center gap-2">
                <span
                  className="size-4 shrink-0 rounded-full border"
                  style={{ background: opciones.colores[lado] }}
                  aria-hidden
                />
                <Selector value={opciones.colores[lado]} onChange={(v) => setColor(lado, v)}>
                  {COLORES_MARCADOR.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Selector>
              </div>
            </Campo>
          );
        })}
      </div>
      {!porColor && (
        <p className="text-muted-foreground -mt-1 text-xs">
          Los colores se ven en la pantalla; la voz dice el nombre del equipo.
        </p>
      )}
      <Campo label="Voz" ayuda="Se puede cambiar durante el partido desde el menú ☰ del marcador.">
        <Selector value={opciones.voz} onChange={(v) => onChange({ ...opciones, voz: v as VozMarcador })}>
          {VOCES_MARCADOR.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </Selector>
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={probar} disabled={pending || probando}>
          <Volume2 className="size-3.5" /> {probando ? "Generando…" : "Probar voz"}
        </Button>
        <Button size="sm" onClick={onAbrir} disabled={pending}>
          <Smartphone className="size-3.5" /> Abrir marcador
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function EnlacesJuez({
  enlaces,
  partido,
}: {
  enlaces: EnlacesMarcador;
  partido: string;
}) {
  const copiar = (url: string) =>
    navigator.clipboard.writeText(url).then(() => toast.success("Enlace copiado"));
  const filas = [
    { icono: Smartphone, label: "Juez (celular, modo juez)", url: enlaces.juez },
    { icono: Monitor, label: "Pantalla del organizador (TV)", url: enlaces.pantalla },
    { icono: Smartphone, label: "Control con doble toque", url: enlaces.control },
    { icono: Smartphone, label: "Solo celular, sin TV", url: enlaces.soloCelular },
  ];
  return (
    <div className="flex flex-col gap-2">
      {/* Las dos acciones del día de juego: la pantalla (el organizador, con voz y música) y el juez. */}
      <div className="flex flex-wrap gap-2">
        <a href={enlaces.pantalla} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
          <Monitor className="size-3.5" /> Abrir pantalla (admin)
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Marcador de ${partido} (modo juez): ${enlaces.juez}`)}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <MessageCircle className="size-3.5" /> Compartir al juez
        </a>
      </div>
      <p className="text-muted-foreground text-xs">
        Abre la <b>pantalla</b> en el PC o celular conectado a la TV: ahí se activan la voz y la
        música y se prueba cómo suena. El <b>juez</b> marca desde su celular con su enlace.
      </p>
      {filas.map((f) => {
        const Icono = f.icono;
        return (
          <div key={f.label} className="flex items-center gap-2 text-xs">
            <Icono className="text-muted-foreground size-3.5 shrink-0" />
            <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline">
              {f.label}
            </a>
            <button type="button" onClick={() => copiar(f.url)} aria-label={`Copiar enlace ${f.label}`} className="text-muted-foreground hover:text-foreground">
              <Copy className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
