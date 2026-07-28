"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { abrirInscripciones, cambiarEstadoTorneo } from "@/actions/torneos";
import { Button } from "@/components/ui/button";
import type { EstadoTorneo } from "@/types";

/** Transiciones sugeridas según el estado actual (el borrador se activa aparte). */
const SIGUIENTES: Record<EstadoTorneo, { estado: EstadoTorneo; label: string }[]> = {
  borrador: [],
  inscripciones: [
    { estado: "programado", label: "Cerrar inscripciones" },
    { estado: "cancelado", label: "Cancelar" },
  ],
  programado: [
    { estado: "en_curso", label: "Iniciar torneo" },
    { estado: "cancelado", label: "Cancelar" },
  ],
  en_curso: [{ estado: "finalizado", label: "Finalizar" }],
  finalizado: [],
  cancelado: [],
};

/** Botones de ciclo de vida del torneo. */
export function EstadoTorneoControl({
  torneoId,
  estado,
}: {
  torneoId: string;
  estado: EstadoTorneo;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mover(siguiente: EstadoTorneo) {
    startTransition(async () => {
      const r = await cambiarEstadoTorneo(torneoId, siguiente);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Estado actualizado");
      router.refresh();
    });
  }

  function reabrir() {
    startTransition(async () => {
      const r = await abrirInscripciones(torneoId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Inscripciones abiertas");
      router.refresh();
    });
  }

  const opciones = SIGUIENTES[estado];
  const puedeReabrir = estado === "programado" || estado === "en_curso";

  if (opciones.length === 0 && !puedeReabrir) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {puedeReabrir && (
        <Button variant="outline" size="sm" onClick={reabrir} disabled={pending}>
          Reabrir inscripciones
        </Button>
      )}
      {opciones.map((o) => (
        <Button
          key={o.estado}
          variant={o.estado === "cancelado" ? "ghost" : "outline"}
          size="sm"
          onClick={() => mover(o.estado)}
          disabled={pending}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
