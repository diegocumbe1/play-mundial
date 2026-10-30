"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { guardarCategoriasTorneo, guardarReglasTorneo } from "@/actions/torneos";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { Campo, InfoToggle, Segmentado } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP, labelPuesto } from "@/lib/torneos";
import {
  equiposParaCubrirPremios,
  PLANTILLA_VOLEIPLAYA,
  POLITICAS_PREMIACION,
  POLITICAS_REEMBOLSO,
  type ReglasTorneo,
} from "@/lib/torneo-reglas";
import type { CategoriaTorneo, PremioTorneo, Torneo } from "@/types";

/** Una categoría mientras se edita (los números viajan como texto). */
interface CategoriaDraft {
  id: string | null;
  nombre: string;
  jugadores_en_cancha: string;
  max_jugadores: string;
  cupo_equipos: string;
  /** Vacío = usa la inscripción del torneo. */
  valor_inscripcion: string;
  premios: string[];
}

const num = (v: string) => (v.trim() ? Number(v) : null);

/** Qué significa la opción de sets elegida, en una línea. */
const EXPLICACION_SETS: Record<1 | 3 | 5, string> = {
  1: "Un solo set decide el partido. Es lo más rápido.",
  3: "Gana el primero que se lleve 2 sets. Si van 1-1, se juega el set decisivo.",
  5: "Gana el primero que se lleve 3 sets. Si van 2-2, se juega el set decisivo.",
};
const soloDigitos = (v: string) => v.replace(/\D/g, "");

function aDraft(c: CategoriaTorneo, premios: PremioTorneo[]): CategoriaDraft {
  return {
    id: c.id,
    nombre: c.nombre,
    jugadores_en_cancha: c.jugadores_en_cancha?.toString() ?? "",
    max_jugadores: c.max_jugadores?.toString() ?? "",
    cupo_equipos: String(c.cupo_equipos),
    valor_inscripcion: c.valor_inscripcion?.toString() ?? "",
    premios: premios
      .filter((p) => p.categoria_id === c.id)
      .sort((a, b) => a.puesto - b.puesto)
      .map((p) => String(p.valor ?? 0)),
  };
}

/**
 * Las preguntas del torneo, respondidas en pantalla: categorías con su
 * premiación y las reglas de juego y participación. Todo viene precargado
 * (plantilla) para que el organizador solo cambie lo que difiere.
 */
