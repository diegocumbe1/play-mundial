"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  cambiarEstadoCuentaCobro,
  duplicarCuentaCobro,
  eliminarCuentaCobro,
} from "@/actions/cuentas-cobro";
import { Button, buttonVariants } from "@/components/ui/button";
import { numeroCuenta } from "@/lib/cuenta-cobro";
import type { EstadoCuentaCobro } from "@/types";

/** Compartir el enlace del cliente y mover la cuenta entre estados. */
export function CuentaCobroAcciones({
  id,
  clave,
  numero,
  cliente,
  estado,
  enlace,
}: {
  id: string;
  clave: string;
  numero: number;
  cliente: string;
  estado: EstadoCuentaCobro;
  /** Enlace absoluto, armado en el servidor. */
  enlace: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copiar = () =>
    navigator.clipboard.writeText(enlace).then(() => toast.success("Enlace copiado"));
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Hola, te comparto la cuenta de cobro N.º ${numeroCuenta(numero)} (${cliente}). Completa tus datos y descárgala aquí: ${enlace}`,
  )}`;

  function estadoA(nuevo: EstadoCuentaCobro, ok: string) {
    startTransition(async () => {
      const r = await cambiarEstadoCuentaCobro(id, nuevo);
      if (!r.success) return void toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });
  }

  function duplicar() {
    startTransition(async () => {
      const r = await duplicarCuentaCobro(id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Copia creada: cambia el cliente y el valor");
      router.push(`/superadmin/cuentas-cobro/${r.data.id}`);
    });
  }

  function borrar() {
    if (!confirm("¿Borrar esta cuenta de cobro? El enlace del cliente dejará de funcionar.")) return;
    startTransition(async () => {
      const r = await eliminarCuentaCobro(id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Cuenta de cobro borrada");
      router.push("/superadmin/cuentas-cobro");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground break-all text-xs">{enlace}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copiar}>
          <Copy className="size-3.5" /> Copiar enlace
        </Button>
        <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
          <MessageCircle className="size-3.5" /> Enviar por WhatsApp
        </a>
        <a href={`/cobro/${clave}`} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
          <ExternalLink className="size-3.5" /> Ver como cliente
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {estado === "datos_completos" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => estadoA("enviada", "El cliente puede volver a editar sus datos")}>
            Reabrir datos al cliente
          </Button>
        )}
        {(estado === "enviada" || estado === "datos_completos") && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => estadoA("pagada", "Marcada como pagada")}>
            Marcar pagada
          </Button>
        )}
        {estado === "pagada" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => estadoA("datos_completos", "Pago desmarcado")}>
            Desmarcar pago
          </Button>
        )}
        {estado !== "anulada" ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => estadoA("anulada", "Cuenta anulada")}>
            Anular
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => estadoA("enviada", "Cuenta reactivada")}>
            Reactivar
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={duplicar}>
          Usar como plantilla
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={borrar}>
          <Trash2 className="size-3.5" /> Borrar
        </Button>
      </div>
    </div>
  );
}
