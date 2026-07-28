"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Compartir el enlace público del torneo. El tráfico entra por WhatsApp desde
 * el celular: el mensaje tiene que vender solo (deporte, fecha, cupos, valor).
 */
export function ShareTorneo({
  slug,
  nombre,
  detalle,
}: {
  slug: string;
  nombre: string;
  detalle?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const urlPublica =
    typeof window !== "undefined" ? `${window.location.origin}/t/${slug}` : `/t/${slug}`;
  const mensaje = [`Torneo: ${nombre}`, detalle, urlPublica].filter(Boolean).join("\n");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlPublica);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-muted text-muted-foreground truncate rounded-md px-2 py-1 text-xs">
        /t/{slug}
      </code>
      <Button variant="outline" size="sm" onClick={copiar}>
        {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copiar
        enlace
      </Button>
      <Button variant="outline" size="sm" onClick={whatsapp}>
        <Share2 className="size-3.5" /> WhatsApp
      </Button>
      <a
        href={`/t/${slug}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        <ExternalLink className="size-3.5" /> Abrir
      </a>
    </div>
  );
}
