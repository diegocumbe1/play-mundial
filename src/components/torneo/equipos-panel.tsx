"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  LayoutGrid,
  List,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  actualizarEquipoTorneo,
  confirmarEquipoTorneo,
  crearEquipoTorneo,
  eliminarPagoEquipo,
  guardarJugadoresEquipo,
  registrarPagoEquipo,
  rechazarEquipoTorneo,
  reintegrarEquipoAlFixture,
  retirarEquipoDelFixture,
} from "@/actions/torneos";
import { Campo, Segmentado, Selector } from "@/components/torneo/campos";
import { EquipoDetalleModal } from "@/components/torneo/equipo-detalle-modal";
import { jugadorVacio, PlantillaEditor } from "@/components/torneo/plantilla-editor";
import { RestriccionesEditor } from "@/components/torneo/restricciones-editor";
import {
  leerRestricciones,
  resumenRestricciones,
  tieneRestricciones,
  type RestriccionesEquipo,
} from "@/lib/torneo-restricciones";
import type { JugadorInput } from "@/lib/torneo-jugadores";
import type { ReglasTorneo } from "@/lib/torneo-reglas";
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
import { InputMoneda } from "@/components/rifa/input-moneda";
import { formatCOP, labelEstadoEquipo, montoEsperadoEquipo, saldoEquipo } from "@/lib/torneos";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type {
  CategoriaTorneo,
  EquipoTorneo,
  EncuentroPublico,
  EstadoEquipoTorneo,
  JugadorTorneo,
  PagoEquipoTorneo,
  Torneo,
} from "@/types";

type Filtro = "todos" | "pendiente" | "confirmado" | "retirado" | "deben";
type Vista = "tarjetas" | "lista";
const CLAVE_VISTA = "torneo:equipos:vista";
const oyentesVista = new Set<() => void>();
let vistaEnMemoria: Vista = "tarjetas";
function suscribirVista(fn: () => void) {
  oyentesVista.add(fn);
  return () => oyentesVista.delete(fn);
}
function leerVista(): Vista {
  try {
    const v = localStorage.getItem(CLAVE_VISTA);
    if (v === "lista" || v === "tarjetas") vistaEnMemoria = v;
  } catch {}
  return vistaEnMemoria;
}
function cambiarVista(v: Vista) {
  vistaEnMemoria = v;
  try {
    localStorage.setItem(CLAVE_VISTA, v);
  } catch {}
  oyentesVista.forEach((fn) => fn());
}

const CLASES_ESTADO: Record<EstadoEquipoTorneo, string> = {
  pendiente: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  confirmado: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rechazado: "bg-destructive/15 text-destructive",
  retirado: "bg-muted text-muted-foreground",
};

/**
 * Equipos del torneo: solicitudes por confirmar, cobro de inscripciones y
 * contacto directo por WhatsApp con el responsable.
 */
