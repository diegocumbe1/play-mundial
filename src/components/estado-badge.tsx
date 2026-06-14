import { cn } from "@/lib/utils";
import type { EstadoPartido } from "@/types";

const ESTILOS: Record<EstadoPartido, { label: string; className: string; dot: string }> = {
  programado: {
    label: "Próximo",
    className: "bg-white/5 text-polla-muted ring-1 ring-white/10",
    dot: "bg-polla-muted",
  },
  en_juego: {
    label: "En vivo",
    className: "bg-polla-red/15 text-polla-red ring-1 ring-polla-red/40 animate-live",
    dot: "bg-polla-red animate-pulse",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30",
    dot: "bg-emerald-400",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-white/5 text-polla-muted ring-1 ring-white/10 line-through",
    dot: "bg-polla-muted",
  },
};

/** Pill de estado de un partido con la identidad mundialista. */
export function EstadoBadge({
  estado,
  className,
}: {
  estado: EstadoPartido;
  className?: string;
}) {
  const e = ESTILOS[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide uppercase",
        e.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", e.dot)} aria-hidden />
      {e.label}
    </span>
  );
}
