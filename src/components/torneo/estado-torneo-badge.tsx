import { labelEstadoTorneo } from "@/lib/torneos";
import type { EstadoTorneo } from "@/types";

const CLASES: Record<EstadoTorneo, string> = {
  borrador: "bg-muted text-muted-foreground",
  inscripciones: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  programado: "bg-primary/15 text-primary",
  en_curso: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  finalizado: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/15 text-destructive",
};

/** Chip de estado de un torneo. */
export function EstadoTorneoBadge({ estado }: { estado: EstadoTorneo }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${CLASES[estado]}`}
    >
      {labelEstadoTorneo(estado)}
    </span>
  );
}
