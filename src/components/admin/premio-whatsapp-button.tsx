"use client";

import { MessageCircle } from "lucide-react";

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
 * Solo se renderiza para apuestas ganadoras con teléfono.
 */
export function PremioWhatsappButton({
  telefono,
  mensaje,
}: {
  telefono: string;
  mensaje: string;
}) {
  const numero = normalizarTelefono(telefono);
  if (!numero) return null;

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2.5 py-1 text-xs font-semibold text-[#25D366] ring-1 ring-[#25D366]/40 transition-colors hover:bg-[#25D366]/25"
    >
      <MessageCircle className="size-3.5" />
      Enviar pago
    </a>
  );
}
