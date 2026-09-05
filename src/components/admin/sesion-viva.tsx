"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Mantiene viva la sesión del backoffice desde el navegador.
 *
 * Sin esto el token solo se renovaba cuando una petición pasaba por el proxy:
 * si el organizador dejaba la app abierta (o en segundo plano en el celular),
 * el access token vencía y la siguiente acción lo sacaba al login. El cliente
 * de browser de Supabase renueva el token solo, antes de que expire, y se
 * coordina entre pestañas con Web Locks para no pisarse el refresh token.
 *
 * No monta nada: es solo el lado cliente de la sesión. Va únicamente en el
 * backoffice — la página pública de una rifa no necesita sesión.
 */
export function SesionViva() {
  useEffect(() => {
    const supabase = createClient();
    // Instanciar y leer la sesión arranca el auto-refresh del cliente.
    void supabase.auth.getSession();

    // Al volver de segundo plano el token puede estar recién vencido: se
    // fuerza una revisión en vez de esperar al siguiente tick del timer.
    const alVolver = () => {
      if (document.visibilityState === "visible") void supabase.auth.getSession();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, []);

  return null;
}
