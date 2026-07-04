"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Muestra el teléfono como texto; al tocarlo lo copia al portapapeles para
 * pegarlo rápido en Nequi al pagar. No es un botón aparte: es el número mismo.
 */
export function TelefonoCopiable({
  telefono,
  className,
}: {
  telefono: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const numero = telefono.replace(/\D/g, "");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      toast.success(`Número copiado: ${numero}`);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No se pudo copiar el número");
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Tocar para copiar el número"
      className={cn(
        "hover:text-polla-gold cursor-pointer underline decoration-dotted underline-offset-2 transition-colors",
        copiado && "text-polla-gold",
        className,
      )}
    >
      {copiado ? "¡Copiado!" : telefono}
    </button>
  );
}
