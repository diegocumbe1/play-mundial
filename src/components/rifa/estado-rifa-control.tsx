"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { cambiarEstadoRifa } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EstadoRifa } from "@/types";

/**
 * Cambia el estado de ventas de una rifa (cerrar / reabrir) con confirmación,
 * para que no se cambie por accidente.
 */
export function EstadoRifaControl({
  rifaId,
  estado,
}: {
  rifaId: string;
  estado: EstadoRifa;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);

  if (estado !== "activa" && estado !== "cerrada") return null;

  const cerrando = estado === "activa";
  const destino = cerrando ? "cerrada" : "activa";

  function confirmar() {
    startTransition(async () => {
      const r = await cambiarEstadoRifa(rifaId, destino);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(cerrando ? "Ventas cerradas" : "Ventas reabiertas");
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={cerrando ? "outline" : "default"}
        size="sm"
        onClick={() => setAbierto(true)}
        disabled={pending}
      >
        {cerrando ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
        {cerrando ? "Cerrar ventas" : "Reabrir ventas"}
      </Button>

      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cerrando ? "¿Cerrar las ventas?" : "¿Reabrir las ventas?"}
            </DialogTitle>
            <DialogDescription>
              {cerrando
                ? "La rifa dejará de recibir reservas desde el enlace público. Puedes reabrirla después si te equivocas."
                : "La rifa volverá a estar activa y podrá recibir reservas desde el enlace público."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={pending}>
              {cerrando ? "Sí, cerrar ventas" : "Sí, reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
