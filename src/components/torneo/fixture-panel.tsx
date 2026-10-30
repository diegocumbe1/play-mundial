"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Copy, Download, MessageCircle, Monitor, Smartphone, Trophy } from "lucide-react";
import { toast } from "sonner";

import {
  abrirMarcador,
  generarEliminatorias,
  generarFixture,
  guardarResultado,
  traerMarcador,
  type OpcionesFixture,
} from "@/actions/torneos";
import { Campo, Segmentado } from "@/components/torneo/campos";
import { FixtureVista } from "@/components/torneo/fixture-vista";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { armarGrupos, labelFase, todosContraTodos, validarSets } from "@/lib/torneo-fixture";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
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
}: {
  torneo: Torneo;
  categorias: CategoriaTorneo[];
  equipos: EquipoTorneo[];
  encuentros: Encuentro[];
  reglas: ReglasTorneo;
  /** Si dc-sport-score está configurado: el juez puede marcar en vivo. */
  marcadorDisponible?: boolean;
}) {
  const [editando, setEditando] = useState<EncuentroPublico | null>(null);
  // Sin categorías, el torneo entero es una sola "categoría".
  const grupos: { id: string | null; nombre: string }[] =
    categorias.length > 0 ? categorias : [{ id: null, nombre: "Torneo" }];
  const nombre = (id: string | null) => equipos.find((e) => e.id === id)?.nombre ?? "Por definir";

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
          />
        ))}
      </div>

      <FixtureVista
        categorias={categorias}
        equipos={equipos}
        encuentros={encuentros}
        tablaReglas={reglas.tabla}
        onEditar={setEditando}
      />

      <ResultadoModal
        encuentro={editando}
        nombre={nombre}
        juego={reglas.juego}
        marcadorDisponible={marcadorDisponible}
        onCerrar={() => setEditando(null)}
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
}: {
  torneo: Torneo;
  categoriaId: string | null;
  nombre: string;
  confirmados: number;
  encuentros: Encuentro[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rehacer, setRehacer] = useState(false);
  const [modo, setModo] = useState<Modo>(MODO_POR_FORMATO[torneo.formato]);
  const [porGrupo, setPorGrupo] = useState("4");
  const [fecha, setFecha] = useState(torneo.fecha_inicio ?? new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("17:00");
  const [dias, setDias] = useState("7");
  const [clasifican, setClasifican] = useState("2");

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
              <p className="text-muted-foreground text-xs">
                Faltan {pendientesGrupos} partido(s) de grupos. Al terminarlos podrás generar las
                eliminatorias.
              </p>
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
              Llave en juego: los ganadores avanzan solos al cargar cada resultado.
            </p>
          )}
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

