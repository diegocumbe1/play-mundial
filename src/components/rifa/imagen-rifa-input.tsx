"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { subirImagenRifa } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { prepararImagen } from "@/lib/imagen";

/**
 * Sube (o quita) una imagen de la publicación de la rifa. Se usa dos veces en
 * el formulario: la foto del premio y la imagen de fondo. La subida devuelve
 * una URL pública que se guarda en la rifa al dar "Guardar".
 */
export function ImagenRifaInput({
  label,
  ayuda,
  valor,
  onChange,
  aspecto = "cuadrado",
}: {
  label: string;
  ayuda?: string;
  valor: string;
  onChange: (url: string) => void;
  /** Forma de la vista previa: la del fondo se ve mejor apaisada. */
  aspecto?: "cuadrado" | "ancho";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    // Se reduce en el navegador: una foto de celular no cabe en el body de una
    // Server Action y tampoco hace falta a tamaño completo.
    const listo = await prepararImagen(file);
    const fd = new FormData();
    fd.append("file", listo);
    const r = await subirImagenRifa(fd);
    setSubiendo(false);
    // Permite volver a elegir el mismo archivo si algo falló.
    e.target.value = "";
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    onChange(r.data.url);
    toast.success("Imagen subida");
  }

  const caja = aspecto === "ancho" ? "h-[72px] w-[128px]" : "size-[72px]";

  return (
    <div>
      <Label className="text-muted-foreground mb-1.5 block text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        {valor ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={valor}
              alt={label}
              className={`border-border ${caja} rounded-lg border object-cover`}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={`Quitar ${label.toLowerCase()}`}
              className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div
            className={`border-border text-muted-foreground ${caja} flex items-center justify-center rounded-lg border border-dashed text-xs`}
          >
            Sin imagen
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subiendo}
          onClick={() => fileRef.current?.click()}
        >
          {subiendo ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}
          {valor ? "Cambiar" : "Subir imagen"}
        </Button>
      </div>
      {ayuda && <p className="text-muted-foreground mt-1 text-xs">{ayuda}</p>}
    </div>
  );
}
