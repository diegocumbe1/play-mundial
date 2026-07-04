"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { marcarPremioApuestaPagado } from "@/actions/apuestas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Chip para marcar si el premio ya se le pagó a una apuesta ganadora. Abre un
 * diálogo para confirmar el pago y dejar una nota opcional (ej. "corresponde al
 * pago de Edilson" o "se descuenta de la ganancia").
 */
export function PremioPagoToggle({
  apuestaId,
  pagado,
  notaPremio,
}: {
  apuestaId: string;
  pagado: boolean;
  notaPremio?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");

  function abrir() {
    setNota(notaPremio ?? "");
    setAbierto(true);
  }

  function ejecutar(nuevoPagado: boolean) {
    startTransition(async () => {
      const r = await marcarPremioApuestaPagado(apuestaId, nuevoPagado, nota);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
          pagado
            ? "bg-polla-gold/15 text-polla-gold ring-polla-gold/40"
            : "bg-polla-red/10 text-polla-red ring-polla-red/30",
        )}
        title={pagado ? "Ver o editar el pago del premio" : "Marcar premio pagado"}
      >
        {pagado ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
        {pagado ? "Premio pagado" : "Premio pendiente"}
        {notaPremio?.trim() && <StickyNote className="size-3.5 opacity-80" />}
      </button>

      <Dialog open={abierto} onOpenChange={(open) => !open && setAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pagado ? "Detalle del premio pagado" : "Confirmar pago del premio"}
            </DialogTitle>
            <DialogDescription>
              {pagado
                ? "Puedes editar la nota o marcar el premio como pendiente."
                : "Registra que ya entregaste el premio y deja una nota opcional para tus cuentas."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`nota-premio-${apuestaId}`}
              className="text-polla-muted text-xs font-medium"
            >
              Nota (opcional)
            </label>
            <textarea
              id={`nota-premio-${apuestaId}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej. corresponde al pago de Edilson · se descuenta de la ganancia · pagado a otra cuenta"
              className="border-polla-line bg-polla-elevated focus:ring-polla-gold/40 w-full resize-none rounded-lg border px-3 py-2 text-sm text-white outline-none focus:ring-2"
            />
          </div>

          <DialogFooter>
            {pagado ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => ejecutar(false)}
                  disabled={pending}
                >
                  Marcar como pendiente
                </Button>
                <Button type="button" onClick={() => ejecutar(true)} disabled={pending}>
                  Guardar nota
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => ejecutar(true)} disabled={pending}>
                Confirmar premio pagado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
