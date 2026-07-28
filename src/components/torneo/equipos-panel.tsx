"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, Plus, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import {
  confirmarEquipoTorneo,
  crearEquipoTorneo,
  marcarPagoEquipo,
  rechazarEquipoTorneo,
  retirarEquipoTorneo,
} from "@/actions/torneos";
import { Campo, Segmentado } from "@/components/torneo/campos";
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
import type { EquipoTorneo, EstadoEquipoTorneo, Torneo } from "@/types";

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
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
}) {
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
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {e.responsable_nombre ?? "Sin responsable"}
                    {e.cantidad_jugadores ? ` · ${e.cantidad_jugadores} jugadores` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Pagó {formatCOP(e.monto_pagado)} de {formatCOP(esperado)}
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

      <NuevoEquipoModal
        torneo={torneo}
        abierto={nuevoAbierto}
        onCerrar={() => setNuevoAbierto(false)}
      />
      <PagoEquipoModal
        torneo={torneo}
        equipo={pagoDe}
        onCerrar={() => setPagoDe(null)}
      />
    </section>
  );
}

/** Alta manual de un equipo (el organizador ya tiene los datos). */
function NuevoEquipoModal({
  torneo,
  abierto,
  onCerrar,
}: {
  torneo: Torneo;
  abierto: boolean;
  onCerrar: () => void;
}) {
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

/** Registro del pago de la inscripción (admite abonos parciales). */
function PagoEquipoModal({
  torneo,
  equipo,
  onCerrar,
}: {
  torneo: Torneo;
  equipo: EquipoTorneo | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia">("transferencia");

  // Sincroniza el formulario al abrir con otro equipo.
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  if (equipo && equipo.id !== ultimoId) {
    setUltimoId(equipo.id);
    setMonto(String(equipo.monto_pagado || ""));
    setMetodo(equipo.metodo_pago ?? "transferencia");
  }

  if (!equipo) return null;
  const esperado = montoEsperadoEquipo(torneo, equipo);

  function guardar() {
    if (!equipo) return;
    startTransition(async () => {
      const r = await marcarPagoEquipo(equipo.id, {
        monto_pagado: Number(monto) || 0,
        metodo_pago: metodo,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Pago actualizado");
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pago de {equipo.nombre}</DialogTitle>
          <DialogDescription>
            Inscripción de {formatCOP(esperado)}. Puedes registrar abonos parciales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Campo label="Monto pagado (COP)">
            <InputMoneda value={monto} onChange={setMonto} placeholder="0" />
          </Campo>
          <Campo label="Medio de pago">
            <Segmentado
              value={metodo}
              onChange={(v) => setMetodo(v as "efectivo" | "transferencia")}
              options={[
                { value: "transferencia", label: "Transferencia" },
                { value: "efectivo", label: "Efectivo" },
              ]}
            />
          </Campo>
          <button
            type="button"
            onClick={() => setMonto(String(esperado))}
            className="text-primary self-start text-xs font-medium hover:underline"
          >
            Marcar como pagado completo ({formatCOP(esperado)})
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending}>
            Guardar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
