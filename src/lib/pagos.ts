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

/** Forma común de `tenant_pago_config` y `plataforma_pago_config`. */
export type PagoConfigLike = {
  nequi_llave?: string | null;
  cuenta_tipo?: string | null;
  cuenta_numero?: string | null;
  llave?: string | null;
  titular?: string | null;
  qr_url?: string | null;
  whatsapp?: string | null;
  mensaje_qr?: string | null;
};

/** Aviso por defecto cuando la config no trae mensaje propio. */
export const MENSAJE_QR_DEFAULT =
  "El pago se hace desde tu app bancaria. Aquí no se cobra ni se redirige al banco: descarga el QR o copia la llave.";

export type DatosCuentaPago = {
  /** Entidad (Nequi, Daviplata, banco…) o `null` si no hay cuenta cargada. */
  entidad: string | null;
  numero: string | null;
  titular: string | null;
  /** Llave Bre-B / alias. */
  llave: string | null;
  qrUrl: string | null;
  whatsapp: string | null;
  mensajeQr: string;
  /** Hay al menos una forma de pagar (cuenta, llave o QR). */
  configurado: boolean;
};

/**
 * Normaliza la config de cobro (de tenant o de plataforma) a los datos que se
 * pintan. Ninguna cuenta va quemada en el código: si el organizador no la
 * configuró, no hay datos de pago que mostrar.
 */
export function datosCuentaPago(
  pago: PagoConfigLike | null | undefined,
): DatosCuentaPago {
  const numero = pago?.cuenta_numero?.trim() || pago?.nequi_llave?.trim() || null;
  const tipo = pago?.cuenta_tipo?.trim() || (pago?.nequi_llave?.trim() ? "nequi" : null);
  const llave = pago?.llave?.trim() || null;
  const qrUrl = pago?.qr_url?.trim() || null;

  return {
    entidad: numero ? labelCuentaPago(tipo) : null,
    numero,
    titular: pago?.titular?.trim() || null,
    llave,
    qrUrl,
    whatsapp: pago?.whatsapp?.trim() || null,
    mensajeQr: pago?.mensaje_qr?.trim() || MENSAJE_QR_DEFAULT,
    configurado: Boolean(numero || llave || qrUrl),
  };
}