export function ConfigTorneoPanel({
  torneo,
  categorias,
  premios,
  reglasIniciales,
}: {
  torneo: Torneo;
  categorias: CategoriaTorneo[];
  premios: PremioTorneo[];
  reglasIniciales: ReglasTorneo;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cats, setCats] = useState<CategoriaDraft[]>(
    categorias.map((c) => aDraft(c, premios)),
  );
  const [reglas, setReglas] = useState<ReglasTorneo>(reglasIniciales);
  const [reglamento, setReglamento] = useState(torneo.reglamento ?? "");

  function setCat(i: number, patch: Partial<CategoriaDraft>) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function usarPlantilla() {
    setCats(
      PLANTILLA_VOLEIPLAYA.categorias.map((c) => ({
        id: null,
        nombre: c.nombre,
        jugadores_en_cancha: c.jugadores_en_cancha?.toString() ?? "",
        max_jugadores: c.max_jugadores?.toString() ?? "",
        cupo_equipos: String(c.cupo_equipos),
        valor_inscripcion: "",
        premios: ["", "", ""],
      })),
    );
  }

  function set<K extends keyof ReglasTorneo>(grupo: K, patch: Partial<ReglasTorneo[K]>) {
    setReglas((r) => ({ ...r, [grupo]: { ...r[grupo], ...patch } }));
  }

  function guardarCategorias() {
    startTransition(async () => {
      const res = await guardarCategoriasTorneo(
        torneo.id,
        cats.map((c) => ({
          id: c.id,
          nombre: c.nombre.trim(),
          jugadores_en_cancha: num(c.jugadores_en_cancha),
          max_jugadores: num(c.max_jugadores),
          cupo_equipos: Number(c.cupo_equipos) || 0,
          valor_inscripcion: num(c.valor_inscripcion),
          premios: c.premios.map((v) => Number(v) || 0),
        })),
      );
      if (!res.success) return void toast.error(res.error);
      toast.success("Categorías y premiación guardadas");
      router.refresh();
    });
  }

  function guardarReglas(regenerar: boolean) {
    startTransition(async () => {
      const res = await guardarReglasTorneo(torneo.id, reglas, {
        regenerarReglamento: regenerar,
      });
      if (!res.success) return void toast.error(res.error);
      if (regenerar) setReglamento(res.data.reglamento ?? "");
      toast.success(regenerar ? "Reglas guardadas y reglamento redactado" : "Reglas guardadas");
      router.refresh();
    });
  }

  const { juego, tabla, participacion: p, premiacion, reembolso } = reglas;

  return (
    <div className="flex flex-col gap-6">
      {/* --- Categorías y premiación --- */}
      <section className="border-border rounded-2xl border p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">1 · Categorías y premiación</p>
            <p className="text-muted-foreground text-xs">
              Cada categoría tiene su cupo, su inscripción y sus premios por puesto.
            </p>
          </div>
          {cats.length === 0 && (
            <Button size="sm" variant="outline" onClick={usarPlantilla}>
              <Sparkles className="size-3.5" /> Usar plantilla de voleiplaya
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {cats.map((c, i) => {
            const inscripcion = num(c.valor_inscripcion) ?? torneo.valor_inscripcion;
            const totalPremios = c.premios.reduce((s, v) => s + (Number(v) || 0), 0);
            const minimo = equiposParaCubrirPremios(totalPremios, inscripcion);
            return (
              <div key={c.id ?? `nueva-${i}`} className="bg-muted/30 rounded-xl p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={c.nombre}
                    onChange={(e) => setCat(i, { nombre: e.target.value })}
                    placeholder="3 vs 3"
                    className="font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setCats((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Quitar ${c.nombre || "categoría"}`}
                    className="text-muted-foreground hover:text-destructive inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Campo label="En cancha">
                    <Input
                      inputMode="numeric"
                      value={c.jugadores_en_cancha}
                      onChange={(e) => setCat(i, { jugadores_en_cancha: soloDigitos(e.target.value) })}
                      placeholder="3"
                    />
                  </Campo>
                  <Campo label="Máx. inscritos">
                    <Input
                      inputMode="numeric"
                      value={c.max_jugadores}
                      onChange={(e) => setCat(i, { max_jugadores: soloDigitos(e.target.value) })}
                      placeholder="5"
                    />
                  </Campo>
                  <Campo label="Cupo de equipos">
                    <Input
                      inputMode="numeric"
                      value={c.cupo_equipos}
                      onChange={(e) => setCat(i, { cupo_equipos: soloDigitos(e.target.value) })}
                      placeholder="12"
                    />
                  </Campo>
                  <Campo label="Inscripción">
                    <InputMoneda
                      value={c.valor_inscripcion}
                      onChange={(v) => setCat(i, { valor_inscripcion: v })}
                      placeholder={torneo.valor_inscripcion.toLocaleString("es-CO")}
                    />
                  </Campo>
                </div>

                <p className="text-muted-foreground mt-3 mb-1.5 text-xs font-medium">
                  Premios en dinero
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {c.premios.map((v, pi) => (
                    <Campo key={pi} label={labelPuesto(pi + 1)}>
                      <InputMoneda
                        value={v}
                        onChange={(nv) =>
                          setCat(i, { premios: c.premios.map((x, xi) => (xi === pi ? nv : x)) })
                        }
                        placeholder="000.000"
                      />
                    </Campo>
                  ))}
                  <div className="flex items-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCat(i, { premios: [...c.premios, ""] })}
                    >
                      <Plus className="size-3.5" /> Puesto
                    </Button>
                    {c.premios.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCat(i, { premios: c.premios.slice(0, -1) })}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>

                {minimo && (
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Premiación de {formatCOP(totalPremios)}: se necesitan{" "}
                    <b>{minimo} equipos</b> para cubrirla solo con inscripciones.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCats((prev) => [
                ...prev,
                {
                  id: null,
                  nombre: "",
                  jugadores_en_cancha: "",
                  max_jugadores: "",
                  cupo_equipos: "8",
                  valor_inscripcion: "",
                  premios: ["", "", ""],
                },
              ])
            }
          >
            <Plus className="size-3.5" /> Agregar categoría
          </Button>
          <Button type="button" size="sm" onClick={guardarCategorias} disabled={pending}>
            Guardar categorías
          </Button>
        </div>
      </section>

      {/* --- Reglas --- */}
      <section className="border-border rounded-2xl border p-4">
        <p className="text-sm font-semibold">2 · Cómo se juega</p>
        <p className="text-muted-foreground mb-3 text-xs">
          Valores de la plantilla de voleiplaya. Cambia solo lo que sea distinto.
          Toca <b>ⓘ</b> para ver qué significa cada cosa.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Sets por partido"
            className="sm:col-span-2"
            ayuda={EXPLICACION_SETS[juego.sets]}
            info={
              <>
                Un <b>set</b> es cada parcial del partido: lo gana el primer equipo
                que llega a los puntos pactados. <b>1 set</b>: un solo parcial
                decide el partido. <b>Mejor de 3</b>: gana quien se lleve 2 sets
                (si van 1-1 se juega un tercero). <b>Mejor de 5</b>: gana quien se
                lleve 3 sets.
              </>
            }
          >
            <Segmentado
              value={String(juego.sets)}
              onChange={(v) => set("juego", { sets: Number(v) as 1 | 3 | 5 })}
              options={[
                { value: "1", label: "1 set" },
                { value: "3", label: "Mejor de 3" },
                { value: "5", label: "Mejor de 5" },
              ]}
            />
          </Campo>
          <CampoNumero
            label="Puntos por set"
            value={juego.puntos_set}
            onChange={(v) => set("juego", { puntos_set: v ?? 21 })}
            info="Puntos que hay que alcanzar para ganar un set. En voleiplaya lo habitual es 21; en torneos con poco tiempo se usa 15."
          />
          {juego.sets > 1 && (
            <CampoNumero
              label="Puntos del set decisivo"
              value={juego.puntos_decisivo}
              onChange={(v) => set("juego", { puntos_decisivo: v ?? 15 })}
              info={`El set decisivo es el último posible (el ${juego.sets}° set), y solo se juega si el partido va empatado en sets. Se juega más corto para no alargar el partido: lo habitual es 15.`}
            />
          )}
          <Interruptor
            label="Se gana el set con 2 puntos de diferencia"
            checked={juego.diferencia_dos}
            onChange={(v) => set("juego", { diferencia_dos: v })}
            info="Si está activo, un set a 21 que va 20-20 no termina en 21-20: se sigue jugando hasta que un equipo saque 2 puntos de ventaja (22-20, 23-21…). Si está apagado, gana quien llegue primero a 21."
          />
          <CampoNumero
            label="Cambio de lado cada (puntos)"
            value={juego.cambio_lado_cada}
            onChange={(v) => set("juego", { cambio_lado_cada: v })}
            vacio="Sin cambio"
            info="Cada cuántos puntos sumados entre los dos equipos se cambian de lado de la cancha, para que el sol y el viento no favorezcan a nadie. En voleiplaya lo habitual es cada 7 puntos. Déjalo vacío si no cambian."
          />
          <CampoNumero
            label="Tolerancia para W.O. (minutos)"
            value={juego.tolerancia_wo_min}
            onChange={(v) => set("juego", { tolerancia_wo_min: v ?? 0 })}
            info={
              <>
                <b>W.O.</b> (walkover) es perder un partido por no presentarse.
                Si a la hora del partido un equipo no está completo en la cancha,
                se le espera estos minutos; pasado ese tiempo pierde el partido
                sin jugarlo y el rival gana.
              </>
            }
          />
        </div>

        <p className="mt-5 mb-1 text-sm font-semibold">Tabla de posiciones</p>
        <p className="text-muted-foreground mb-3 text-xs">
          Puntos que suma cada equipo en la tabla según el resultado del partido.
          No son los puntos del marcador.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoNumero
            label="Partido ganado"
            value={tabla.victoria}
            onChange={(v) => set("tabla", { victoria: v ?? 0 })}
            info="Puntos de tabla para el ganador. Con el sistema de voleiplaya: 2 puntos."
          />
          <CampoNumero
            label="Partido perdido"
            value={tabla.derrota}
            onChange={(v) => set("tabla", { derrota: v ?? 0 })}
            info="Puntos de tabla para el perdedor que sí jugó. Se le da 1 punto para premiar que se presentó y diferenciarlo de quien pierde por W.O."
          />
          <CampoNumero
            label="Pérdida por W.O."
            value={tabla.wo}
            onChange={(v) => set("tabla", { wo: v ?? 0 })}
            info="Puntos de tabla para el equipo que no se presentó. Lo normal es 0."
          />
        </div>
      </section>

      <section className="border-border rounded-2xl border p-4">
        <p className="text-sm font-semibold">3 · Quién puede jugar</p>
        <p className="text-muted-foreground mb-3 text-xs">
          La inscripción y el reglamento usan estas reglas.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Interruptor
            label="Exclusivo para clientes"
            checked={p.solo_clientes}
            onChange={(v) => set("participacion", { solo_clientes: v })}
            info="Solo pueden inscribirse personas que ya son clientes del organizador (del parque, del club…). Cada jugador debe demostrarlo como se indique abajo."
          />
          {p.solo_clientes && (
            <Campo
              label="¿Cómo demuestra que es cliente?"
              info="Lo que el jugador debe presentar para probar que es cliente. Aparece en el reglamento tal como lo escribas."
            >
              <Input
                value={p.como_verificar_cliente}
                onChange={(e) => set("participacion", { como_verificar_cliente: e.target.value })}
                placeholder="Número de factura o membresía"
              />
            </Campo>
          )}
          <CampoNumero
            label="Máximo de externos por equipo"
            value={p.max_externos}
            onChange={(v) => set("participacion", { max_externos: v })}
            vacio="Sin límite"
            info="Un externo es un jugador que no es cliente. Con 1, cada equipo puede sumar a una sola persona de afuera. Con 0 no se permiten externos. Vacío: sin límite."
          />
          <CampoNumero
            label="Máximo de referentes por equipo"
            value={p.max_referentes}
            onChange={(v) => set("participacion", { max_referentes: v })}
            vacio="Sin límite"
            info="Un referente es un jugador de nivel alto (de liga, selección o reconocido en la zona). Se limita para que los equipos queden parejos. Define abajo qué cuenta como referente."
          />
          {p.max_referentes != null && (
            <Campo
              label="¿Qué es un referente?"
              className="sm:col-span-2"
              info="Escríbelo en palabras simples para que nadie discuta en la cancha. Aparece tal cual en el reglamento."
            >
              <Input
                value={p.que_es_referente}
                onChange={(e) => set("participacion", { que_es_referente: e.target.value })}
                placeholder="Jugador de liga o selección departamental"
              />
            </Campo>
          )}
          <CampoNumero
            label="Mínimo de mujeres en cancha"
            value={p.min_mujeres_cancha}
            onChange={(v) => set("participacion", { min_mujeres_cancha: v ?? 0 })}
            info="Cuántas mujeres deben estar jugando en todo momento (categoría mixta). Si por un cambio o una lesión no se cumple, el equipo pierde el partido. 0 = sin exigencia."
          />
          <CampoNumero
            label="Edad mínima"
            value={p.edad_minima}
            onChange={(v) => set("participacion", { edad_minima: v })}
            vacio="Sin mínimo"
            info="Edad mínima para jugar. Si aceptas menores de edad, el reglamento debería pedir autorización de un acudiente."
          />
          <Interruptor
            label="Un jugador puede jugar en varias categorías"
            checked={p.jugador_varias_categorias}
            onChange={(v) => set("participacion", { jugador_varias_categorias: v })}
            info="Si está apagado, cada persona juega en un solo equipo y una sola categoría (por ejemplo, no puede estar en 3 vs 3 y en 5 vs 5 a la vez)."
          />
        </div>
      </section>

      <section className="border-border rounded-2xl border p-4">
        <p className="text-sm font-semibold">4 · Premiación y reembolsos</p>
        <div className="mt-3 grid gap-4">
          <Campo
            label="La premiación es…"
            info={
              <>
                <b>Garantizada</b>: se pagan los premios completos aunque se
                inscriban pocos equipos (el organizador asume el riesgo).{" "}
                <b>Mínimo de equipos</b>: se paga completa solo si se llega a
                cierta cantidad de equipos. <b>Proporcional</b>: los premios
                bajan si se inscriben menos equipos de los esperados.
              </>
            }
          >
            <Opciones
              value={premiacion.politica}
              onChange={(v) => set("premiacion", { politica: v as ReglasTorneo["premiacion"]["politica"] })}
              options={POLITICAS_PREMIACION}
            />
          </Campo>
          {premiacion.politica === "minimo_equipos" && (
            <CampoNumero
              label="Equipos mínimos por categoría para pagarla completa"
              info="Con menos equipos confirmados que este número en una categoría, la premiación de esa categoría no se garantiza completa. Arriba, en cada categoría, verás cuántos equipos se necesitan para cubrirla solo con inscripciones."
              value={premiacion.minimo_equipos}
              onChange={(v) => set("premiacion", { minimo_equipos: v })}
            />
          )}
          <Campo label="¿Cuándo se entregan los premios?">
            <Input
              value={premiacion.entrega}
              onChange={(e) => set("premiacion", { entrega: e.target.value })}
            />
          </Campo>
          <Campo
            label="Si un equipo se retira, la inscripción…"
            info="Qué pasa con el dinero de la inscripción cuando un equipo decide no jugar. Si el organizador cancela el torneo, el reglamento siempre dice que se devuelve completo."
          >
            <Opciones
              value={reembolso.politica}
              onChange={(v) => set("reembolso", { politica: v as ReglasTorneo["reembolso"]["politica"] })}
              options={POLITICAS_REEMBOLSO}
            />
          </Campo>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => guardarReglas(true)} disabled={pending}>
            <Sparkles className="size-3.5" /> Guardar y redactar reglamento
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => guardarReglas(false)}
            disabled={pending}
          >
            Solo guardar reglas
          </Button>
        </div>
      </section>

      {/* --- Vista previa del reglamento --- */}
      <section className="border-border rounded-2xl border p-4">
        <p className="text-sm font-semibold">5 · Reglamento</p>
        <p className="text-muted-foreground mb-3 text-xs">
          Se redacta con las respuestas de arriba y cada equipo lo acepta al
          inscribirse. Para ajustar una frase, usa “Editar” en el encabezado.
        </p>
        {reglamento ? (
          <div className="bg-muted/30 max-h-96 overflow-y-auto whitespace-pre-line rounded-lg p-3 text-xs leading-relaxed">
            {reglamento}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aún no hay reglamento. Guarda las reglas con “Guardar y redactar reglamento”.
          </p>
        )}
      </section>
    </div>
  );
}

function CampoNumero({
  label,
  value,
  onChange,
  vacio,
  info,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** Si existe, el campo vacío significa esto (y se guarda como `null`). */
  vacio?: string;
  info?: React.ReactNode;
}) {
  return (
    <Campo label={label} info={info} ayuda={vacio && value == null ? vacio : undefined}>
      <Input
        inputMode="numeric"
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const v = soloDigitos(e.target.value);
          onChange(v ? Number(v) : null);
        }}
        placeholder={vacio ?? "0"}
      />
    </Campo>
  );
}

function Interruptor({
  label,
  checked,
  onChange,
  info,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  info?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 self-end py-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 shrink-0"
        />
        {label}
      </label>
      {info && <InfoToggle>{info}</InfoToggle>}
    </div>
  );
}

function Opciones({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(options).map(([k, texto]) => (
        <label key={k} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={value === k}
            onChange={() => onChange(k)}
            className="mt-0.5 size-4 shrink-0"
          />
          {texto}
        </label>
      ))}
    </div>
  );
}
