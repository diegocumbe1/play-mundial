"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Plus, Trash2, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import {
  confirmarEquipoTorneo,
  crearEquipoTorneo,
  eliminarPagoEquipo,
  guardarJugadoresEquipo,
  registrarPagoEquipo,
  rechazarEquipoTorneo,
  retirarEquipoTorneo,
} from "@/actions/torneos";
import { Campo, Segmentado, Selector } from "@/components/torneo/campos";
import { jugadorVacio, PlantillaEditor } from "@/components/torneo/plantilla-editor";
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
  EstadoEquipoTorneo,
  JugadorTorneo,
  PagoEquipoTorneo,
  Torneo,
} from "@/types";

type Filtro = "todos" | "pendiente" | "confirmado" | "deben";

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
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  categorias?: CategoriaTorneo[];
  pagos?: PagoEquipoTorneo[];
  jugadores?: JugadorTorneo[];
  participacion: ReglasTorneo["participacion"];
}) {
  const [plantillaDe, setPlantillaDe] = useState<EquipoTorneo | null>(null);
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [pagoDe, setPagoDe] = useState<EquipoTorneo | null>(null);

  const visibles = equipos.filter((e) => {
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmentado
          value={filtro}
          onChange={(v) => setFiltro(v as Filtro)}
          options={[
            { value: "todos", label: `Todos (${equipos.length})` },
            {
              value: "pendiente",
              label: `Pendientes (${equipos.filter((e) => e.estado === "pendiente").length})`,
            },
            {
              value: "confirmado",
              label: `Confirmados (${equipos.filter((e) => e.estado === "confirmado").length})`,
            },
            { value: "deben", label: "Deben" },
          ]}
        />
        <Button size="sm" onClick={() => setNuevoAbierto(true)}>
          <Plus className="size-3.5" /> Registrar equipo
        </Button>
      </div>

      {visibles.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          {equipos.length === 0
            ? "Todavía no hay equipos. Regístralos tú o comparte el enlace público para que se inscriban solos."
            : "Ningún equipo coincide con este filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((e) => {
            const esperado = montoEsperadoEquipo(torneo, e);
            const saldo = saldoEquipo(torneo, e);
            return (
              <li
                key={e.id}
                className="border-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{e.nombre}</p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        CLASES_ESTADO[e.estado],
                      )}
                    >
                      {labelEstadoEquipo(e.estado)}
                    </span>
                    {nombreCategoria(e.categoria_id) && (
                      <span className="bg-muted inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {nombreCategoria(e.categoria_id)}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {e.responsable_nombre ?? "Sin responsable"}
                    {e.cantidad_jugadores ? ` · ${e.cantidad_jugadores} jugadores` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Pagó {formatCOP(e.monto_pagado)} de {formatCOP(esperado)}
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
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {e.responsable_telefono && (
                    <a
                      href={waLink(
                        e.responsable_telefono,
                        `Hola ${e.responsable_nombre ?? ""}, te escribo por la inscripción de ${e.nombre} al torneo ${torneo.nombre}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </a>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPlantillaDe(e)}>
                    <Users className="size-3.5" />
                    {jugadores.filter((j) => j.equipo_id === e.id).length || "Sin"} jugadores
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPagoDe(e)}>
                    <Wallet className="size-3.5" /> Pago
                  </Button>
                  {e.estado !== "confirmado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        accion(() => confirmarEquipoTorneo(e.id), "Equipo confirmado")
                      }
                    >
                      <Check className="size-3.5" /> Confirmar
                    </Button>
                  )}
                  {e.estado === "pendiente" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        accion(() => rechazarEquipoTorneo(e.id), "Solicitud rechazada")
                      }
                    >
                      <X className="size-3.5" /> Rechazar
                    </Button>
                  )}
                  {e.estado === "confirmado" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        accion(() => retirarEquipoTorneo(e.id), "Equipo retirado")
                      }
                    >
                      Retirar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
        jugadores: plantilla.filter((j) => j.nombre.trim() || j.documento.trim()),
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
        lista.filter((j) => j.nombre.trim() || j.documento.trim()),
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
