"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  liberarBoleta,
  marcarPagoBoleta,
  registrarBoletaAdmin,
} from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Boleta } from "@/types";

/** Grilla de números del backoffice: 3 estados y gestión por número. */
export function GrillaAdmin({
  rifaId,
  cantidad,
  boletas,
}: {
  rifaId: string;
  cantidad: number;
  boletas: Boleta[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const porNumero = useMemo(() => {
    const m = new Map<number, Boleta>();
    for (const b of boletas) m.set(b.numero, b);
    return m;
  }, [boletas]);

  const ancho = String(cantidad - 1).length;

  function abrir(numero: number) {
    setAbierto(numero);
    setNombre("");
    setTelefono("");
  }

  function correr(accion: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(ok);
      setAbierto(null);
      router.refresh();
    });
  }

  const boletaActual = abierto != null ? porNumero.get(abierto) : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: cantidad }, (_, n) => {
          const b = porNumero.get(n);
          const estado = b?.estado ?? "libre";
          const base =
            "relative flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors";
          const cls =
            estado === "pagado"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 line-through decoration-emerald-600/60"
              : estado === "reservado"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-muted text-foreground hover:bg-muted/70";
          return (
            <button key={n} type="button" onClick={() => abrir(n)} className={`${base} ${cls}`}>
              {String(n).padStart(ancho, "0")}
              {estado === "pagado" && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="size-2.5" />
                </span>
              )}
              {estado === "reservado" && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Clock className="size-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5"><i className="bg-muted size-3 rounded" /> Libre</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-amber-500/40" /> Apartado</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-emerald-500/40" /> Pagado</span>
      </div>

      <Dialog open={abierto !== null} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Número {abierto != null ? String(abierto).padStart(ancho, "0") : ""}
            </DialogTitle>
            <DialogDescription>
              {boletaActual
                ? `${boletaActual.comprador_nombre ?? "Sin nombre"}${
                    boletaActual.comprador_telefono ? ` · ${boletaActual.comprador_telefono}` : ""
                  }`
                : "Registra a quién le vendiste este número."}
            </DialogDescription>
          </DialogHeader>

          {!boletaActual && (
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs">Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del comprador" />
              </div>
              <div>
                <Label className="text-muted-foreground mb-1.5 block text-xs">Teléfono (opcional)</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 000 0000" inputMode="tel" />
              </div>
            </div>
          )}

          <DialogFooter>
            {!boletaActual ? (
              <>
                <Button
                  variant="outline"
                  disabled={pending || !nombre.trim()}
                  onClick={() =>
                    correr(
                      () =>
                        registrarBoletaAdmin({
                          rifa_id: rifaId,
                          numero: abierto!,
                          comprador_nombre: nombre.trim(),
                          comprador_telefono: telefono.trim() || null,
                          pagado: false,
                        }),
                      "Número apartado",
                    )
                  }
                >
                  <Clock className="size-4" /> Apartar
                </Button>
                <Button
                  disabled={pending || !nombre.trim()}
                  onClick={() =>
                    correr(
                      () =>
                        registrarBoletaAdmin({
                          rifa_id: rifaId,
                          numero: abierto!,
                          comprador_nombre: nombre.trim(),
                          comprador_telefono: telefono.trim() || null,
                          pagado: true,
                          metodo_pago: "efectivo",
                        }),
                      "Número pagado",
                    )
                  }
                >
                  <Check className="size-4" /> Registrar pagado
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => correr(() => liberarBoleta(boletaActual.id), "Número liberado")}
                >
                  <Trash2 className="size-4" /> Liberar
                </Button>
                {boletaActual.estado === "pagado" ? (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => correr(() => marcarPagoBoleta(boletaActual.id, false), "Marcado pendiente")}
                  >
                    Marcar pendiente
                  </Button>
                ) : (
                  <Button
                    disabled={pending}
                    onClick={() => correr(() => marcarPagoBoleta(boletaActual.id, true, "efectivo"), "Pago registrado")}
                  >
                    <Check className="size-4" /> Marcar pagado
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
