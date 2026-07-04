"use client";

import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/** Normaliza un teléfono colombiano a formato internacional para wa.me. */
function normalizarTelefono(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return `57${digitos}`;
  if (digitos.startsWith("57") && digitos.length === 12) return digitos;
  if (digitos.length >= 10) return digitos;
  return null;
}

/**
 * Abre WhatsApp con un mensaje pre-generado para avisarle al ganador del pago.
 * Solo se renderiza para apuestas ganadoras con teléfono. En verde mientras el
 * premio está pendiente; en gris (sin perder la acción) cuando ya se pagó.
 */
export function PremioWhatsappButton({
  telefono,
  mensaje,
  premioPagado = false,
}: {
  telefono: string;
  mensaje: string;
  premioPagado?: boolean;
}) {
  const numero = normalizarTelefono(telefono);
  if (!numero) return null;

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={premioPagado ? "Premio ya pagado · reenviar mensaje" : "Enviar mensaje de pago"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors",
        premioPagado
          ? "bg-polla-elevated text-polla-muted ring-polla-line hover:text-white"
          : "bg-[#25D366]/15 text-[#25D366] ring-[#25D366]/40 hover:bg-[#25D366]/25",
      )}
    >
      <MessageCircle className="size-3.5" />
      Enviar pago
    </a>
  );
}
