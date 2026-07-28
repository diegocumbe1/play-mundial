"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  actualizarGastoTorneo,
  crearGastoTorneo,
  eliminarGastoTorneo,
} from "@/actions/torneos";
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
import { InputMoneda } from "@/components/rifa/input-moneda";
import { CATEGORIAS_GASTO, formatCOP, labelCategoriaGasto } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type { GastoTorneo } from "@/types";

/**
 * Gastos del torneo: lo que define si el evento deja utilidad. Se registran
 * presupuestados y se marcan como pagados a medida que se ejecutan.
 */
export function GastosPanel({
  torneoId,
  gastos,
}: {
  torneoId: string;
  gastos: GastoTorneo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<GastoTorneo | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  function alternarPagado(gasto: GastoTorneo) {
    startTransition(async () => {
      const r = await actualizarGastoTorneo(gasto.id, {
        categoria: gasto.categoria,
        descripcion: gasto.descripcion,
        cantidad: gasto.cantidad,
        valor_unitario: gasto.valor_unitario,
        valor_total: gasto.valor_total,
        pagado: !gasto.pagado,
        proveedor: gasto.proveedor,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const r = await eliminarGastoTorneo(id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Gasto eliminado");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Gastos <span className="text-muted-foreground font-normal">({gastos.length})</span>
        </p>
        <Button size="sm" onClick={() => setNuevoAbierto(true)}>
          <Plus className="size-3.5" /> Agregar gasto
        </Button>
      </div>

      {gastos.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          Sin gastos registrados. Agrega la cancha, el arbitraje y la premiación para saber
          si el torneo es rentable.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {gastos.map((g) => (
            <li
              key={g.id}
              className="border-border flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <button
                type="button"
                onClick={() => setEditando(g)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">
                  {labelCategoriaGasto(g.categoria)}
                  {g.descripcion ? (
                    <span className="text-muted-foreground font-normal"> · {g.descripcion}</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatCOP(g.valor_total)}
                  {g.cantidad && g.valor_unitario
                    ? ` · ${g.cantidad} × ${formatCOP(g.valor_unitario)}`
                    : ""}
                  {g.proveedor ? ` · ${g.proveedor}` : ""}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => alternarPagado(g)}
                  disabled={pending}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    g.pagado
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {g.pagado ? <Check className="size-3" /> : null}
                  {g.pagado ? "Pagado" : "Por pagar"}
                </button>
                <button
                  type="button"
                  onClick={() => borrar(g.id)}
                  disabled={pending}
                  aria-label={`Eliminar ${labelCategoriaGasto(g.categoria)}`}
                  className="text-muted-foreground hover:text-destructive inline-flex size-7 items-center justify-center rounded-md"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <GastoModal
        torneoId={torneoId}
        gasto={editando}
        abierto={nuevoAbierto || editando !== null}
        onCerrar={() => {
          setNuevoAbierto(false);
          setEditando(null);
        }}
      />
    </section>
  );
}

/** Alta y edición de un gasto. El total se autocalcula si hay cantidad × unitario. */
function GastoModal({
  torneoId,
  gasto,
  abierto,
  onCerrar,
}: {
  torneoId: string;
  gasto: GastoTorneo | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("alquiler_cancha");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unitario, setUnitario] = useState("");
  const [total, setTotal] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [pagado, setPagado] = useState(false);

  // Rellena el formulario al abrir con otro gasto (o al crear uno nuevo).
  const idActual = gasto?.id ?? "nuevo";
  if (abierto && idActual !== ultimoId) {
    setUltimoId(idActual);
    setCategoria(gasto?.categoria ?? "alquiler_cancha");
    setDescripcion(gasto?.descripcion ?? "");
    setCantidad(gasto?.cantidad != null ? String(gasto.cantidad) : "");
    setUnitario(gasto?.valor_unitario != null ? String(gasto.valor_unitario) : "");
    setTotal(gasto?.valor_total != null ? String(gasto.valor_total) : "");
    setProveedor(gasto?.proveedor ?? "");
    setPagado(gasto?.pagado ?? false);
  }

  /** Al llenar cantidad y unitario, el total se propone solo. */
  function recalcular(nuevaCantidad: string, nuevoUnitario: string) {
    const c = Number(nuevaCantidad);
    const u = Number(nuevoUnitario);
    if (c > 0 && u > 0) setTotal(String(Math.round(c * u)));
  }

  function guardar() {
    const input = {
      categoria,
      descripcion: descripcion.trim() || null,
      cantidad: cantidad ? Number(cantidad) : null,
      valor_unitario: unitario ? Number(unitario) : null,
      valor_total: Number(total) || 0,
      pagado,
      proveedor: proveedor.trim() || null,
    };

    startTransition(async () => {
      const r = gasto
        ? await actualizarGastoTorneo(gasto.id, input)
        : await crearGastoTorneo(torneoId, input);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(gasto ? "Gasto actualizado" : "Gasto registrado");
      setUltimoId(null);
      onCerrar();
      router.refresh();
    });
  }

  if (!abierto) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gasto ? "Editar gasto" : "Agregar gasto"}</DialogTitle>
          <DialogDescription>
            Registra el presupuesto aunque todavía no lo hayas pagado: así la utilidad
            proyectada es real.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Categoría" className="sm:col-span-2">
            <Selector value={categoria} onChange={setCategoria}>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo label="Descripción (opcional)" className="sm:col-span-2">
            <AreaTexto
              value={descripcion}
              onChange={setDescripcion}
              rows={2}
              placeholder="8 fechas de cancha, 2 horas cada una"
            />
          </Campo>
          <Campo label="Cantidad (opcional)">
            <Input
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setCantidad(v);
                recalcular(v, unitario);
              }}
              placeholder="8"
            />
          </Campo>
          <Campo label="Valor unitario (opcional)">
            <InputMoneda
              value={unitario}
              onChange={(v) => {
                setUnitario(v);
                recalcular(cantidad, v);
              }}
              placeholder="120.000"
            />
          </Campo>
          <Campo label="Valor total (COP)">
            <InputMoneda value={total} onChange={setTotal} placeholder="960.000" />
          </Campo>
          <Campo label="Proveedor (opcional)">
            <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          </Campo>
          <Campo label="Estado" className="sm:col-span-2">
            <Segmentado
              value={pagado ? "si" : "no"}
              onChange={(v) => setPagado(v === "si")}
              options={[
                { value: "no", label: "Por pagar" },
                { value: "si", label: "Pagado" },
              ]}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || !total}>
            {gasto ? "Guardar cambios" : "Agregar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
