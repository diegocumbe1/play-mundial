"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";

import { registrarBoletasLote } from "@/actions/rifas";
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
import { formatCOP, formatNumero } from "@/lib/rifa";

/**
 * Registra VARIOS números a un mismo comprador de una sola vez (lo normal
 * cuando alguien compra "del 5 al 10"). Espeja `BoletaModal`, pero sin gestión
 * de una boleta existente: aquí solo se crean.
 */
export function BoletasLoteModal({
  rifaId,
  numeros,
  ancho,
  precio,
  open,
  onClose,
  onListo,
}: {
  rifaId: string;
  numeros: number[];
  ancho: number;
  precio: number;
  open: boolean;
  onClose: () => void;
  /** Se llama cuando el registro salió bien (para limpiar la selección). */
  onListo: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [responsable, setResponsable] = useState("");

  const etiquetas = numeros.map((n) => formatNumero(n, ancho)).join(", ");

  function registrar(pagado: boolean) {
    startTransition(async () => {
      const r = await registrarBoletasLote({
        rifa_id: rifaId,
        numeros,
        comprador_nombre: nombre.trim(),
        comprador_telefono: telefono.trim() || null,
        responsable_venta: responsable.trim() || null,
        pagado,
        metodo_pago: pagado ? "efectivo" : null,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      if (r.data.ocupados.length > 0) {
        toast.message(
          `Ya estaban tomados: ${r.data.ocupados.map((n) => formatNumero(n, ancho)).join(", ")}`,
        );
      }
      toast.success(
        `${r.data.registrados.length} número(s) ${pagado ? "pagados" : "apartados"} a ${nombre.trim()}`,
      );
      setNombre("");
      setTelefono("");
      setResponsable("");
      onListo();
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {numeros.length} número(s) · {formatCOP(numeros.length * precio)}
          </DialogTitle>
          <DialogDescription>
            Se registran a un mismo comprador: {etiquetas}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label className="text-muted-foreground mb-1.5 block text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del comprador"
            />
          </div>
          <div>
            <Label className="text-muted-foreground mb-1.5 block text-xs">
              Teléfono (opcional)
            </Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="300 000 0000"
              inputMode="tel"
            />
          </div>
          <div>
            <Label className="text-muted-foreground mb-1.5 block text-xs">
              Responsable de venta (opcional)
            </Label>
            <Input
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Diego Cumbe"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending || !nombre.trim()}
            onClick={() => registrar(false)}
          >
            <Clock className="size-4" /> Apartar todos
          </Button>
          <Button disabled={pending || !nombre.trim()} onClick={() => registrar(true)}>
            <Check className="size-4" /> Registrar pagados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
