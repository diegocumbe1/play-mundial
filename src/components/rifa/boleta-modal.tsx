"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  actualizarBoleta,
  liberarBoleta,
  marcarPagoBoleta,
  registrarBoletaAdmin,
} from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Boleta } from "@/types";

/**
 * Modal único para gestionar un número de la rifa. Se reusa desde la grilla y
 * desde el listado de participantes: TODO cambio de estado (pagar, volver a
 * pendiente, liberar) pasa por aquí, nunca con un solo toque en la lista.
 */
export function BoletaModal({
  rifaId,
  numero,
  boleta,
  ancho,
  open,
  onClose,
}: {
  rifaId: string;
  numero: number | null;
  /** Boleta existente; `undefined` si el número está libre. */
  boleta?: Boleta;
  /** Dígitos para mostrar el número (ej. 2 → "07"). */
  ancho: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);
  const [editando, setEditando] = useState(false);

  // Al abrir/cambiar de número, limpia el formulario y las confirmaciones.
  useEffect(() => {
    if (open) {
      setNombre(boleta?.comprador_nombre ?? "");
      setTelefono(boleta?.comprador_telefono ?? "");
      setConfirmandoLiberar(false);
      setEditando(false);
    }
    // `boleta` cambia de identidad al refrescar; basta con el número.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, numero]);

  function correr(
    accion: () => Promise<{ success: boolean; error?: string }>,
    ok: string,
  ) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      onClose();
      router.refresh();
    });
  }

  const etiqueta = numero != null ? String(numero).padStart(ancho, "0") : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Número {etiqueta}</DialogTitle>
          <DialogDescription>
            {boleta
              ? `${boleta.comprador_nombre ?? "Sin nombre"}${
                  boleta.comprador_telefono ? ` · ${boleta.comprador_telefono}` : ""
                } — ${boleta.estado === "pagado" ? "pagado" : "apartado (sin pagar)"}`
              : "Registra a quién le vendiste este número."}
          </DialogDescription>
        </DialogHeader>

        {(!boleta || editando) && (
          <div className="flex flex-col gap-3">
            <div>
              <Label className="text-muted-foreground mb-1.5 block text-xs">Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del comprador"
              />
            </div>
            <div>
              <Label className="text-muted-foreground mb-1.5 block text-xs">
                Teléfono (opcional)
              </Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="300 000 0000"
                inputMode="tel"
              />
            </div>
          </div>
        )}

        {/* Confirmación extra para liberar (borra la venta). */}
        {boleta && confirmandoLiberar && (
          <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
            Vas a liberar el número {etiqueta} y se borrarán los datos de{" "}
            <b>{boleta.comprador_nombre ?? "esta persona"}</b>. ¿Seguro?
          </p>
        )}

        <DialogFooter>
          {!boleta ? (
            <>
              <Button
                variant="outline"
                disabled={pending || !nombre.trim()}
                onClick={() =>
                  correr(
                    () =>
                      registrarBoletaAdmin({
                        rifa_id: rifaId,
                        numero: numero!,
                        comprador_nombre: nombre.trim(),
                        comprador_telefono: telefono.trim() || null,
                        pagado: false,
                      }),
                    "Número apartado",
                  )
                }
              >
                <Clock className="size-4" /> Apartar
              </Button>
              <Button
                disabled={pending || !nombre.trim()}
                onClick={() =>
                  correr(
                    () =>
                      registrarBoletaAdmin({
                        rifa_id: rifaId,
                        numero: numero!,
                        comprador_nombre: nombre.trim(),
                        comprador_telefono: telefono.trim() || null,
                        pagado: true,
                        metodo_pago: "efectivo",
                      }),
                    "Número pagado",
                  )
                }
              >
                <Check className="size-4" /> Registrar pagado
              </Button>
            </>
          ) : editando ? (
            <>
              <Button variant="ghost" disabled={pending} onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button
                disabled={pending || !nombre.trim()}
                onClick={() =>
                  correr(
                    () =>
                      actualizarBoleta(boleta.id, {
                        comprador_nombre: nombre.trim(),
                        comprador_telefono: telefono.trim() || null,
                      }),
                    "Datos actualizados",
                  )
                }
              >
                <Check className="size-4" /> Guardar cambios
              </Button>
            </>
          ) : confirmandoLiberar ? (
            <>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirmandoLiberar(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => correr(() => liberarBoleta(boleta.id), "Número liberado")}
              >
                <Trash2 className="size-4" /> Sí, liberar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirmandoLiberar(true)}>
                <Trash2 className="size-4" /> Liberar
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => setEditando(true)}>
                <Pencil className="size-4" /> Editar datos
              </Button>
              {boleta.estado === "pagado" ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => correr(() => marcarPagoBoleta(boleta.id, false), "Marcado pendiente")}
                >
                  Marcar pendiente
                </Button>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() =>
                    correr(() => marcarPagoBoleta(boleta.id, true, "efectivo"), "Pago registrado")
                  }
                >
                  <Check className="size-4" /> Marcar pagado
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
