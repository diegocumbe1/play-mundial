"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink, ImageIcon, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Compartir una rifa: copiar enlace, abrir la pública y un modal con el flyer
 * (vista previa + descargar + compartir por WhatsApp/apps del sistema).
 *
 * `detalle` es el resumen que viaja en el mensaje (cómo se gana, precio,
 * disponibles): WhatsApp de escritorio no acepta adjuntos por enlace, así que
 * el texto tiene que vender solo.
 */
export function ShareRifa({
  slug,
  nombre,
  detalle,
}: {
  slug: string;
  nombre?: string;
  detalle?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [verFlyer, setVerFlyer] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  // Cache-busting: el flyer se regenera con el estado real en cada apertura.
  const [version, setVersion] = useState(0);

  const urlPublica =
    typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;
  const urlFlyer = `/r/${slug}/flyer?v=${version}`;
  const titulo = nombre ? `Rifa: ${nombre}` : "Mira esta rifa";
  const mensaje = [titulo, detalle, urlPublica].filter(Boolean).join("\n");

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

  function abrirFlyer() {
    setVersion(Date.now()); // fuerza imagen fresca
    setVerFlyer(true);
  }

  /** Baja el flyer al disco. Devuelve el blob para reutilizarlo. */
  async function bajarFlyer(): Promise<Blob> {
    const res = await fetch(urlFlyer);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rifa-${slug}.png`;
    a.click();
    URL.revokeObjectURL(url);
    return blob;
  }

  async function descargar() {
    setTrabajando(true);
    try {
      await bajarFlyer();
      toast.success("Flyer descargado");
    } catch {
      toast.error("No se pudo descargar");
    } finally {
      setTrabajando(false);
    }
  }

  /** Comparte la IMAGEN por las apps del sistema (WhatsApp, Instagram…). */
  async function compartir() {
    setTrabajando(true);
    try {
      const res = await fetch(urlFlyer);
      const blob = await res.blob();
      const file = new File([blob], `rifa-${slug}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: titulo, text: mensaje });
        return;
      }

      // Sin Web Share (escritorio): WhatsApp Web no acepta adjuntos por URL, así
      // que se descarga el flyer para arrastrarlo al chat y se abre el mensaje.
      await bajarFlyer();
      toast.info("Flyer descargado: adjúntalo en el chat");
      window.open(
        `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
        "_blank",
        "noopener",
      );
    } catch (e) {
      // El usuario canceló el diálogo del sistema: no es un error.
      if ((e as Error)?.name !== "AbortError") toast.error("No se pudo compartir");
    } finally {
      setTrabajando(false);
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
    <>
      <div className="flex flex-wrap items-center gap-2">
        <code className="bg-muted text-muted-foreground truncate rounded-md px-2 py-1 text-xs">
          /r/{slug}
        </code>
        <Button variant="outline" size="sm" onClick={copiar}>
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copiar enlace
        </Button>
        <Button variant="outline" size="sm" onClick={abrirFlyer}>
          <ImageIcon className="size-3.5" /> Ver flyer
        </Button>
        <a
          href={`/r/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          <ExternalLink className="size-3.5" /> Abrir
        </a>
      </div>

      <Dialog open={verFlyer} onOpenChange={(o) => !o && setVerFlyer(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Flyer para redes</DialogTitle>
            <DialogDescription>
              Se genera con el estado real de la rifa. Descárgalo o compártelo directo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFlyer}
              alt="Flyer de la rifa"
              className="border-border max-h-[52vh] w-auto rounded-lg border object-contain"
            />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={compartir} disabled={trabajando} className="w-full">
              {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
              Compartir imagen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={descargar} disabled={trabajando} className="flex-1">
                <Download className="size-4" /> Descargar
              </Button>
              <Button variant="outline" onClick={whatsapp} className="flex-1">
                <Share2 className="size-4" /> WhatsApp
              </Button>
            </div>
            <p className="text-muted-foreground text-center text-[11px]">
              &quot;Compartir imagen&quot; envía el flyer directo a WhatsApp/Instagram desde el
              celular. En computador lo descarga para adjuntarlo. El botón de WhatsApp manda solo
              el enlace, que ya muestra su propia vista previa con imagen.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