export function EquiposPanel({
  torneo,
  equipos,
  categorias = [],
  pagos = [],
  jugadores = [],
  participacion,
  encuentros = [],
  tablaReglas = { clasifican: 2 } as ReglasTorneo["tabla"],
  nombresCanchas = [],
}: {
  /** Partidos del torneo: alimentan la ficha del equipo (posición, resultados, fechas). */
  encuentros?: EncuentroPublico[];
  tablaReglas?: ReglasTorneo["tabla"];
  nombresCanchas?: string[];
  torneo: Torneo;
  equipos: EquipoTorneo[];
  categorias?: CategoriaTorneo[];
  pagos?: PagoEquipoTorneo[];
  jugadores?: JugadorTorneo[];
  participacion: ReglasTorneo["participacion"];
}) {
  const [plantillaDe, setPlantillaDe] = useState<EquipoTorneo | null>(null);
  const [editandoDe, setEditandoDe] = useState<EquipoTorneo | null>(null);
  const limitesDe = (categoriaId: string | null) => {
    const c = categorias.find((x) => x.id === categoriaId);
    return { minimo: c?.jugadores_en_cancha ?? null, maximo: c?.max_jugadores ?? null };
  };
  /** "efectivo $100.000 + transferencia $100.000" si pagó por varios medios. */
  const detalleMedios = (equipoId: string) => {
    const suma = { efectivo: 0, transferencia: 0 };
    for (const p of pagos) if (p.equipo_id === equipoId) suma[p.metodo] += p.monto;
    return [
      suma.efectivo ? `efectivo ${formatCOP(suma.efectivo)}` : null,
      suma.transferencia ? `transferencia ${formatCOP(suma.transferencia)}` : null,
    ]
      .filter(Boolean)
      .join(" + ");
  };
  const nombreCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? null;
  /** Lo que falta verificar del equipo: notas, documentos faltantes. Va en el tooltip. */
  const porRevisar = (e: EquipoTorneo): string[] => {
    const lista: string[] = [];
    if (e.nota_revision) lista.push(`Equipo: ${e.nota_revision}`);
    for (const j of jugadores) {
      if (j.equipo_id !== e.id) continue;
      if (!j.documento) lista.push(`${j.nombre}: falta el documento`);
      if (j.nota_revision) lista.push(`${j.nombre}: ${j.nota_revision}`);
    }
    return lista;
  };
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  // Equipo cuya ficha (posición, resultados, fechas) está abierta.
  const [fichaId, setFichaId] = useState<string | null>(null);
  const nombreEquipo = (id: string | null) => equipos.find((x) => x.id === id)?.nombre ?? "Equipo";
  const fueraDeJuego = new Set(
    equipos.filter((x) => x.estado === "retirado" || x.estado === "rechazado").map((x) => x.id),
  );
  // "todas" o el id de una categoría creada en el torneo (nada fijo: salen de `categorias`).
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [pagoDe, setPagoDe] = useState<EquipoTorneo | null>(null);
  // La vista elegida se recuerda en este navegador; en el servidor, tarjetas.
  const vista = useSyncExternalStore(suscribirVista, leerVista, () => "tarjetas" as Vista);

  // Sin tildes ni mayúsculas; busca en nombre, responsable, teléfono y correo. Aplica a tarjetas y lista.
  const normalizar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const coincide = (e: EquipoTorneo) => {
    if (terminos.length === 0) return true;
    const texto = normalizar(
      [e.nombre, e.responsable_nombre, e.responsable_telefono, e.responsable_correo, nombreCategoria(e.categoria_id)]
        .filter(Boolean)
        .join(" "),
    );
    return terminos.every((t) => texto.includes(t));
  };

  // Si la categoría elegida ya no existe, vale «todas».
  const categoriaActiva = categorias.some((c) => c.id === categoriaFiltro) ? categoriaFiltro : "todas";
  const deCategoria = equipos.filter(
    (e) => categoriaActiva === "todas" || e.categoria_id === categoriaActiva,
  );

  const visibles = deCategoria.filter((e) => {
    if (!coincide(e)) return false;
    if (filtro === "todos") return true;
    if (filtro === "deben") {
      return e.estado !== "rechazado" && e.estado !== "retirado" && saldoEquipo(torneo, e) > 0;
    }
    return e.estado === filtro;
  });

  function accion(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.success) {
        toast.error(r.error ?? "No se pudo completar la acción");
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  /** Retira al equipo: sus partidos sin jugar se borran y los ya jugados se conservan para sus rivales. */
  function retirar(e: EquipoTorneo) {
    const ok = confirm(
      `¿Retirar a ${e.nombre} del torneo?\n\nSe borran sus partidos sin jugar. Los que ya jugó se conservan: sus rivales mantienen esos puntos, y ${e.nombre} deja de salir en la tabla de posiciones. Si te equivocas, lo reintegras desde «Retirados» mientras la llave de eliminatorias no esté armada.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await retirarEquipoDelFixture(e.id);
      if (!r.success) return void toast.error(r.error);
      toast.success(
        `${e.nombre} retirado: ${r.data.quitados} partido(s) sin jugar quitados, ${r.data.conservados} ya jugado(s) conservado(s).`,
      );
      router.refresh();
    });
  }

  /** Deshace un retiro: vuelve a la tabla y se le crean de nuevo los partidos que le faltan. */
  function reintegrar(e: EquipoTorneo) {
    const ok = confirm(
      `¿Reintegrar a ${e.nombre} al torneo?\n\nVuelve a la tabla de posiciones con lo que ya jugó y se le crean de nuevo, sin fecha, los partidos que le falten contra los demás de su grupo. Después los programas.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await reintegrarEquipoAlFixture(e.id);
      if (!r.success) return void toast.error(r.error);
      toast.success(
        r.data.creados > 0
          ? `${e.nombre} reintegrado: se crearon ${r.data.creados} partido(s) por programar.`
          : `${e.nombre} reintegrado.`,
      );
      router.refresh();
    });
  }

  /** Estado, categoría y "Revisar (n)" con el detalle en el tooltip. */
  function insignias(e: EquipoTorneo) {
    const pendientes = porRevisar(e);
    const categoria = nombreCategoria(e.categoria_id);
    return (
      <>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            CLASES_ESTADO[e.estado],
          )}
        >
          {labelEstadoEquipo(e.estado)}
        </span>
        {categoria && (
          <span className="bg-muted inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {categoria}
          </span>
        )}
        {tieneRestricciones(leerRestricciones(e.restricciones_horario)) && (
          <span
            title={`Horario: ${resumenRestricciones(leerRestricciones(e.restricciones_horario))}`}
            className="inline-flex shrink-0 cursor-help items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
          >
            <CalendarClock className="size-3" />
            {resumenRestricciones(leerRestricciones(e.restricciones_horario))}
          </span>
        )}
        {pendientes.length > 0 && (
          <span
            title={pendientes.join("\n")}
            className="inline-flex shrink-0 cursor-help items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="size-3" /> Revisar ({pendientes.length})
          </span>
        )}
      </>
    );
  }

  function enlaceWhatsApp(e: EquipoTorneo, compacto: boolean) {
    if (!e.responsable_telefono) return null;
    return (
      <a
        href={waLink(
          e.responsable_telefono,
          `Hola ${e.responsable_nombre ?? ""}, te escribo por la inscripción de ${e.nombre} al torneo ${torneo.nombre}.`,
        )}
        target="_blank"
        rel="noreferrer"
        title={`WhatsApp a ${e.responsable_nombre ?? "el responsable"}`}
        aria-label="WhatsApp"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
          compacto ? "size-7 justify-center" : "px-2 py-1.5",
        )}
      >
        <MessageCircle className="size-3.5" />
        {!compacto && "WhatsApp"}
      </a>
    );
  }

  /**
   * Acciones del equipo. En la lista (compacto) van como íconos con tooltip;
   * jugadores, pago y WhatsApp ya están en sus columnas.
   */
  function acciones(e: EquipoTorneo, compacto: boolean) {
    const boton = compacto ? ("icon-sm" as const) : ("sm" as const);
    const cantidad = jugadores.filter((j) => j.equipo_id === e.id).length;
    return (
      <>
        {!compacto && enlaceWhatsApp(e, false)}
        <Button
          variant="outline"
          size={boton}
          onClick={() => setEditandoDe(e)}
          title="Editar equipo"
          aria-label="Editar equipo"
        >
          <Pencil className="size-3.5" /> {!compacto && "Editar"}
        </Button>
        {!compacto && (
          <>
            <Button variant="outline" size="sm" onClick={() => setPlantillaDe(e)}>
              <Users className="size-3.5" />
              {cantidad || "Sin"} jugadores
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPagoDe(e)}>
              <Wallet className="size-3.5" /> Pago
            </Button>
          </>
        )}
        {e.estado !== "confirmado" && (
          <Button
            variant="outline"
            size={boton}
            disabled={pending}
            title="Confirmar equipo"
            aria-label="Confirmar equipo"
            className={cn(compacto && "text-emerald-600 dark:text-emerald-400")}
            onClick={() => accion(() => confirmarEquipoTorneo(e.id), "Equipo confirmado")}
          >
            <Check className="size-3.5" /> {!compacto && "Confirmar"}
          </Button>
        )}
        {e.estado === "pendiente" && (
          <Button
            variant="ghost"
            size={boton}
            disabled={pending}
            title="Rechazar solicitud"
            aria-label="Rechazar solicitud"
            className={cn(compacto && "text-destructive")}
            onClick={() => accion(() => rechazarEquipoTorneo(e.id), "Solicitud rechazada")}
          >
            <X className="size-3.5" /> {!compacto && "Rechazar"}
          </Button>
        )}
        {e.estado === "retirado" && (
          <Button
            variant="outline"
            size={compacto ? "xs" : "sm"}
            disabled={pending}
            title="Reintegrar equipo al torneo"
            onClick={() => reintegrar(e)}
          >
            Reintegrar
          </Button>
        )}
        {(e.estado === "confirmado" || e.estado === "pendiente") && (
          <Button
            variant="ghost"
            size={compacto ? "xs" : "sm"}
            disabled={pending}
            title="Retirar equipo"
            onClick={() => retirar(e)}
          >
            Retirar
          </Button>
        )}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={busqueda}
          onChange={(ev) => setBusqueda(ev.target.value)}
          placeholder="Buscar equipo, responsable o teléfono…"
          aria-label="Buscar equipos"
          className="pl-8"
        />
      </div>
      {categorias.length > 1 && (
        <Segmentado
          value={categoriaActiva}
          onChange={setCategoriaFiltro}
          options={[
            { value: "todas", label: `Todas (${equipos.length})` },
            ...[...categorias]
              .sort((a, b) => a.orden - b.orden)
              .map((c) => ({
                value: c.id,
                label: `${c.nombre} (${equipos.filter((e) => e.categoria_id === c.id).length})`,
              })),
          ]}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmentado
          value={filtro}
          onChange={(v) => setFiltro(v as Filtro)}
          options={[
            { value: "todos", label: `Todos (${deCategoria.length})` },
            {
              value: "pendiente",
              label: `Pendientes (${deCategoria.filter((e) => e.estado === "pendiente").length})`,
            },
            {
              value: "confirmado",
              label: `Confirmados (${deCategoria.filter((e) => e.estado === "confirmado").length})`,
            },
            ...(deCategoria.some((e) => e.estado === "retirado")
              ? [
                  {
                    value: "retirado",
                    label: `Retirados (${deCategoria.filter((e) => e.estado === "retirado").length})`,
                  },
                ]
              : []),
            { value: "deben", label: "Deben" },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="border-border hidden rounded-lg border p-0.5 md:inline-flex">
            {(
              [
                { value: "tarjetas", label: "Tarjetas", Icon: LayoutGrid },
                { value: "lista", label: "Lista", Icon: List },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => cambiarVista(value)}
                aria-pressed={vista === value}
                title={`Vista de ${label.toLowerCase()}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  vista === value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setNuevoAbierto(true)}>
            <Plus className="size-3.5" /> Registrar equipo
          </Button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          {equipos.length === 0
            ? "Todavía no hay equipos. Regístralos tú o comparte el enlace público para que se inscriban solos."
            : busqueda.trim()
              ? `Ningún equipo coincide con «${busqueda.trim()}».`
              : "Ningún equipo coincide con este filtro."}
        </p>
      ) : (
        <>
          {/* Tarjetas: siempre en móvil; en escritorio, dos columnas para ver más de un vistazo. */}
          <ul className={cn("grid gap-2 lg:grid-cols-2", vista === "lista" && "md:hidden")}>
            {visibles.map((e) => {
              const esperado = montoEsperadoEquipo(torneo, e);
              const saldo = saldoEquipo(torneo, e);
              return (
                <li
                  key={e.id}
                  className="border-border flex min-w-0 flex-col gap-2 rounded-xl border p-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFichaId(e.id)}
                      title="Ver detalle del equipo"
                      className="hover:text-primary mr-0.5 truncate text-left font-semibold underline-offset-2 hover:underline"
                    >
                      {e.nombre}
                    </button>
                    {insignias(e)}
                  </div>
                  {e.nota_revision && (
                    <p
                      title={e.nota_revision}
                      className="line-clamp-2 text-xs text-amber-700 dark:text-amber-300"
                    >
                      Por revisar: {e.nota_revision}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {e.responsable_nombre ?? "Sin responsable"} · Pagó {formatCOP(e.monto_pagado)}{" "}
                    de {formatCOP(esperado)}
                    {detalleMedios(e.id) && (
                      <span className="text-muted-foreground/80"> ({detalleMedios(e.id)})</span>
                    )}
                    {saldo > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        · debe {formatCOP(saldo)}
                      </span>
                    )}
                  </p>
                  <div className="border-border mt-auto flex flex-wrap items-center gap-1.5 border-t pt-2">
                    {acciones(e, false)}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Lista: tabla compacta en escritorio con todas las acciones por fila. */}
          {vista === "lista" && (
            <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium">Equipo</th>
                    <th className="px-3 py-2 font-medium">Responsable</th>
                    <th className="px-3 py-2 text-center font-medium">Jugadores</th>
                    <th className="px-3 py-2 font-medium">Pago</th>
                    <th className="px-3 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {visibles.map((e) => {
                    const esperado = montoEsperadoEquipo(torneo, e);
                    const saldo = saldoEquipo(torneo, e);
                    const cantidad = jugadores.filter((j) => j.equipo_id === e.id).length;
                    return (
                      <tr key={e.id} className="hover:bg-muted/30 align-top">
                        <td className="max-w-[22rem] px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setFichaId(e.id)}
                              title="Ver detalle del equipo"
                              className="hover:text-primary text-left font-semibold underline-offset-2 hover:underline"
                            >
                              {e.nombre}
                            </button>
                            {insignias(e)}
                          </div>
                          {e.nota_revision && (
                            <p
                              title={e.nota_revision}
                              className="mt-0.5 line-clamp-1 text-xs text-amber-700 dark:text-amber-300"
                            >
                              {e.nota_revision}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs">
                              {e.responsable_nombre ?? "—"}
                            </span>
                            {enlaceWhatsApp(e, true)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPlantillaDe(e)}
                            className="hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                            title="Ver y editar jugadores"
                          >
                            <Users className="size-3.5" /> {cantidad}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setPagoDe(e)}
                            className="hover:bg-muted -mx-1.5 rounded-md px-1.5 py-0.5 text-left text-xs"
                            title={detalleMedios(e.id) || "Registrar pago"}
                          >
                            <span className="whitespace-nowrap">
                              {formatCOP(e.monto_pagado)} / {formatCOP(esperado)}
                            </span>
                            <span
                              className={cn(
                                "block font-medium",
                                saldo > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {saldo > 0 ? `debe ${formatCOP(saldo)}` : "al día"}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {acciones(e, true)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <EditarEquipoModal
        equipo={editandoDe}
        categorias={categorias}
        onCerrar={() => setEditandoDe(null)}
      />
      <PlantillaModal
        equipo={plantillaDe}
        jugadores={jugadores}
        participacion={participacion}
        limites={limitesDe(plantillaDe?.categoria_id ?? null)}
        onCerrar={() => setPlantillaDe(null)}
      />
      <NuevoEquipoModal
        torneo={torneo}
        categorias={categorias}
        participacion={participacion}
        abierto={nuevoAbierto}
        onCerrar={() => setNuevoAbierto(false)}
      />
      <PagoEquipoModal
        torneo={torneo}
        equipo={pagoDe}
        pagos={pagos}
        onCerrar={() => setPagoDe(null)}
      />
      <EquipoDetalleModal
        equipoId={fichaId}
        onCerrar={() => setFichaId(null)}
        nombre={nombreEquipo}
        categorias={categorias}
        encuentros={encuentros}
        retiradoIds={fueraDeJuego}
        tablaReglas={tablaReglas}
        nombresCanchas={nombresCanchas}
      />
    </section>
  );
}

/** Alta manual de un equipo (el organizador ya tiene los datos). */
function NuevoEquipoModal({
  torneo,
  categorias,
  participacion,
  abierto,
  onCerrar,
}: {
  torneo: Torneo;
  categorias: CategoriaTorneo[];
  participacion: ReglasTorneo["participacion"];
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;
  const [plantilla, setPlantilla] = useState<JugadorInput[]>([]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [responsable, setResponsable] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [jugadores, setJugadores] = useState("");
  const [estado, setEstado] = useState<EstadoEquipoTorneo>("confirmado");

  function guardar() {
    startTransition(async () => {
      const r = await crearEquipoTorneo(torneo.id, {
        nombre: nombre.trim(),
        categoria_id: categoriaId || null,
        jugadores: plantilla.filter((j) => j.nombre.trim() || (j.documento ?? "").trim()),
        responsable_nombre: responsable.trim() || null,
        responsable_telefono: telefono.trim() || null,
        responsable_correo: correo.trim() || null,
        cantidad_jugadores: jugadores ? Number(jugadores) : null,
        estado,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Equipo registrado");
      setNombre("");
      setResponsable("");
      setTelefono("");
      setCorreo("");
      setJugadores("");
      setPlantilla([]);
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar equipo</DialogTitle>
          <DialogDescription>
            Para los equipos que se inscriben por fuera de la página pública.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del equipo" className="sm:col-span-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          {categorias.length > 0 && (
            <Campo label="Categoría" className="sm:col-span-2">
              <Selector value={categoriaId} onChange={setCategoriaId}>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo label="Responsable">
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </Campo>
          <Campo label="WhatsApp">
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="3001234567"
            />
          </Campo>
          <Campo label="Correo (opcional)">
            <Input
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              inputMode="email"
            />
          </Campo>
          <Campo label="Jugadores (opcional)">
            <Input
              value={jugadores}
              onChange={(e) => setJugadores(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
            />
          </Campo>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">
              Jugadores (puedes completarlos después)
            </p>
            <PlantillaEditor
              documentoOpcional
              jugadores={plantilla}
              onChange={setPlantilla}
              reglas={participacion}
              limites={{
                minimo: categoria?.jugadores_en_cancha ?? null,
                maximo: categoria?.max_jugadores ?? null,
              }}
            />
          </div>
          <Campo label="Estado" className="sm:col-span-2">
            <Segmentado
              value={estado}
              onChange={(v) => setEstado(v as EstadoEquipoTorneo)}
              options={[
                { value: "confirmado", label: "Confirmado" },
                { value: "pendiente", label: "Pendiente" },
              ]}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || !nombre.trim()}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Corrige los datos del equipo: nombre, categoría, responsable y la nota de
 * revisión. El estado, la inscripción y los pagos se manejan con sus propios
 * botones; aquí se reenvían tal cual para no tocarlos.
 */
function EditarEquipoModal({
  equipo,
  categorias,
  onCerrar,
}: {
  equipo: EquipoTorneo | null;
  categorias: CategoriaTorneo[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [responsable, setResponsable] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [nota, setNota] = useState("");
  const [restricciones, setRestricciones] = useState<RestriccionesEquipo>(() =>
    leerRestricciones(null),
  );
  if (equipo && equipo.id !== ultimoId) {
    setUltimoId(equipo.id);
    setNombre(equipo.nombre);
    setCategoriaId(equipo.categoria_id ?? "");
    setResponsable(equipo.responsable_nombre ?? "");
    setTelefono(equipo.responsable_telefono ?? "");
    setCorreo(equipo.responsable_correo ?? "");
    setNota(equipo.nota_revision ?? "");
    setRestricciones(leerRestricciones(equipo.restricciones_horario));
  }
  if (!equipo) return null;

  function cerrar() {
    setUltimoId(null);
    onCerrar();
  }

  function guardar() {
    if (!equipo) return;
    startTransition(async () => {
      const r = await actualizarEquipoTorneo(equipo.id, {
        nombre: nombre.trim(),
        categoria_id: categoriaId || null,
        responsable_nombre: responsable.trim() || null,
        responsable_telefono: telefono.trim() || null,
        responsable_correo: correo.trim() || null,
        nota_revision: nota.trim() || null,
        restricciones_horario: restricciones,
        // Lo que este formulario no edita se conserva.
        escudo_url: equipo.escudo_url,
        cantidad_jugadores: equipo.cantidad_jugadores,
        monto_inscripcion: equipo.monto_inscripcion,
        estado: equipo.estado,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Equipo actualizado");
      cerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar equipo</DialogTitle>
          <DialogDescription>
            Los jugadores se editan en el botón «jugadores» y el pago en «Pago».
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del equipo" className="sm:col-span-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          {categorias.length > 0 && (
            <Campo label="Categoría" className="sm:col-span-2">
              <Selector value={categoriaId} onChange={setCategoriaId}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo label="Responsable / delegado">
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </Campo>
          <Campo label="WhatsApp">
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="3001234567"
            />
          </Campo>
          <Campo label="Correo (opcional)" className="sm:col-span-2">
            <Input value={correo} onChange={(e) => setCorreo(e.target.value)} inputMode="email" />
          </Campo>
          <div className="border-border flex flex-col gap-2 rounded-xl border p-3 sm:col-span-2">
            <p className="text-sm font-semibold">Horario disponible</p>
            <p className="text-muted-foreground text-xs">
              Cuándo puede jugar este equipo. «Programar partidos» lo respeta; si ya hay partidos
              programados que no le sirven, el Fixture te avisa y los puedes reprogramar.
            </p>
            <RestriccionesEditor value={restricciones} onChange={setRestricciones} />
          </div>
          <Campo label="Por revisar (nota interna)" className="sm:col-span-2">
            <div className="flex flex-col gap-1.5">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Nada pendiente"
                className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
              {nota.trim() && (
                <button
                  type="button"
                  onClick={() => setNota("")}
                  className="inline-flex items-center gap-1 self-start text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
                >
                  <Check className="size-3.5" /> Marcar como revisado
                </button>
              )}
            </div>
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || !nombre.trim()}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ver y corregir la plantilla de un equipo. */
function PlantillaModal({
  equipo,
  jugadores,
  participacion,
  limites,
  onCerrar,
}: {
  equipo: EquipoTorneo | null;
  jugadores: JugadorTorneo[];
  participacion: ReglasTorneo["participacion"];
  limites: { minimo: number | null; maximo: number | null };
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lista, setLista] = useState<JugadorInput[]>([]);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if (equipo && equipo.id !== ultimoId) {
    setUltimoId(equipo.id);
    const actuales = jugadores
      .filter((j) => j.equipo_id === equipo.id)
      .map((j) => ({
        nombre: j.nombre,
        documento: j.documento,
        genero: j.genero,
        es_externo: j.es_externo,
        es_referente: j.es_referente,
        referencia_cliente: j.referencia_cliente ?? "",
        nota_revision: j.nota_revision ?? null,
      }));
    setLista(
      actuales.length > 0
        ? actuales
        : Array.from({ length: limites.minimo ?? 2 }, jugadorVacio),
    );
  }
  if (!equipo) return null;

  function guardar() {
    if (!equipo) return;
    startTransition(async () => {
      const r = await guardarJugadoresEquipo(
        equipo.id,
        lista.filter((j) => j.nombre.trim() || (j.documento ?? "").trim()),
      );
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Plantilla guardada");
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jugadores de {equipo.nombre}</DialogTitle>
          <DialogDescription>
            Nombre y documento de cada jugador. Se valida con las reglas del torneo.
          </DialogDescription>
        </DialogHeader>
        <PlantillaEditor
          jugadores={lista}
          onChange={setLista}
          reglas={participacion}
          limites={limites}
          documentoOpcional
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending}>
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FECHA_PAGO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Pagos del equipo: historial de abonos, saldo pendiente y registro de un
 * nuevo abono. Admite pago dividido (una parte en efectivo y otra por
 * transferencia) y no deja pagar más de lo que se debe.
 */
function PagoEquipoModal({
  torneo,
  equipo,
  pagos,
  onCerrar,
}: {
  torneo: Torneo;
  equipo: EquipoTorneo | null;
  pagos: PagoEquipoTorneo[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [efectivo, setEfectivo] = useState("");
  const [transferencia, setTransferencia] = useState("");
  const [nota, setNota] = useState("");

  // Reinicia el formulario al abrir con otro equipo: por defecto, el saldo
  // completo por transferencia (lo más común).
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if (equipo && equipo.id !== ultimoId) {
    setUltimoId(equipo.id);
    const saldoInicial = saldoEquipo(torneo, equipo);
    setEfectivo("");
    setTransferencia(saldoInicial > 0 ? String(saldoInicial) : "");
    setNota("");
  }

  if (!equipo) return null;
  const esperado = montoEsperadoEquipo(torneo, equipo);
  const saldo = saldoEquipo(torneo, equipo);
  const abonos = pagos.filter((p) => p.equipo_id === equipo.id);
  const total = (Number(efectivo) || 0) + (Number(transferencia) || 0);
  const quedaria = saldo - total;

  function guardar() {
    if (!equipo) return;
    startTransition(async () => {
      const r = await registrarPagoEquipo(equipo.id, {
        efectivo: Number(efectivo) || 0,
        transferencia: Number(transferencia) || 0,
        nota: nota.trim() || null,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(quedaria > 0 ? `Abono registrado · queda ${formatCOP(quedaria)}` : "Pago completo");
      onCerrar();
      router.refresh();
    });
  }

  function borrar(pagoId: string) {
    startTransition(async () => {
      const r = await eliminarPagoEquipo(pagoId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Abono eliminado");
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagos de {equipo.nombre}</DialogTitle>
          <DialogDescription>
            Inscripción de {formatCOP(esperado)} · pagado {formatCOP(equipo.monto_pagado)}
            {saldo > 0 ? ` · debe ${formatCOP(saldo)}` : " · al día"}
          </DialogDescription>
        </DialogHeader>

        {abonos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs font-medium">Abonos registrados</p>
            {abonos.map((p) => (
              <div
                key={p.id}
                className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {formatCOP(p.monto)}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {p.metodo === "efectivo" ? "Efectivo" : "Transferencia"}
                    </span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {FECHA_PAGO.format(new Date(p.fecha))}
                    {p.nota ? ` · ${p.nota}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => borrar(p.id)}
                  disabled={pending}
                  aria-label="Eliminar abono"
                  className="text-muted-foreground hover:text-destructive inline-flex size-7 shrink-0 items-center justify-center rounded-md"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {saldo > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs font-medium">
              Nuevo abono · si pagó una parte en efectivo y otra por transferencia,
              llena los dos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="En efectivo">
                <InputMoneda value={efectivo} onChange={setEfectivo} placeholder="0" />
              </Campo>
              <Campo label="Por transferencia">
                <InputMoneda value={transferencia} onChange={setTransferencia} placeholder="0" />
              </Campo>
            </div>
            <Campo label="Nota (opcional)">
              <Input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Pagó el capitán en la cancha"
              />
            </Campo>
            <p
              className={cn(
                "text-xs",
                quedaria < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {total === 0
                ? "Escribe cuánto pagó."
                : quedaria < 0
                  ? `Supera lo que debe en ${formatCOP(-quedaria)}.`
                  : quedaria === 0
                    ? `Abono de ${formatCOP(total)}: queda al día.`
                    : `Abono de ${formatCOP(total)}: quedará debiendo ${formatCOP(quedaria)}.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Este equipo ya pagó la inscripción completa.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cerrar
          </Button>
          {saldo > 0 && (
            <Button onClick={guardar} disabled={pending || total <= 0 || quedaria < 0}>
              Registrar abono
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
