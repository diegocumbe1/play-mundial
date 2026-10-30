"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Piezas de formulario compartidas por la vertical de torneos. Espejan el
 * lenguaje visual de `rifa-form.tsx` para que ambos backoffices se sientan
 * la misma aplicación.
 */

/** Campo con etiqueta encima. */
export function Campo({
  label,
  ayuda,
  info,
  className,
  children,
}: {
  label: string;
  ayuda?: string;
  /** Explicación del concepto: se abre tocando el ⓘ (funciona en celular). */
  info?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <Label className="text-muted-foreground block text-xs font-medium">{label}</Label>
        {info && <InfoToggle>{info}</InfoToggle>}
      </div>
      {children}
      {ayuda && <p className="text-muted-foreground mt-1 text-xs">{ayuda}</p>}
    </div>
  );
}

/**
 * Ícono ⓘ que despliega una explicación debajo. Se usa en vez de un tooltip
 * de hover porque el organizador configura desde el celular.
 */
export function InfoToggle({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Ocultar explicación" : "¿Qué significa?"}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full transition-colors",
          abierto ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Info className="size-3.5" />
      </button>
      {abierto && (
        <span className="bg-primary/10 text-foreground order-last mt-1 block w-full basis-full rounded-lg px-2.5 py-2 text-xs leading-relaxed">
          {children}
        </span>
      )}
    </>
  );
}

/** Grupo de botones excluyentes (alternativa compacta a un select). */
export function Segmentado({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="border-border inline-flex flex-wrap gap-1 rounded-lg border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Select con el mismo alto y borde que el `Input` de base-nova. */
export function Selector({
  value,
  onChange,
  children,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
    >
      {children}
    </select>
  );
}

/** Área de texto con el estilo del `Input`. */
export function AreaTexto({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3"
    />
  );
}
