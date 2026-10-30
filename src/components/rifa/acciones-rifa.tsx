"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { archivarRifa, eliminarRifa } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EstadoRifa } from "@/types";

type Modal = "archivar" | "restaurar" | "borrar" | null;

/**
 * Acciones de una rifa en "Mis rifas". Activa → se puede archivar. Archivada →
 * restaurar o borrar para siempre. Cada paso pide confirmación, y borrar además
 * exige escribir el nombre: es irreversible.
 */
export function AccionesRifa({
  rifa,
  esSuperadmin = false,
}: {
  rifa: { id: string; nombre: string; estado: EstadoRifa; archivada_at: string | null };
  /** El superadmin puede borrar rifas publicadas, con motivo obligatorio. */
  esSuperadmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<Modal>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [motivo, setMotivo] = useState("");
  // Publicada: el organizador no la puede borrar; el superadmin sí, con motivo.
  const publicada = rifa.estado !== "borrador";
  const pideMotivo = esSuperadmin && publicada;
  const archivada = !!rifa.archivada_at;
  // Una rifa en venta tiene compradores mirando el enlace: se avisa distinto.
  const enVenta = rifa.estado === "activa" || rifa.estado === "cerrada";

  function cerrar() {
    setModal(null);
    setConfirmacion("");
    setMotivo("");
  }

  function ejecutar(
    accion: () => Promise<{ success: boolean; error?: string }>,
    ok: string,
    /** A dónde ir después (al borrar, la página de la rifa ya no existe). */
    destino?: string,
  ) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error ?? "No se pudo completar");
        return;
      }
      toast.success(ok);
      cerrar();
      if (destino) router.push(destino);
      router.refresh();
    });
  }

  return (
    <>
      {archivada ? (
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" onClick={() => setModal("restaurar")}>
            <ArchiveRestore className="size-3.5" /> Restaurar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModal("borrar")}
            className="text-red-600 hover:text-red-600 dark:text-red-400"
          >
            <Trash2 className="size-3.5" /> Borrar
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setModal("archivar")}
          aria-label={`Archivar ${rifa.nombre}`}
          title="Archivar"
        >
          <Archive className="size-4" />
        </Button>
      )}

      <Dialog open={modal === "archivar"} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Archivar &quot;{rifa.nombre}&quot;?</DialogTitle>
            <DialogDescription>
              Sale de tu lista y el enlace público deja de funcionar. No se borra nada:
              números, compradores y pagos quedan guardados y la puedes restaurar cuando
              quieras desde <b>Archivadas</b>.
            </DialogDescription>
          </DialogHeader>
          {enVenta && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Esta rifa está en venta: mientras esté archivada nadie podrá ver ni apartar
              números.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => ejecutar(() => archivarRifa(rifa.id, true), "Rifa archivada")}
            >
              <Archive className="size-4" /> Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "restaurar"} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Restaurar &quot;{rifa.nombre}&quot;?</DialogTitle>
            <DialogDescription>
              Vuelve a tu lista exactamente como estaba. Si estaba activa, el enlace público
              vuelve a funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() => ejecutar(() => archivarRifa(rifa.id, false), "Rifa restaurada")}
            >
              <ArchiveRestore className="size-4" /> Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "borrar"} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar para siempre</DialogTitle>
            <DialogDescription>
              Se eliminan la rifa, sus números, compradores, premios y ganadores.{" "}
              <b>No se puede deshacer.</b> Lo que hayas pagado por activarla no se devuelve
              y el cupo gratis no se recupera.
            </DialogDescription>
          </DialogHeader>
          {publicada && !esSuperadmin && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Esta rifa ya se publicó: no se puede borrar, queda archivada. Si de verdad hay
              que borrarla, pídeselo al administrador de la plataforma.
            </p>
          )}
          {pideMotivo && (
            <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
              <p className="text-xs text-red-700 dark:text-red-300">
                <b>Borrado de superadministrador.</b> Esta rifa ya se publicó y puede tener
                compradores y pagos. Se borra todo y queda registrado quién la borró, cuándo y
                por qué.
              </p>
              <label className="text-muted-foreground block text-xs">
                Motivo (obligatorio, mínimo 10 caracteres)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Ej. rifa duplicada por error, la real es la otra"
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs">
              Para confirmar, escribe el nombre: <b className="text-foreground">{rifa.nombre}</b>
            </label>
            <Input
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder={rifa.nombre}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                pending ||
                confirmacion.trim() !== rifa.nombre.trim() ||
                (publicada && !esSuperadmin) ||
                (pideMotivo && motivo.trim().length < 10)
              }
              onClick={() =>
                ejecutar(
                  () => eliminarRifa(rifa.id, confirmacion, pideMotivo ? motivo : undefined),
                  "Rifa borrada",
                  "/admin/rifas?ver=archivadas",
                )
              }
            >
              <Trash2 className="size-4" /> Borrar para siempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
