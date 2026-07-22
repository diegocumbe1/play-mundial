"use client";

import { Input } from "@/components/ui/input";

/**
 * Input de dinero que muestra separadores de miles ("1.000.000") mientras se
 * escribe, pero mantiene en el estado solo los dígitos ("1000000"), listo para
 * `Number(...)`.
 */
export function InputMoneda({
  value,
  onChange,
  placeholder,
  id,
}: {
  /** Solo dígitos, ej. "20000". */
  value: string;
  onChange: (soloDigitos: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const display = value ? Number(value).toLocaleString("es-CO") : "";

  return (
    <Input
      id={id}
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}