/** Carga del marcador por sets, con validación en vivo según las reglas. */
function ResultadoModal({
  encuentro,
  nombre,
  juego,
  marcadorDisponible,
  onCerrar,
}: {
  encuentro: EncuentroPublico | null;
  nombre: (id: string | null) => string;
  juego: ReglasTorneo["juego"];
  marcadorDisponible: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sets, setSets] = useState<[string, string][]>([]);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<{ control: string; soloCelular: string; pantalla: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  if (encuentro && encuentro.id !== ultimoId) {
    setUltimoId(encuentro.id);
    setEnlaces(null);
    setAviso(null);
    setSets(
      Array.from({ length: juego.sets }, (_, i) => {
        const s = encuentro.sets[i];
        return s ? [String(s[0]), String(s[1])] : ["", ""];
      }),
    );
  }
  if (!encuentro) return null;

  const numericos = sets
    .map(([a, b]) => [Number(a) || 0, Number(b) || 0] as [number, number])
    .filter(([a, b]) => a > 0 || b > 0);
  const problemaFinal = validarSets(numericos, juego, true);
  const problemaVivo = validarSets(numericos, juego, false);
  const a = nombre(encuentro.equipo_a_id);
  const b = nombre(encuentro.equipo_b_id);

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

  function abrir() {
    if (!encuentro) return;
    startTransition(async () => {
      const r = await abrirMarcador(encuentro.id);
      if (!r.success) return void toast.error(r.error);
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
      setEnlaces(r.data.enlaces);
      setSets(
        Array.from({ length: juego.sets }, (_, i) => {
          const s = r.data.sets[i];
          return s ? [String(s[0]), String(s[1])] : ["", ""];
        }),
      );
      setAviso(
        r.data.terminado
          ? "El juez terminó el partido. Revisa los sets y confirma con “Finalizar partido”."
          : "Partido en curso. Puedes guardar el parcial con “Guardar en vivo”.",
      );
    });
  }

  const setNum = (i: number, lado: 0 | 1, v: string) =>
    setSets((prev) =>
      prev.map((s, idx) => (idx === i ? (lado === 0 ? [v.replace(/\D/g, ""), s[1]] : [s[0], v.replace(/\D/g, "")]) : s)),
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {a} vs {b}
          </DialogTitle>
          <DialogDescription>
            {encuentro.fase === "grupos" ? `Grupo ${encuentro.grupo}` : labelFase(encuentro.fase)} ·
            {juego.sets === 1 ? " 1 set" : ` mejor de ${juego.sets}`} a {juego.puntos_set}
            {juego.sets > 1 ? ` (decisivo a ${juego.puntos_decisivo})` : ""}
          </DialogDescription>
        </DialogHeader>

        {marcadorDisponible && (
          <div className="bg-muted/40 flex flex-col gap-2 rounded-xl p-3">
            <p className="text-sm font-semibold">Marcador del juez (opcional)</p>
            <p className="text-muted-foreground text-xs">
              El juez marca los puntos en vivo desde su celular. Al terminar, trae el marcador
              aquí, revisa los sets y confirma.
            </p>
            <div className="flex flex-wrap gap-2">
              {!encuentro.sala_marcador && !enlaces ? (
                <Button size="sm" variant="outline" onClick={abrir} disabled={pending}>
                  <Smartphone className="size-3.5" /> Abrir marcador para el juez
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={traer} disabled={pending}>
                    <Download className="size-3.5" /> Traer marcador
                  </Button>
                  {!enlaces && (
                    <Button size="sm" variant="ghost" onClick={abrir} disabled={pending}>
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
            : problemaFinal ?? "Marcador completo: puedes finalizar el partido."}
        </p>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <span className="text-muted-foreground self-center text-xs">W.O. (no se presentó):</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => enviar({ tipo: "wo", ganador: "b" }, `Gana ${b} por W.O.`)}>
            {a}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => enviar({ tipo: "wo", ganador: "a" }, `Gana ${a} por W.O.`)}>
            {b}
          </Button>
          {encuentro.estado !== "programado" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => enviar({ tipo: "reiniciar" }, "Partido reiniciado")}>
              Reiniciar
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending || numericos.length === 0 || !!problemaVivo}
            onClick={() =>
              enviar({ tipo: "sets", sets: numericos, estado: "en_vivo" }, "Marcador en vivo guardado")
            }
          >
            Guardar en vivo
          </Button>
          <Button
            disabled={pending || !!problemaFinal}
            onClick={() => enviar({ tipo: "sets", sets: numericos, estado: "finalizado" }, "Partido finalizado")}
          >
            Finalizar partido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Enlaces para el juez (celular) y la pantalla de la cancha. */
function EnlacesJuez({
  enlaces,
  partido,
}: {
  enlaces: { control: string; soloCelular: string; pantalla: string };
  partido: string;
}) {
  const copiar = (url: string) =>
    navigator.clipboard.writeText(url).then(() => toast.success("Enlace copiado"));
  const filas = [
    { icono: Smartphone, label: "Juez (celular)", url: enlaces.control },
    { icono: Smartphone, label: "Solo celular, sin TV", url: enlaces.soloCelular },
    { icono: Monitor, label: "Pantalla / TV", url: enlaces.pantalla },
  ];
  return (
    <div className="flex flex-col gap-1.5">
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
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Marcador de ${partido}: ${enlaces.control}`)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-emerald-600 dark:text-emerald-400"
      >
        <MessageCircle className="size-3.5" /> Enviar al juez por WhatsApp
      </a>
    </div>
  );
}
