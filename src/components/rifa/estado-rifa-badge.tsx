import type { EstadoRifa } from "@/types";

const CONFIG: Record<EstadoRifa, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  activa: { label: "Activa", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cerrada: { label: "Cerrada", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  sorteada: { label: "Sorteada", className: "bg-primary/15 text-primary" },
  pagada: { label: "Pagada", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelada: { label: "Cancelada", className: "bg-destructive/15 text-destructive" },
};

/** Chip de estado de una rifa. */
export function EstadoRifaBadge({ estado }: { estado: EstadoRifa }) {
  const c = CONFIG[estado];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
}
