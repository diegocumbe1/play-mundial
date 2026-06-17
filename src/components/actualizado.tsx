"use client";

import { useSyncExternalStore } from "react";

/**
 * Muestra hace cuánto se refrescó el dato ("Actualizado hace 2 min"), igual que
 * el "Se actualizó a las…" de Google. Es honesto: no inventa el minuto del
 * partido, solo dice qué tan fresco es el marcador que sí tenemos.
 *
 * Usa `useSyncExternalStore` para leer el reloj sin desajustes de hidratación.
 */

// Reloj compartido: solo cambia al disparar el interval (snapshot estable).
let ahoraCache = Date.now();

function subscribe(callback: () => void) {
  const id = setInterval(() => {
    ahoraCache = Date.now();
    callback();
  }, 30_000);
  return () => clearInterval(id);
}

const getSnapshot = () => ahoraCache;
const getServerSnapshot = (): number | null => null;

function formatHace(segundos: number): string {
  if (segundos < 60) return "hace un momento";
  const min = Math.floor(segundos / 60);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  return `hace ${horas} h`;
}

export function Actualizado({ iso }: { iso: string }) {
  const ahora = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (ahora === null) return null;

  const seg = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 1000));
  return <span>Actualizado {formatHace(seg)}</span>;
}
