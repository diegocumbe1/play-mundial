"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, ImageDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Compartir una rifa: copiar enlace público, abrirlo y descargar el flyer. */
export function ShareRifa({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-muted text-muted-foreground truncate rounded-md px-2 py-1 text-xs">/r/{slug}</code>
      <Button variant="outline" size="sm" onClick={copiar}>
        {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copiar enlace
      </Button>
      <a href={`/r/${slug}`} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
        <ExternalLink className="size-3.5" /> Abrir
      </a>
      <a href={`/r/${slug}/flyer`} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
        <ImageDown className="size-3.5" /> Flyer para redes
      </a>
    </div>
  );
}
