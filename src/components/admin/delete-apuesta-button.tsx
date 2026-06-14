"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { borrarApuesta } from "@/actions/apuestas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteApuestaButton({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function borrar() {
    startTransition(async () => {
      const r = await borrarApuesta(id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Apuesta borrada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Borrar apuesta de ${nombre}`}
        className="text-polla-muted hover:text-polla-red transition-colors"
      >
        <Trash2 className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-polla-surface border-polla-line">
          <DialogHeader>
            <DialogTitle>Borrar apuesta</DialogTitle>
            <DialogDescription className="text-polla-muted">
              ¿Borrar la apuesta de <strong>{nombre}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-polla-muted hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={borrar}
              disabled={pending}
              className="bg-polla-red font-semibold text-white hover:bg-polla-red/90"
            >
              {pending ? "Borrando…" : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
