"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { borrarTodasApuestas } from "@/actions/apuestas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteAllApuestasButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function borrar() {
    startTransition(async () => {
      const r = await borrarTodasApuestas();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Todas las apuestas fueron borradas");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-polla-red hover:text-polla-red gap-1.5"
      >
        <Trash2 className="size-4" />
        Borrar todas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-polla-surface border-polla-line">
          <DialogHeader>
            <DialogTitle>Borrar TODAS las apuestas</DialogTitle>
            <DialogDescription className="text-polla-muted">
              Se eliminarán todas las apuestas de todos los partidos. Esta acción
              no se puede deshacer.
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
              {pending ? "Borrando…" : "Sí, borrar todas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
