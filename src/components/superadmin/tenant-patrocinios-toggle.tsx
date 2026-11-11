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
        "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
        activo
          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      Patrocinadores
    </button>
  );
}
