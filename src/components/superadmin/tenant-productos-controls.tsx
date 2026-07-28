"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProductoTenant } from "@/actions/productos";
import { PRODUCTOS_UI } from "@/lib/productos-ui";
import { cn } from "@/lib/utils";
import type { ProductoPlataforma } from "@/types";

/**
 * Habilita o deshabilita cada vertical para un organizador. Solo el superadmin
 * ve estos controles, y la Server Action vuelve a validar el rol.
 */
export function TenantProductosControls({
  tenantId,
  habilitados,
}: {
  tenantId: string;
  habilitados: ProductoPlataforma[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function alternar(producto: ProductoPlataforma, activo: boolean) {
    startTransition(async () => {
      const r = await setProductoTenant({ tenantId, producto, habilitado: !activo });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${PRODUCTOS_UI.find((p) => p.id === producto)?.nombre ?? producto} ${!activo ? "habilitado" : "deshabilitado"}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {PRODUCTOS_UI.map((p) => {
        const activo = habilitados.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => alternar(p.id, activo)}
            aria-pressed={activo}
            title={
              activo
                ? `Quitarle ${p.nombre} a este organizador`
                : `Darle acceso a ${p.nombre}`
            }
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
              activo
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {p.nombre}
          </button>
        );
      })}
    </div>
  );
}
