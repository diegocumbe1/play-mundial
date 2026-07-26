"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { solicitarSuscripcion } from "@/actions/cobros";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/rifa";
import { labelCuentaPago } from "@/lib/pagos";
import { waLink } from "@/lib/whatsapp";
import type { PlataformaPagoConfig } from "@/types";

export function PlanActionButton({
  plan,
  logueado,
  montoSuscripcion,
}: {
  plan: "gratis" | "pago_rifa" | "suscripcion";
  logueado: boolean;
  montoSuscripcion: number;
}) {
  const [pending, startTransition] = useTransition();
  const [pago, setPago] = useState<PlataformaPagoConfig | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  if (plan !== "suscripcion") {
    return (
      <Link
        href={logueado ? "/admin/rifas/nueva" : "/admin/login?next=/admin/rifas/nueva"}
        className={buttonVariants({
          variant: plan === "pago_rifa" ? "default" : "outline",
          className: "mt-auto w-full",
        })}
      >
        {plan === "gratis" ? "Empezar gratis" : "Crear rifa"}
      </Link>
    );
  }

  if (!logueado) {
    return (
      <Link
        href="/admin/login?next=/precios"
        className={buttonVariants({ variant: "outline", className: "mt-auto w-full" })}
      >
        Elegir suscripción
      </Link>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="mt-auto w-full"
        onClick={() =>
          startTransition(async () => {
            const r = await solicitarSuscripcion();
            if (!r.success) {
              toast.error(r.error);
              return;
            }
            setPago(r.data.pago);
            setConfirmado(true);
            toast.success("Solicitud de suscripción enviada");
          })
        }
      >
        Elegir suscripción
      </Button>

      <Dialog open={confirmado} onOpenChange={setConfirmado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="text-emerald-500 size-5" /> Suscripción solicitada
            </DialogTitle>
            <DialogDescription>
              Transfiere {formatCOP(montoSuscripcion)} y el administrador habilitará tu mes al confirmar el pago.
            </DialogDescription>
          </DialogHeader>
          <PaymentDetails pago={pago} monto={montoSuscripcion} />
          <DialogFooter>
            <Button onClick={() => setConfirmado(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentDetails({ pago, monto }: { pago: PlataformaPagoConfig | null; monto: number }) {
  const cuentaNumero = pago?.cuenta_numero ?? pago?.nequi_llave ?? null;
  const cuentaLabel = labelCuentaPago(pago?.cuenta_tipo ?? (pago?.nequi_llave ? "nequi" : null));

  if (!pago || (!cuentaNumero && !pago.llave && !pago.qr_url)) {
    return (
      <p className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
        Aún no hay medios de pago visibles. Contacta al administrador para coordinar la transferencia.
      </p>
    );
  }

  const mensaje =
    pago.mensaje_qr?.trim() ||
    `Hola, ya realicé la transferencia por ${formatCOP(monto)} para activar mi suscripción.`;

  return (
    <div className="border-border grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-[auto_1fr]">
      {pago.qr_url && (
        <div className="sm:row-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pago.qr_url} alt="QR de pago" width={112} height={112} className="border-border size-28 rounded-lg border object-cover" />
        </div>
      )}
      <div className="space-y-2">
        {pago.titular && <PaymentLine label="Titular" value={pago.titular} />}
        {cuentaNumero && <PaymentLine label={cuentaLabel} value={cuentaNumero} copy />}
        {pago.llave && <PaymentLine label="Llave Bre-B" value={pago.llave} copy />}
        {pago.whatsapp && (
          <a
            href={waLink(pago.whatsapp, mensaje)}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:underline dark:text-emerald-400 inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <MessageCircle className="size-3.5" /> Enviar comprobante por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function PaymentLine({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Dato copiado");
    } catch {
      window.prompt("Copia este dato de pago:", value);
    }
  }

  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <b>{value}</b>
      {copy && (
        <button type="button" onClick={copiar} aria-label={`Copiar ${label}`} className="text-muted-foreground hover:text-foreground">
          <Copy className="size-3.5" />
        </button>
      )}
    </p>
  );
}
