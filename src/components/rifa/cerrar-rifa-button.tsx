"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { cambiarEstadoRifa } from "@/actions/rifas";
import { Button } from "@/components/ui/button";

/** Cierra las ventas de una rifa activa (ya no recibe reservas). */
export function CerrarRifaButton({ rifaId }: { rifaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await cambiarEstadoRifa(rifaId, "cerrada");
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          toast.success("Ventas cerradas");
          router.refresh();
        })
      }
    >
      <Lock className="size-3.5" /> Cerrar ventas
    </Button>
  );
}
