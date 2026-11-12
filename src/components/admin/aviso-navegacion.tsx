"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CACHE = "nav-aviso";
const CLAVE = "/__nav";
/** Un aviso tocado hace más que esto ya no cuenta: el usuario abrió la app por su cuenta. */
const VIGENCIA_MS = 2 * 60_000;

/**
 * Lleva al partido o torneo de la notificación que se tocó.
 *
 * En iPhone, tocar una notificación abre la app instalada donde la dejaste (o en
 * su inicio) y no siempre respeta el enlace del aviso. Por eso el service worker
 * guarda a dónde iba (public/sw.js) y esta pieza, al abrirse la app o volver a
 * primer plano, navega ahí una sola vez. No pinta nada.
 */
export function AvisoNavegacion() {
  const router = useRouter();

  useEffect(() => {
    if (!("caches" in window)) return;
    let activo = true;

    async function revisar() {
      try {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(CLAVE);
        if (!hit) return;
        await cache.delete(CLAVE); // se usa una sola vez
        const { url, ts } = (await hit.json()) as { url?: string; ts?: number };
        if (!activo || !url || !ts || Date.now() - ts > VIGENCIA_MS) return;
        // Solo rutas de esta misma app.
        if (!url.startsWith("/") || url.startsWith("//")) return;
        const actual = window.location.pathname + window.location.search;
        if (actual !== url) router.push(url);
      } catch {
        /* sin caché disponible: la navegación normal del aviso hace lo que puede */
      }
    }

    void revisar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void revisar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("pageshow", alVolver);
    return () => {
      activo = false;
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("pageshow", alVolver);
    };
  }, [router]);

  return null;
}
