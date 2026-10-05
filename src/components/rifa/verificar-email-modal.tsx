"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { estadoVerificacion, reenviarVerificacion } from "@/actions/email";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Modal que aparece cuando se intenta registrar el primer número sin el correo
 * verificado. No se pierde nada de la rifa: al verificar, se sigue donde iba.
 */
export function VerificarEmailModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enviado, setEnviado] = useState(false);

  function reenviar() {
    startTransition(async () => {
      const r = await reenviarVerificacion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setEnviado(true);
      toast.success("Te enviamos el correo de verificación");
    });
  }

  function comprobar() {
    startTransition(async () => {
      const r = await estadoVerificacion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      if (r.data.verificado) {
        toast.success("¡Correo verificado! Ya puedes registrar números.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.message("Todavía no nos llega la confirmación. Revisa tu correo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="text-primary size-5" /> Verifica tu correo
          </DialogTitle>
          <DialogDescription>
            Verifica tu correo para comenzar a registrar participantes en esta rifa. Tu
            rifa queda guardada tal como la dejaste.
          </DialogDescription>
        </DialogHeader>

        {enviado && (
          <p className="text-muted-foreground text-sm">
            Revisa tu bandeja (y la carpeta de spam). El enlace te trae de vuelta aquí.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={reenviar}>
            <Send className="size-4" /> Reenviar correo
          </Button>
          <Button disabled={pending} onClick={comprobar}>
            <RefreshCw className="size-4" /> Ya lo verifiqué
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
