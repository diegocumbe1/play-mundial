export const TIPOS_CUENTA_PAGO = [
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "davivienda", label: "Davivienda" },
  { value: "nu", label: "Nu" },
  { value: "bancolombia", label: "Bancolombia" },
  { value: "otro", label: "Otro" },
] as const;

export type TipoCuentaPago = (typeof TIPOS_CUENTA_PAGO)[number]["value"] | string;

export function labelCuentaPago(tipo: string | null | undefined): string {
  if (!tipo) return "Cuenta";
  return TIPOS_CUENTA_PAGO.find((t) => t.value === tipo)?.label ?? tipo;
}
