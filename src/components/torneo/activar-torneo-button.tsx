"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, MessageCircle, Rocket } from "lucide-react";
import { toast } from "sonner";

import { activarTorneo } from "@/actions/torneos";
import { solicitarSuscripcion } from "@/actions/cobros";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/torneos";
import { labelCuentaPago } from "@/lib/pagos";
import { waLink } from "@/lib/whatsapp";
import type { PlataformaPagoConfig } from "@/types";

/**
 * Activa el torneo aplicando cuota/plan. Si requiere pago, muestra el cobro
 * pendiente con los datos de transferencia (mismo flujo que las rifas).
 */
export function ActivarTorneoButton({ torneoId }: { torneoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [montoPendiente, setMontoPendiente] = useState<number | null>(null);
  const [pago, setPago] = useState<PlataformaPagoConfig | null>(null);

  function activar() {
    startTransition(async () => {
      const r = await activarTorneo(torneoId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      if (r.data.activado) {
        toast.success("¡Torneo publicado! Ya puedes compartir el enlace de inscripción.");
        router.refresh();
      } else {
        setMontoPendiente(r.data.monto ?? 0);
        setPago(r.data.pago ?? null);
      }
    });
  }

  return (
    <>
      <Button size="lg" onClick={activar} disabled={pending}>
        <Rocket className="size-4" /> Publicar y abrir inscripciones
      </Button>

      <Dialog
        open={montoPendiente !== null}
        onOpenChange={(o) => !o && setMontoPendiente(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Este torneo requiere pago</DialogTitle>
            <DialogDescription>
              Ya usaste tu cupo gratuito. Para publicarlo, transfiere{" "}
              <b>{montoPendiente != null ? formatCOP(montoPendiente) : ""}</b> y el
              administrador lo activará al confirmar el pago.
            </DialogDescription>
          </DialogHeader>
          <DatosPago pago={pago} monto={montoPendiente ?? 0} />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await solicitarSuscripcion();
                  if (!r.success) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Solicitud de suscripción enviada");
                  setPago(r.data.pago);
                  setMontoPendiente(null);
                })
              }
            >
              Quiero suscripción
            </Button>
            <Button
              onClick={() => {
                setMontoPendiente(null);
                router.refresh();
              }}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DatosPago({
  pago,
  monto,
}: {
  pago: PlataformaPagoConfig | null;
  monto: number;
}) {
  const cuentaNumero = pago?.cuenta_numero ?? pago?.nequi_llave ?? null;
  const cuentaLabel = labelCuentaPago(
    pago?.cuenta_tipo ?? (pago?.nequi_llave ? "nequi" : null),
  );

  if (!pago || (!cuentaNumero && !pago.llave && !pago.qr_url)) {
    return (
      <p className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
        Aún no hay medios de pago visibles. Contacta al administrador para coordinar la
        transferencia.
      </p>
    );
  }

  const mensaje =
    pago.mensaje_qr?.trim() ||
    `Hola, ya realicé la transferencia por ${formatCOP(monto)} para publicar mi torneo.`;

  return (
    <div className="border-border grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-[auto_1fr]">
      {pago.qr_url && (
        <div className="sm:row-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pago.qr_url}
            alt="QR de pago"
            width={112}
            height={112}
            className="border-border size-28 rounded-lg border object-cover"
          />
        </div>
      )}
      <div className="space-y-2">
        {pago.titular && <LineaPago label="Titular" value={pago.titular} />}
        {cuentaNumero && (
          <LineaPago label={cuentaLabel} value={cuentaNumero} onCopy={copiar} />
        )}
        {pago.llave && <LineaPago label="Llave" value={pago.llave} onCopy={copiar} />}
        {pago.whatsapp && (
          <a
            href={waLink(pago.whatsapp, mensaje)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <MessageCircle className="size-3.5" /> Enviar comprobante por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function LineaPago({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: (value: string) => void;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <b>{value}</b>
      {onCopy && (
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center"
          aria-label={`Copiar ${label}`}
        >
          <Copy className="size-3.5" />
        </button>
      )}
    </p>
  );
}

async function copiar(valor: string) {
  try {
    await navigator.clipboard.writeText(valor);
    toast.success("Dato copiado");
  } catch {
    window.prompt("Copia este dato de pago:", valor);
  }
}
