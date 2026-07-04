"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

const UMBRAL = 70; // px que hay que estirar para disparar el refresco
const MAX = 110; // tope visual del estiramiento

/**
 * Gesto de "estirar para refrescar" (pull-to-refresh) en mobile: al arrastrar
 * hacia abajo desde el tope de la página, refresca (router.refresh, sin recarga
 * completa). Útil sobre todo cuando la app está instalada ("Agregar a inicio").
 */
export function PullToRefresh() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const inicioY = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const refrescandoRef = useRef(false);

  useEffect(() => {
    function fijar(px: number) {
      offsetRef.current = px;
      setOffset(px);
    }

    function onStart(e: TouchEvent) {
      // Solo si estamos en el tope y no hay un refresco en curso.
      if (window.scrollY > 0 || refrescandoRef.current) {
        inicioY.current = null;
        return;
      }
      inicioY.current = e.touches[0].clientY;
    }

    function onMove(e: TouchEvent) {
      if (inicioY.current === null || refrescandoRef.current) return;
      const dy = e.touches[0].clientY - inicioY.current;
      if (dy > 0 && window.scrollY <= 0) {
        // Resistencia: cuesta más estirar mientras más se jala.
        fijar(Math.min(dy * 0.5, MAX));
      } else {
        fijar(0);
      }
    }

    function onEnd() {
      if (inicioY.current === null) return;
      inicioY.current = null;

      if (offsetRef.current >= UMBRAL) {
        refrescandoRef.current = true;
        setRefrescando(true);
        fijar(UMBRAL);
        router.refresh();
        // La UI del refresco vuelve sola tras revalidar los server components.
        window.setTimeout(() => {
          refrescandoRef.current = false;
          setRefrescando(false);
          fijar(0);
        }, 900);
      } else {
        fijar(0);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const activo = offset > 0 || refrescando;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center overflow-hidden sm:hidden"
      style={{ height: offset }}
    >
      <div
        className={cn(
          "bg-polla-surface/80 ring-polla-line mt-2 flex size-9 items-center justify-center rounded-full ring-1 backdrop-blur-md transition-opacity",
          activo ? "opacity-100" : "opacity-0",
        )}
      >
        <RefreshCw
          className={cn(
            "text-polla-gold size-4",
            refrescando && "animate-spin",
          )}
          style={
            refrescando
              ? undefined
              : { transform: `rotate(${(offset / UMBRAL) * 270}deg)` }
          }
        />
      </div>
    </div>
  );
}
