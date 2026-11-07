import { MARCA_SIMBOLO_PATH } from "@/lib/marca";

/** Símbolo de la marca. Toma el color del texto: se pinta con `text-*`. */
export function MarcaSimbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" d={MARCA_SIMBOLO_PATH} />
    </svg>
  );
}
