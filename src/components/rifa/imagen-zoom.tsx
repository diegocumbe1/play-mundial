"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn } from "lucide-react";

/**
 * Imagen que se abre a pantalla completa al tocarla. Pensado para el celular:
 * las fotos de premio suelen ser flyers con letra chica. Dentro del visor, un
 * toque alterna entre "ajustada a la pantalla" y "tamaño real" (con scroll
 * para recorrerla); la X o tocar el fondo la cierra.
 */
export function ImagenZoom({
  src,
  alt,
  className,
  conPista = true,
  difuminado = false,
}: {
  src: string;
  alt: string;
  /** Clases de la miniatura (con `difuminado`, las del marco). */
  className?: string;
  /** Muestra la lupa en la esquina para que se entienda que se puede ampliar. */
  conPista?: boolean;
  /**
   * Foto de producto: se ve COMPLETA (sin recortar) sobre un fondo hecho con
   * la misma imagen desenfocada, en vez de bandas blancas. El marco toma la
   * forma de la foto (vertical, cuadrada u horizontal).
   */
  difuminado?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [real, setReal] = useState(false);
  const [forma, setForma] = useState<"vertical" | "cuadrada" | "horizontal">("cuadrada");

  function medir(img: HTMLImageElement) {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return;
    const r = w / h;
    const nueva = r < 0.9 ? "vertical" : r > 1.2 ? "horizontal" : "cuadrada";
    setForma((actual) => (actual === nueva ? actual : nueva));
  }

  // Escape cierra y el fondo no se desplaza mientras el visor está abierto.
  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReal(false);
          setAbierta(true);
        }}
        className="relative block w-full cursor-zoom-in"
        aria-label={`Ampliar ${alt}`}
      >
        {difuminado ? (
          <span
            className={`relative block w-full overflow-hidden bg-neutral-900 ${
              forma === "vertical"
                ? "aspect-[4/5] max-h-96"
                : forma === "horizontal"
                  ? "aspect-video"
                  : "aspect-square"
            } ${className ?? ""}`}
          >
            {/* Fondo: la misma foto, desenfocada y oscurecida */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
            />
            <span className="absolute inset-0 bg-black/30" />
            {/* La foto completa, sin recortar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              // Con la foto en caché el `load` puede llegar antes de hidratar:
              // por eso también se mide al montar (ref).
              ref={(img) => {
                if (img?.complete) medir(img);
              }}
              onLoad={(e) => medir(e.currentTarget)}
              className="relative size-full object-contain"
            />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className={className} />
        )}
        {conPista && (
          <span className="absolute bottom-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
            <ZoomIn className="size-3.5" />
          </span>
        )}
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setAbierta(false)}
          className="fixed inset-0 z-[100] flex bg-black/90"
        >
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" />
          </button>
          <div className={`size-full ${real ? "overflow-auto" : "flex items-center justify-center p-3"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={(e) => {
                e.stopPropagation();
                setReal((r) => !r);
              }}
              className={
                real
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-full max-w-full cursor-zoom-in object-contain"
              }
              style={real ? { width: "200%" } : undefined}
            />
          </div>
          <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/70">
            {real ? "Toca para ajustar" : "Toca la imagen para ampliar"}
          </p>
        </div>
      )}
    </>
  );
}
