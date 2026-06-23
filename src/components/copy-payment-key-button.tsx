"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyPaymentKeyButton({ llave }: { llave: string }) {
  const [copiada, setCopiada] = useState(false);

  async function copiarLlave() {
    try {
      await navigator.clipboard.writeText(llave);
      setCopiada(true);
      window.setTimeout(() => setCopiada(false), 2_000);
    } catch {
      window.prompt("Copia la llave de pago:", llave);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={copiarLlave}
      className="border-polla-gold/50 text-polla-gold hover:bg-polla-gold/10 w-full max-w-80"
    >
      {copiada ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copiada ? "Llave copiada" : `Copiar llave ${llave}`}
    </Button>
  );
}
