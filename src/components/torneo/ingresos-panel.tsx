"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  actualizarIngresoTorneo,
  crearIngresoTorneo,
  eliminarIngresoTorneo,
  registrarPagoGrupal,
} from "@/actions/torneos";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { AreaTexto, Campo, Segmentado, Selector } from "@/components/torneo/campos";
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
import { formatCOP, saldoEquipo } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type { EquipoTorneo, IngresoTorneo, PatrocinadorTorneo, Torneo } from "@/types";

const LABEL_TIPO: Record<IngresoTorneo["tipo"], string> = {
  arbitraje: "Arbitraje",
  patrocinio: "Patrocinio",
  otro: "Otro ingreso",
};

const hoyCO = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

/**
 * Ingresos del torneo aparte de las inscripciones (arbitraje, patrocinios,
 * otros) y el pago agrupado de varios equipos, que queda como abono en cada
 * equipo para que todo cuadre en las dos partes.
 */
export function IngresosPanel({
  torneo,
  ingresos,
  equipos,
  patrocinadores,
}: {
  torneo: Torneo;
  ingresos: IngresoTorneo[];
  equipos: EquipoTorneo[];
  patrocinadores: PatrocinadorTorneo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<IngresoTorneo | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const total = ingresos.reduce((s, i) => s + i.valor, 0);
  const patrocinador = (id: string | null) => patrocinadores.find((p) => p.id === id)?.nombre;

  function alternarRecibido(i: IngresoTorneo) {
    startTransition(async () => {
      const r = await actualizarIngresoTorneo(i.id, {
        tipo: i.tipo,
        descripcion: i.descripcion,
        valor: i.valor,
        recibido: !i.recibido,
        fecha: i.fecha,
        patrocinador_id: i.patrocinador_id,
      });
      if (!r.success) return void toast.error(r.error);
      router.refresh();
    });
  }

  function borrar(i: IngresoTorneo) {
    if (i.encuentro_id && !confirm("Es el arbitraje de un partido: el partido quedará sin pagar. ¿Borrarlo?")) return;
    startTransition(async () => {
      const r = await eliminarIngresoTorneo(i.id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Ingreso eliminado");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Otros ingresos <span className="text-muted-foreground font-normal">({formatCOP(total)})</span>
        </p>
        <Button size="sm" onClick={() => setNuevo(true)}>
          <Plus className="size-3.5" /> Agregar ingreso
        </Button>
      </div>

      {ingresos.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Pagos de equipos, arbitraje cobrado, patrocinios u otros. Los pagos de equipos quedan como
          abonos de cada equipo; el resto suma aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ingresos.map((i) => (
            <li key={i.id} className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
              <button type="button" onClick={() => setEditando(i)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">
                  {LABEL_TIPO[i.tipo]}
                  {i.tipo === "patrocinio" && patrocinador(i.patrocinador_id) ? (
                    <span className="text-muted-foreground font-normal"> · {patrocinador(i.patrocinador_id)}</span>
                  ) : null}
                  {i.descripcion ? <span className="text-muted-foreground font-normal"> · {i.descripcion}</span> : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatCOP(i.valor)} · {i.fecha.split("-").reverse().join("/")}
                  {i.encuentro_id ? " · de un partido" : ""}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => alternarRecibido(i)}
                  disabled={pending}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    i.recibido
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {i.recibido ? <Check className="size-3" /> : null}
                  {i.recibido ? "Recibido" : "Por recibir"}
                </button>
                <button
                  type="button"
                  onClick={() => borrar(i)}
                  disabled={pending}
                  aria-label={`Eliminar ${LABEL_TIPO[i.tipo]}`}
                  className="text-muted-foreground hover:text-destructive inline-flex size-7 items-center justify-center rounded-md"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <IngresoModal
        torneo={torneo}
        ingreso={editando}
        abierto={nuevo || editando !== null}
        equipos={equipos}
        patrocinadores={patrocinadores}
        onCerrar={() => {
          setNuevo(false);
          setEditando(null);
        }}
      />
    </section>
  );
}

type Tipo = "equipos" | IngresoTorneo["tipo"];

function IngresoModal({
  torneo,
  ingreso,
  abierto,
  equipos,
  patrocinadores,
  onCerrar,
}: {
  torneo: Torneo;
  ingreso: IngresoTorneo | null;
  abierto: boolean;
  equipos: EquipoTorneo[];
  patrocinadores: PatrocinadorTorneo[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<Tipo>("equipos");
  const [valor, setValor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyCO());
  const [recibido, setRecibido] = useState(true);
  const [patrocinadorId, setPatrocinadorId] = useState("");
  // Pago de equipos: monto por equipo marcado.
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia">("transferencia");
  const [repartir, setRepartir] = useState("");

  const idActual = ingreso?.id ?? "nuevo";
  if (abierto && idActual !== ultimoId) {
    setUltimoId(idActual);
    setTipo(ingreso?.tipo ?? "equipos");
    setValor(ingreso ? String(ingreso.valor) : "");
    setDescripcion(ingreso?.descripcion ?? "");
    setFecha(ingreso?.fecha ?? hoyCO());
    setRecibido(ingreso?.recibido ?? true);
    setPatrocinadorId(ingreso?.patrocinador_id ?? "");
    setMontos({});
    setRepartir("");
  }
  if (!abierto) return null;

  const conSaldo = equipos
    .filter((e) => (e.estado === "pendiente" || e.estado === "confirmado") && saldoEquipo(torneo, e) > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const marcados = Object.keys(montos);
  const totalEquipos = marcados.reduce((s, id) => s + (Number(montos[id]) || 0), 0);

  function marcar(e: EquipoTorneo) {
    setMontos((m) => {
      const n = { ...m };
      if (e.id in n) delete n[e.id];
      else n[e.id] = String(saldoEquipo(torneo, e));
      return n;
    });
  }

  /** Reparte un total en partes iguales entre los marcados (sin pasar el saldo de cada uno). */
  function repartirTotal() {
    const totalRep = Number(repartir) || 0;
    if (!totalRep || marcados.length === 0) return;
    const parte = Math.floor(totalRep / marcados.length);
    const resto = totalRep - parte * marcados.length;
    setMontos(Object.fromEntries(marcados.map((id, k) => [id, String(parte + (k === 0 ? resto : 0))])));
  }

  function guardar() {
    startTransition(async () => {
      if (tipo === "equipos") {
        const r = await registrarPagoGrupal(torneo.id, {
          metodo,
          nota: descripcion.trim() || null,
          pagos: marcados.map((id) => ({ equipoId: id, monto: Number(montos[id]) || 0 })),
        });
        if (!r.success) return void toast.error(r.error);
        toast.success(`Pago de ${r.data.equipos} equipo(s) por ${formatCOP(r.data.total)} registrado en cada equipo`);
      } else {
        const input = {
          tipo,
          descripcion: descripcion.trim() || null,
          valor: Number(valor) || 0,
          recibido,
          fecha,
          patrocinador_id: tipo === "patrocinio" ? patrocinadorId || null : null,
        };
        const r = ingreso ? await actualizarIngresoTorneo(ingreso.id, input) : await crearIngresoTorneo(torneo.id, input);
        if (!r.success) return void toast.error(r.error);
        toast.success(ingreso ? "Ingreso actualizado" : "Ingreso registrado");
      }
      setUltimoId(null);
      onCerrar();
      router.refresh();
    });
  }

  const opcionesTipo = [
    ...(ingreso ? [] : [{ value: "equipos", label: "Pago de equipos" }]),
    { value: "arbitraje", label: "Arbitraje" },
    { value: "patrocinio", label: "Patrocinio" },
    { value: "otro", label: "Otro" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ingreso ? "Editar ingreso" : "Agregar ingreso"}</DialogTitle>
          <DialogDescription>
            {tipo === "equipos"
              ? "Marca los equipos que pagaron: cada uno queda con su abono y su saldo al día."
              : "Dinero que entra aparte de las inscripciones: suma a los ingresos y a la utilidad."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {!ingreso?.encuentro_id && (
            <Campo label="Tipo">
              <Segmentado value={tipo} onChange={(v) => setTipo(v as Tipo)} options={opcionesTipo} />
            </Campo>
          )}

          {tipo === "equipos" ? (
            <>
              {conSaldo.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ningún equipo tiene saldo pendiente.</p>
              ) : (
                <ul className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-xl border">
                  {conSaldo.map((e) => {
                    const activo = e.id in montos;
                    return (
                      <li key={e.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => marcar(e)}
                          aria-label={`Pagó ${e.nombre}`}
                          className="size-4 shrink-0"
                        />
                        <button type="button" onClick={() => marcar(e)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm">{e.nombre}</p>
                          <p className="text-muted-foreground text-[11px]">Debe {formatCOP(saldoEquipo(torneo, e))}</p>
                        </button>
                        {activo && (
                          <div className="w-32 shrink-0">
                            <InputMoneda
                              value={montos[e.id]}
                              onChange={(v) => setMontos((m) => ({ ...m, [e.id]: v }))}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {marcados.length > 1 && (
                <div className="flex items-end gap-2">
                  <Campo label="Repartir un total en partes iguales" className="flex-1">
                    <InputMoneda value={repartir} onChange={setRepartir} placeholder="800.000" />
                  </Campo>
                  <Button type="button" size="sm" variant="outline" onClick={repartirTotal} disabled={!repartir}>
                    Repartir
                  </Button>
                </div>
              )}
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
              <Campo label="Nota (opcional)">
                <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Consignación del 11/11" />
              </Campo>
              <p className="text-sm font-semibold">
                Total: {formatCOP(totalEquipos)} · {marcados.length} equipo(s)
              </p>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tipo === "patrocinio" && (
                <Campo label="Patrocinador" className="sm:col-span-2" ayuda={patrocinadores.length === 0 ? "Aún no hay patrocinadores en este torneo: puedes dejarlo sin asignar." : undefined}>
                  <Selector value={patrocinadorId} onChange={setPatrocinadorId}>
                    <option value="">Sin asignar</option>
                    {patrocinadores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
              <Campo label="Valor (COP)">
                <InputMoneda value={valor} onChange={setValor} placeholder="500.000" />
              </Campo>
              <Campo label="Fecha">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Campo>
              <Campo label="Descripción (opcional)" className="sm:col-span-2">
                <AreaTexto value={descripcion} onChange={setDescripcion} rows={2} />
              </Campo>
              <Campo label="Estado" className="sm:col-span-2">
                <Segmentado
                  value={recibido ? "si" : "no"}
                  onChange={(v) => setRecibido(v === "si")}
                  options={[
                    { value: "si", label: "Recibido" },
                    { value: "no", label: "Por recibir" },
                  ]}
                />
              </Campo>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={pending || (tipo === "equipos" ? marcados.length === 0 || totalEquipos <= 0 : !valor)}
          >
            {tipo === "equipos" ? "Registrar pagos" : ingreso ? "Guardar cambios" : "Agregar ingreso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
