"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, MessageCircle, Pencil, PiggyBank, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  abonarBoleta,
  actualizarBoleta,
  cambiarMetodoPagoBoleta,
  eliminarAbonoBoleta,
  getAbonosBoleta,
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
import { InputMoneda } from "@/components/rifa/input-moneda";
import { VerificarEmailModal } from "@/components/rifa/verificar-email-modal";
import { Campo, Segmentado } from "@/components/torneo/campos";
import { esErrorDeVerificacion } from "@/lib/errores";
import type { AbonoBoleta, Boleta, MetodoPago, Rifa } from "@/types";

const METODO_LABEL: Record<MetodoPago, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};

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
  // Por defecto transferencia: es como paga la mayoría.
  const [metodo, setMetodo] = useState<MetodoPago>(boleta?.metodo_pago ?? "transferencia");
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [pidiendoVerificacion, setPidiendoVerificacion] = useState(false);
  /** Separar con saldo: abono al apartar, o el siguiente abono de un apartado. */
  const [abono, setAbono] = useState("");
  const [abonos, setAbonos] = useState<AbonoBoleta[]>([]);

  const precio = rifa?.precio_boleta ?? 0;
  const abonado = boleta?.monto_abonado ?? 0;
  const saldo = Math.max(0, precio - abonado);
  const abonoNum = Number(abono) || 0;
  // Cuota mínima del organizador (salvo que falte menos que eso).
  const cuotaMin = rifa?.permite_abonos && rifa.abono_minimo ? rifa.abono_minimo : 0;
  const abonoBajo = abonoNum > 0 && abonoNum < Math.min(cuotaMin, boleta ? saldo : precio);

  // El historial de abonos solo se trae si el número tiene alguno.
  useEffect(() => {
    if (!open || !boleta || abonado <= 0) return;
    let vigente = true;
    void getAbonosBoleta(boleta.id).then((r) => {
      if (vigente && r.success) setAbonos(r.data);
    });
    return () => {
      vigente = false;
    };
  }, [open, boleta, abonado]);

  function correr(
    accion: () => Promise<{ success: boolean; error?: string }>,
    ok: string,
  ) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        // Sin correo verificado no se puede tocar ningún número: en vez de un
        // error técnico, se explica qué hacer.
        if (esErrorDeVerificacion(r.error)) {
          setPidiendoVerificacion(true);
          return;
        }
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
            : abonado > 0
              ? `Tienes separado el número ${formatNumero(boleta.numero, ancho)}: llevas abonado ${formatCOP(abonado)} y te falta ${formatCOP(saldo)}. Recuerda que el número solo juega cuando esté pago completo.`
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
    <>
    <VerificarEmailModal open={pidiendoVerificacion} onOpenChange={setPidiendoVerificacion} />
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Número {etiqueta}</DialogTitle>
          <DialogDescription>
            {boleta
              ? `${boleta.comprador_nombre ?? "Sin nombre"}${
                  boleta.comprador_telefono ? ` · ${boleta.comprador_telefono}` : ""
                }${boleta.responsable_venta ? ` · responsable: ${boleta.responsable_venta}` : ""} — ${
                  boleta.estado === "pagado"
                    ? "pagado"
                    : abonado > 0
                      ? `separado con abonos (falta ${formatCOP(saldo)})`
                      : "apartado (sin pagar)"
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
                placeholder=""
              />
            </div>
            {!boleta && precio > 0 && (
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs">
                  Separar con abono (opcional)
                </Label>
                <InputMoneda
                  value={abono}
                  onChange={setAbono}
                  placeholder={cuotaMin ? `Mínimo ${cuotaMin.toLocaleString("es-CO")}` : "Ej. 50.000"}
                />
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Lo que deja hoy para separar el número. Queda debiendo{" "}
                  {formatCOP(Math.max(0, precio - abonoNum))} y lo puede seguir abonando.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Apartado que abona por partes: cuánto lleva, cuánto falta y el
            siguiente abono. El medio de pago es el de arriba. */}
        {boleta && boleta.estado !== "pagado" && !editando && !confirmandoLiberar && precio > 0 && (
          <div className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Abonado</span>
              <span>
                <b>{formatCOP(abonado)}</b>{" "}
                <span className="text-muted-foreground text-xs">de {formatCOP(precio)} · falta {formatCOP(saldo)}</span>
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${precio > 0 ? Math.min(100, (abonado / precio) * 100) : 0}%` }}
              />
            </div>
            {abonos.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs">
                {abonos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("es-CO")} · {METODO_LABEL[a.metodo]}
                    </span>
                    <span className="flex items-center gap-1">
                      <b>{formatCOP(a.monto)}</b>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => correr(() => eliminarAbonoBoleta(a.id), "Abono eliminado")}
                        aria-label="Eliminar abono"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <InputMoneda value={abono} onChange={setAbono} placeholder="Nuevo abono" />
              <Button
                type="button"
                variant="outline"
                disabled={pending || abonoNum <= 0 || abonoNum > saldo || abonoBajo}
                onClick={() =>
                  correr(
                    () => abonarBoleta({ boleta_id: boleta.id, monto: abonoNum, metodo }),
                    abonoNum === saldo ? "Abono registrado: número pagado" : "Abono registrado",
                  )
                }
              >
                <PiggyBank className="size-4" /> Abonar
              </Button>
            </div>
            {abonoBajo && (
              <p className="text-destructive text-[11px]">La cuota mínima es {formatCOP(cuotaMin)}.</p>
            )}
            {abonoNum > saldo && (
              <p className="text-destructive text-[11px]">El abono supera lo que falta ({formatCOP(saldo)}).</p>
            )}
          </div>
        )}

        {/* Medio de pago: al cobrar se elige; si ya está pagado, tocar el otro
            lo corrige al instante (sin cerrar el modal). */}
        {(!boleta || (!editando && !confirmandoLiberar)) && (
          <Campo
            label={
              boleta?.estado === "pagado"
                ? "Pagó con"
                : abonoNum > 0
                  ? "El abono lo hizo por"
                  : "Si ya pagó, ¿cómo?"
            }
          >
            <Segmentado
              value={metodo}
              onChange={(v) => {
                const nuevo = v as MetodoPago;
                if (boleta?.estado !== "pagado") {
                  setMetodo(nuevo);
                  return;
                }
                if (nuevo === metodo || pending) return;
                const anterior = metodo;
                setMetodo(nuevo);
                startTransition(async () => {
                  const r = await cambiarMetodoPagoBoleta(boleta.id, nuevo);
                  if (!r.success) {
                    setMetodo(anterior);
                    if (esErrorDeVerificacion(r.error)) setPidiendoVerificacion(true);
                    else toast.error(r.error);
                    return;
                  }
                  toast.success(`Medio cambiado a ${METODO_LABEL[nuevo].toLowerCase()}`);
                  router.refresh();
                });
              }}
              options={[
                { value: "transferencia", label: METODO_LABEL.transferencia },
                { value: "efectivo", label: METODO_LABEL.efectivo },
              ]}
            />
          </Campo>
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

        <DialogFooter className="sm:flex-wrap">
          {!boleta ? (
            <>
              <Button
                variant="outline"
                disabled={pending || !nombre.trim() || abonoBajo}
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
                        metodo_pago: abonoNum > 0 ? metodo : null,
                        abono: Math.min(abonoNum, precio || abonoNum),
                      }),
                    abonoNum > 0 ? "Número separado con abono" : "Número apartado",
                  )
                }
              >
                <Clock className="size-4" /> {abonoNum > 0 ? "Separar con abono" : "Apartar"}
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
                        metodo_pago: metodo,
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
              {/* Liberar va aparte, a la izquierda, lejos de las acciones de cobro. */}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirmandoLiberar(true)}
                className="text-destructive hover:text-destructive sm:mr-auto"
              >
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
                    correr(() => marcarPagoBoleta(boleta.id, true, metodo), "Pago registrado")
                  }
                >
                  <Check className="size-4" /> {abonado > 0 ? `Pagar saldo (${formatCOP(saldo)})` : "Marcar pagado"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
