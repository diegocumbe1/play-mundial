"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, MessageCircle, Pencil, Trash2 } from "lucide-react";
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
import { formatCOP, formatNumero } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { urlPublicaRifa } from "@/lib/site-url";
import { waLink } from "@/lib/whatsapp";
import type { Boleta, Rifa } from "@/types";

/**
 * Modal único para gestionar un número de la rifa. Se reusa desde la grilla y
 * desde el listado de participantes: TODO cambio de estado (pagar, volver a
 * pendiente, liberar) pasa por aquí, nunca con un solo toque en la lista.
 */
export function BoletaModal({
  rifaId,
  rifa,
  numero,
  boleta,
  ancho,
  open,
  onClose,
}: {
  rifaId: string;
  /** Rifa a la que pertenece: da el enlace público y los datos del recordatorio. */
  rifa?: Rifa;
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
  const [nombre, setNombre] = useState(boleta?.comprador_nombre ?? "");
  const [telefono, setTelefono] = useState(boleta?.comprador_telefono ?? "");
  const [responsable, setResponsable] = useState(boleta?.responsable_venta ?? "");
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);
  const [editando, setEditando] = useState(false);

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

  // Recordatorio listo para mandar: mismo texto que en la lista de participantes.
  const fechaJuego = rifa
    ? formatFechaCO(
        rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo,
        { conAnio: false },
      )
    : null;
  const mensajeRecordatorio =
    rifa && boleta
      ? [
          `Hola ${boleta.comprador_nombre ?? ""}, te escribo por la rifa "${rifa.nombre}".`,
          boleta.estado === "pagado"
            ? `Tu número ${formatNumero(boleta.numero, ancho)} está pago y confirmado.`
            : `Tienes apartado el número ${formatNumero(boleta.numero, ancho)} y queda pendiente ${formatCOP(rifa.precio_boleta)}.`,
          fechaJuego ? `El sorteo es el ${fechaJuego}.` : "",
          boleta.estado === "pagado" ? "Sigue la rifa aquí 👇" : "Aquí ves tu número y cómo pagar 👇",
          urlPublicaRifa(rifa.slug_publico, [boleta.numero]),
          boleta.estado === "pagado" ? "¡Mucha suerte! 🍀" : "¡Gracias! 🙌",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Número {etiqueta}</DialogTitle>
          <DialogDescription>
            {boleta
              ? `${boleta.comprador_nombre ?? "Sin nombre"}${
                  boleta.comprador_telefono ? ` · ${boleta.comprador_telefono}` : ""
                }${boleta.responsable_venta ? ` · responsable: ${boleta.responsable_venta}` : ""} — ${
                  boleta.estado === "pagado" ? "pagado" : "apartado (sin pagar)"
                }`
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
            <div>
              <Label className="text-muted-foreground mb-1.5 block text-xs">
                Responsable de venta (opcional)
              </Label>
              <Input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Diego Cumbe"
              />
            </div>
          </div>
        )}

        {/* Con el teléfono ya guardado, escribirle es un toque: no hay que salir
            a buscar el número ni copiar nada. */}
        {boleta?.comprador_telefono && mensajeRecordatorio && !editando && (
          <a
            href={waLink(boleta.comprador_telefono, mensajeRecordatorio)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <MessageCircle className="size-4" />
            {boleta.estado === "pagado" ? "Escribir por WhatsApp" : "Recordar el pago por WhatsApp"}
          </a>
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
                        responsable_venta: responsable.trim() || null,
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
                        responsable_venta: responsable.trim() || null,
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
                        responsable_venta: responsable.trim() || null,
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
