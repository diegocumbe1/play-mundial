import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sección que se abre y se cierra (sin JavaScript: es un `<details>`). Por
 * defecto cerrada: sirve para lo que ocupa mucho y no es lo primero que se busca.
 */
export function Desplegable({
  titulo,
  icono,
  cuenta,
  abierto = false,
  className,
  children,
}: {
  titulo: string;
  icono?: React.ReactNode;
  /** Cantidad que se muestra junto al título, por ejemplo los resultados. */
  cuenta?: number;
  abierto?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={abierto} className={cn("group border-border rounded-2xl border", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          {icono}
          {titulo}
          {cuenta !== undefined && <span className="text-muted-foreground text-xs font-normal">({cuenta})</span>}
        </span>
        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
