"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Plus, Trash2 } from "lucide-react";

import {
  actualizarTorneo,
  crearTorneo,
  guardarPremiosTorneo,
} from "@/actions/torneos";
import { AreaTexto, Campo, Segmentado, Selector } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { apodoPuesto, DEPORTES, formatCOP, labelPuesto } from "@/lib/torneos";
import type { FormatoTorneo, PremioTorneo, Torneo } from "@/types";

/** Un premio mientras se edita (los montos viajan como texto). */
interface PremioDraft {
  tipo: "valor" | "producto";
  descripcion: string;
  valor: string;
}

function premioVacio(): PremioDraft {
  return { tipo: "valor", descripcion: "", valor: "" };
}

const FORMATOS: { value: FormatoTorneo; label: string }[] = [
  { value: "todos_contra_todos", label: "Todos contra todos" },
  { value: "eliminacion_directa", label: "Eliminación directa" },
  { value: "grupos_eliminacion", label: "Grupos + eliminación" },
  { value: "personalizado", label: "Personalizado" },
];

/** Formulario de creación/edición de un torneo (general, operación y finanzas). */
export function TorneoForm({
  torneo,
  premiosIniciales,
  esSuperadmin = false,
  tenants = [],
}: {
  torneo?: Torneo;
  premiosIniciales?: PremioTorneo[];
  /** Si el usuario es superadmin, puede delegar el torneo a otro organizador. */
  esSuperadmin?: boolean;
  tenants?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const esEdicion = !!torneo;

  const deporteInicial = torneo?.deporte ?? "Fútbol";
  const esDeporteDeLista = DEPORTES.includes(
    deporteInicial as (typeof DEPORTES)[number],
  );

  const [nombre, setNombre] = useState(torneo?.nombre ?? "");
  const [deporte, setDeporte] = useState(esDeporteDeLista ? deporteInicial : "Otro");
  const [deporteOtro, setDeporteOtro] = useState(esDeporteDeLista ? "" : deporteInicial);
  const [modalidad, setModalidad] = useState(torneo?.modalidad ?? "");
  const [categoria, setCategoria] = useState(torneo?.categoria ?? "");
  const [rama, setRama] = useState(torneo?.rama ?? "");
  const [formato, setFormato] = useState<FormatoTorneo>(
    torneo?.formato ?? "todos_contra_todos",
  );
  const [ciudad, setCiudad] = useState(torneo?.ciudad ?? "");
  const [escenario, setEscenario] = useState(torneo?.escenario ?? "");
  const [direccion, setDireccion] = useState(torneo?.direccion ?? "");
  const [fechaInicio, setFechaInicio] = useState(torneo?.fecha_inicio ?? "");
  const [fechaFin, setFechaFin] = useState(torneo?.fecha_fin ?? "");
  const [cierre, setCierre] = useState(
    torneo?.cierre_inscripciones ? torneo.cierre_inscripciones.slice(0, 10) : "",
  );

  const [cupo, setCupo] = useState(String(torneo?.cupo_equipos ?? "8"));
  const [minimo, setMinimo] = useState(
    torneo?.minimo_equipos != null ? String(torneo.minimo_equipos) : "",
  );
  const [jugadores, setJugadores] = useState(
    torneo?.jugadores_por_equipo != null ? String(torneo.jugadores_por_equipo) : "",
  );
  const [duracion, setDuracion] = useState(
    torneo?.duracion_partido_minutos != null
      ? String(torneo.duracion_partido_minutos)
      : "",
  );
  const [canchas, setCanchas] = useState(String(torneo?.cantidad_canchas ?? "1"));

  const [valorInscripcion, setValorInscripcion] = useState(
    String(torneo?.valor_inscripcion ?? ""),
  );
  const [premiacion, setPremiacion] = useState(torneo?.premiacion_descripcion ?? "");
  const [reglamento, setReglamento] = useState(torneo?.reglamento ?? "");
  const [tenantId, setTenantId] = useState("");

  // Premiación: una fila por puesto. La posición en el arreglo ES el puesto.
  const [premios, setPremios] = useState<PremioDraft[]>(
    premiosIniciales && premiosIniciales.length > 0
      ? [...premiosIniciales]
          .sort((a, b) => a.puesto - b.puesto)
          .map((p) => ({
            tipo: p.tipo,
            descripcion: p.descripcion,
            valor: p.valor != null ? String(p.valor) : "",
          }))
      : [premioVacio()],
  );

  function setPremio(i: number, patch: Partial<PremioDraft>) {
    setPremios((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function moverPremio(i: number, direccion: -1 | 1) {
    setPremios((prev) => {
      const destino = i + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
  }

  // Solo cuenta el dinero: los productos se presupuestan como gasto.
  const totalEnDinero = premios.reduce(
    (suma, p) => suma + (p.tipo === "valor" ? Number(p.valor) || 0 : 0),
    0,
  );

  function submit() {
    const deporteFinal = deporte === "Otro" ? deporteOtro.trim() : deporte;
    if (!deporteFinal) {
      toast.error("Indica el deporte del torneo");
      return;
    }

    const input = {
      nombre: nombre.trim(),
      deporte: deporteFinal,
      modalidad: modalidad.trim() || null,
      categoria: categoria.trim() || null,
      rama: rama.trim() || null,
      formato,
      ciudad: ciudad.trim() || null,
      escenario: escenario.trim() || null,
      direccion: direccion.trim() || null,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      // La fecha llega como día; se cierra al final de ese día (hora de Colombia).
      cierre_inscripciones: cierre ? `${cierre}T23:59:00-05:00` : null,
      cupo_equipos: Number(cupo) || 0,
      minimo_equipos: minimo ? Number(minimo) : null,
      jugadores_por_equipo: jugadores ? Number(jugadores) : null,
      duracion_partido_minutos: duracion ? Number(duracion) : null,
      cantidad_canchas: Number(canchas) || 1,
      valor_inscripcion: Number(valorInscripcion) || 0,
      reglamento: reglamento.trim() || null,
      premiacion_descripcion: premiacion.trim() || null,
      tema: torneo?.tema ?? "clasico",
      tenant_id: tenantId || null,
    };

    // La posición manda: el 1° de la lista es el 1er puesto.
    const premiosInput = premios
      .filter((p) => p.descripcion.trim())
      .map((p, i) => ({
        puesto: i + 1,
        tipo: p.tipo,
        descripcion: p.descripcion.trim(),
        valor: p.tipo === "valor" ? Number(p.valor) || 0 : null,
      }));

    startTransition(async () => {
      let torneoId: string;
      if (esEdicion) {
        const res = await actualizarTorneo(torneo.id, input);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        torneoId = torneo.id;
      } else {
        const res = await crearTorneo(input);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        torneoId = res.data.id;
      }

      const rp = await guardarPremiosTorneo(torneoId, premiosInput);
      if (!rp.success) {
        toast.error(rp.error);
        return;
      }

      toast.success(esEdicion ? "Torneo actualizado" : "Torneo creado en borrador");
      router.push(`/admin/torneos/${torneoId}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {esSuperadmin && !esEdicion && tenants.length > 0 && (
        <section className="border-border rounded-xl border p-4">
          <Campo
            label="Responsable del torneo"
            ayuda="Puedes delegarlo a un organizador para que no quede atado a ti."
          >
            <Selector value={tenantId} onChange={setTenantId}>
              <option value="">A mi nombre (superadmin)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        </section>
      )}

      {/* --- Información general --- */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold">Información general</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre del torneo" className="sm:col-span-2">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Copa Navideña de fútbol 8"
            />
          </Campo>

          <Campo label="Deporte">
            <Selector value={deporte} onChange={setDeporte}>
              {DEPORTES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Selector>
          </Campo>
          {deporte === "Otro" && (
            <Campo label="¿Cuál deporte?">
              <Input
                value={deporteOtro}
                onChange={(e) => setDeporteOtro(e.target.value)}
                placeholder="Kickball"
              />
            </Campo>
          )}

          <Campo label="Modalidad (opcional)">
            <Input
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
              placeholder="5x5, arena, dobles…"
            />
          </Campo>

          <Campo label="Categoría (opcional)">
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Libre, sub-17, veteranos…"
            />
          </Campo>
          <Campo label="Rama (opcional)">
            <Segmentado
              value={rama}
              onChange={setRama}
              options={[
                { value: "masculina", label: "Masculina" },
                { value: "femenina", label: "Femenina" },
                { value: "mixta", label: "Mixta" },
              ]}
            />
          </Campo>

          <Campo label="Formato de competencia" className="sm:col-span-2">
            <Segmentado
              value={formato}
              onChange={(v) => setFormato(v as FormatoTorneo)}
              options={FORMATOS}
            />
          </Campo>

          <Campo label="Ciudad">
            <Input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Neiva"
            />
          </Campo>
          <Campo label="Escenario">
            <Input
              value={escenario}
              onChange={(e) => setEscenario(e.target.value)}
              placeholder="Cancha sintética El Bosque"
            />
          </Campo>
          <Campo label="Dirección (opcional)" className="sm:col-span-2">
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle 20 # 5-40"
            />
          </Campo>

          <Campo label="Fecha de inicio">
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Campo>
          <Campo label="Fecha de fin">
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </Campo>
          <Campo
            label="Cierre de inscripciones"
            ayuda="Después de esta fecha la página pública deja de recibir solicitudes."
            className="sm:col-span-2"
          >
            <Input
              type="date"
              value={cierre}
              onChange={(e) => setCierre(e.target.value)}
            />
          </Campo>
        </div>
      </section>

      {/* --- Operación --- */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold">Operación</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Cupo máximo de equipos"
            ayuda="Define el escalón de precio del plan y los cupos de la página pública."
          >
            <Input
              inputMode="numeric"
              value={cupo}
              onChange={(e) => setCupo(e.target.value.replace(/\D/g, ""))}
              placeholder="8"
            />
          </Campo>
          <Campo
            label="Mínimo de equipos (opcional)"
            ayuda="Si no se alcanza, el panel te avisa antes de arrancar."
          >
            <Input
              inputMode="numeric"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value.replace(/\D/g, ""))}
              placeholder="4"
            />
          </Campo>
          <Campo label="Jugadores por equipo (opcional)">
            <Input
              inputMode="numeric"
              value={jugadores}
              onChange={(e) => setJugadores(e.target.value.replace(/\D/g, ""))}
              placeholder="12"
            />
          </Campo>
          <Campo label="Duración del partido (minutos)">
            <Input
              inputMode="numeric"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ""))}
              placeholder="50"
            />
          </Campo>
          <Campo label="Cantidad de canchas">
            <Input
              inputMode="numeric"
              value={canchas}
              onChange={(e) => setCanchas(e.target.value.replace(/\D/g, ""))}
              placeholder="1"
            />
          </Campo>
        </div>
      </section>

      {/* --- Finanzas --- */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold">Finanzas y comunicación</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Valor de inscripción por equipo (COP)"
            ayuda="Con esto se calculan los ingresos y el punto de equilibrio."
          >
            <InputMoneda
              value={valorInscripcion}
              onChange={setValorInscripcion}
              placeholder="150.000"
            />
          </Campo>
          <Campo
            label="Nota de premiación (opcional)"
            ayuda="Para lo que no es un puesto: “todos reciben medalla”, “el goleador se lleva un balón”."
            className="sm:col-span-2"
          >
            <AreaTexto
              value={premiacion}
              onChange={setPremiacion}
              rows={2}
              placeholder="Todos los equipos reciben medalla de participación."
            />
          </Campo>
          <Campo
            label="Reglamento"
            ayuda="Se muestra resumido en la página pública del torneo."
            className="sm:col-span-2"
          >
            <AreaTexto
              value={reglamento}
              onChange={setReglamento}
              rows={5}
              placeholder="Partidos de 2 tiempos de 25 minutos. Tarjeta roja = 1 fecha de suspensión…"
            />
          </Campo>
        </div>
      </section>

      {/* --- Premiación por puesto --- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Premiación por puesto</p>
            <p className="text-muted-foreground text-xs">
              Agrega solo los puestos que vas a premiar: uno, dos o los que quieras.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPremios((p) => [...p, premioVacio()])}
          >
            <Plus className="size-3.5" /> Agregar puesto
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {premios.map((p, i) => {
            const apodo = apodoPuesto(i + 1);
            return (
              <div key={i} className="border-border rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {labelPuesto(i + 1)}
                    {apodo && (
                      <span className="text-muted-foreground font-normal"> · {apodo}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moverPremio(i, -1)}
                      disabled={i === 0}
                      aria-label={`Subir ${labelPuesto(i + 1)}`}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-1.5 text-xs"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moverPremio(i, 1)}
                      disabled={i === premios.length - 1}
                      aria-label={`Bajar ${labelPuesto(i + 1)}`}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 px-1.5 text-xs"
                    >
                      ↓
                    </button>
                    {premios.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPremios((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Quitar ${labelPuesto(i + 1)}`}
                        className="text-muted-foreground hover:text-destructive ml-1 inline-flex size-6 items-center justify-center rounded-md"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="¿Qué se lleva?" className="sm:col-span-2">
                    <Input
                      value={p.descripcion}
                      onChange={(e) => setPremio(i, { descripcion: e.target.value })}
                      placeholder={
                        i === 0
                          ? "$1.000.000 + trofeo"
                          : i === 1
                            ? "$400.000 + trofeo"
                            : "Medallas y uniformes"
                      }
                    />
                  </Campo>
                  <Campo label="Tipo">
                    <Segmentado
                      value={p.tipo}
                      onChange={(v) => setPremio(i, { tipo: v as "valor" | "producto" })}
                      options={[
                        { value: "valor", label: "Dinero" },
                        { value: "producto", label: "Producto" },
                      ]}
                    />
                  </Campo>
                  {p.tipo === "valor" && (
                    <Campo label="Valor (COP)">
                      <InputMoneda
                        value={p.valor}
                        onChange={(v) => setPremio(i, { valor: v })}
                        placeholder="000.000"
                      />
                    </Campo>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {totalEnDinero > 0 && (
          <p className="text-muted-foreground text-xs">
            Premiación en dinero: <b className="text-foreground">{formatCOP(totalEnDinero)}</b>.
            Regístrala también como gasto para que la utilidad proyectada sea real.
          </p>
        )}
      </section>

      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          {esEdicion ? "Guardar cambios" : "Crear torneo"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
