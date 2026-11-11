"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPatrociniosTenant } from "@/actions/torneos";
import { cn } from "@/lib/utils";

/**
 * Superadmin: habilita los patrocinadores de torneos para un organizador.
 * Apagado, el organizador no ve la sección y la página pública no muestra
 * ningún patrocinador (aunque los tenga publicados).
 */
export function TenantPatrociniosToggle({ tenantId, activo }: { tenantId: string; activo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={activo}
      title={activo ? "Quitarle los patrocinadores de torneos" : "Habilitarle los patrocinadores de torneos"}
      onClick={() =>
        startTransition(async () => {
          const r = await setPatrociniosTenant(tenantId, !activo);
          if (!r.success) return void toast.error(r.error);
          toast.success(`Patrocinadores ${!activo ? "habilitados" : "deshabilitados"}`);
          router.refresh();
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
        activo
          ? "border-border hover:bg-muted border"
          : "bg-primary text-primary-foreground hover:bg-primary/80",
      )}
    >
      {activo ? "Desactivar patrocinadores" : "Activar patrocinadores"}
    </button>
  );
}
