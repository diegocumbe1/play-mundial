"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { crearTorneoDesdeDemo } from "@/actions/torneos";
import { Button } from "@/components/ui/button";

/**
 * Convierte la demo en un torneo real con la misma configuración, categorías y
 * equipos. Los equipos quedan pendientes de pago para renombrarlos y cargar
 * los jugadores reales.
 */
export function UsarDemoButton({ demoId }: { demoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function usar() {
    if (
      !confirm(
        "Se creará un torneo real en borrador con esta configuración y estos equipos (todos pendientes de pago). Luego podrás cambiar nombres y jugadores. ¿Continuar?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await crearTorneoDesdeDemo(demoId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Torneo creado. Ahora edita los equipos y sus jugadores.");
      router.push(`/admin/torneos/${r.data.id}`);
    });
  }

  return (
    <Button type="button" size="sm" disabled={pending} onClick={usar}>
      <Copy className="size-3.5" /> {pending ? "Creando…" : "Usar como mi torneo"}
    </Button>
  );
}
