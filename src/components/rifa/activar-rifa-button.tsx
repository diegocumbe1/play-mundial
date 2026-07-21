"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { activarRifa } from "@/actions/rifas";
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
import { formatCOP } from "@/lib/rifa";

/** Activa la rifa aplicando la cuota/plan. Si requiere pago, muestra el cobro. */
export function ActivarRifaButton({ rifaId }: { rifaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [montoPendiente, setMontoPendiente] = useState<number | null>(null);

  function activar() {
    startTransition(async () => {
      const r = await activarRifa(rifaId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      if (r.data.activada) {
        toast.success("¡Rifa activada! Ya puedes compartir el enlace.");
        router.refresh();
      } else {
        setMontoPendiente(r.data.monto ?? 0);
      }
    });
  }

  return (
    <>
      <Button size="lg" onClick={activar} disabled={pending}>
        <Rocket className="size-4" /> Activar y publicar
      </Button>

      <Dialog open={montoPendiente !== null} onOpenChange={(o) => !o && setMontoPendiente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esta rifa requiere pago</DialogTitle>
            <DialogDescription>
              Ya usaste tu cupo gratuito. Para activar esta rifa, transfiere{" "}
              <b>{montoPendiente != null ? formatCOP(montoPendiente) : ""}</b> y el
              administrador la activará al confirmar el pago. También puedes pasarte
              a suscripción mensual para rifas ilimitadas.
            </DialogDescription>
          </DialogHeader>
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
                  setMontoPendiente(null);
                })
              }
            >
              Quiero suscripción
            </Button>
            <Button onClick={() => { setMontoPendiente(null); router.refresh(); }}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
