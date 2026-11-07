"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/types";

/**
 * Permite al superadmin transferir una rifa o un torneo a otro organizador
 * (owner), para que no quede atado a él.
 */
export function ReasignarResponsable({
  entidad,
  queSeMueve,
  nota,
  reasignar,
  tenantActualId,
  tenantActualNombre,
  tenants,
}: {
  entidad: "rifa" | "torneo";
  /** Completa la frase "... pasarán a X". */
  queSeMueve: string;
  /** Consecuencia adicional que el superadmin debe saber antes de confirmar. */
  nota?: string;
  reasignar: (tenantId: string) => Promise<ActionResult>;
  tenantActualId: string;
  tenantActualNombre: string;
  tenants: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destino, setDestino] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const nombreDestino = tenants.find((t) => t.id === destino)?.nombre ?? "";
  const otros = tenants.filter((t) => t.id !== tenantActualId);
  const articulo = entidad === "rifa" ? "la" : "el";
  const pronombre = entidad === "rifa" ? "la" : "lo";
  const asignado = entidad === "rifa" ? "Rifa asignada" : "Torneo asignado";

  function aplicar() {
    startTransition(async () => {
      const r = await reasignar(destino);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(`${asignado} a ${nombreDestino}`);
      setConfirmar(false);
      setDestino("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        Responsable actual: <b className="text-foreground">{tenantActualNombre}</b>
      </p>
      {otros.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aún no hay otros organizadores.{" "}
          <Link href="/superadmin" className="text-primary font-medium hover:underline">
            Crear un organizador
          </Link>{" "}
          para poder asignarle {entidad === "rifa" ? "esta rifa" : "este torneo"}.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="border-input bg-background h-9 flex-1 rounded-lg border px-2 text-sm"
            aria-label="Nuevo responsable"
          >
            <option value="">Cambiar responsable…</option>
            {otros.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          <Button size="sm" disabled={pending || !destino} onClick={() => setConfirmar(true)}>
            <UserCog className="size-3.5" /> Asignar
          </Button>
        </div>
      )}

      <Dialog open={confirmar} onOpenChange={(o) => !o && setConfirmar(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Transferir {articulo} {entidad}?</DialogTitle>
            <DialogDescription>
              {queSeMueve} pasarán a <b>{nombreDestino}</b>, que podrá administrar{pronombre} desde
              su cuenta. Tú como superadmin sigues viéndo{pronombre}. Esta acción se puede
              revertir volviendo a asignar{pronombre}.
              {nota ? ` ${nota}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={aplicar} disabled={pending}>
              Sí, asignar a {nombreDestino}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
