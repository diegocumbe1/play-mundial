"use client";

import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Botón que muestra un enlace como código QR (por ejemplo el del juez), para
 * que lo escanee con la cámara en vez de copiarlo. El QR se genera aquí, en el
 * navegador: el enlace no sale a ningún servicio externo.
 */
export function QrEnlace({
  url,
  titulo,
  descripcion,
  etiqueta = "Mostrar QR",
  variante = "outline",
}: {
  url: string;
  titulo: string;
  descripcion?: string;
  etiqueta?: string;
  variante?: "default" | "outline" | "ghost";
}) {
  const [abierto, setAbierto] = useState(false);
  const [imagen, setImagen] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    // Fondo blanco y margen: se lee bien aunque la pantalla esté en modo oscuro.
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => vigente && setImagen(d))
      .catch(() => vigente && setImagen(null));
    return () => {
      vigente = false;
    };
  }, [abierto, url]);

  return (
    <>
      <Button size="sm" variant={variante} onClick={() => setAbierto(true)}>
        <QrCode className="size-3.5" /> {etiqueta}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              {descripcion ?? "Escanéalo con la cámara del celular para abrir el enlace."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen} alt={`QR: ${titulo}`} className="aspect-square w-full max-w-72 rounded-xl bg-white" />
            ) : (
              <div className="bg-muted aspect-square w-full max-w-72 animate-pulse rounded-xl" />
            )}
            {imagen && (
              <a
                href={imagen}
                download="qr-juez.png"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs underline"
              >
                <Download className="size-3.5" /> Descargar imagen
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
