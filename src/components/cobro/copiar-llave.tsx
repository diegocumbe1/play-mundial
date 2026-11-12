"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia la llave de pago con un toque. No sale al imprimir ni en el PDF. */
export function CopiarLlave({ llave }: { llave: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(llave);
      } else {
        // Navegadores viejos: copia con un campo temporal.
        const campo = document.createElement("textarea");
        campo.value = llave;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        document.execCommand("copy");
        campo.remove();
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* si el navegador no deja copiar, la llave sigue visible para copiarla a mano */
    }
  }

  return (
    <button type="button" onClick={copiar} className="cc-copiar cc-noprint" aria-label={`Copiar la llave ${llave}`}>
      {copiado ? <Check size={15} /> : <Copy size={15} />}
      {copiado ? "Copiada" : "Copiar llave"}
    </button>
  );
}
