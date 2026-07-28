import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  PlanTenant,
  PlataformaConfig,
  PlataformaPagoConfig,
  ProductoPlataforma,
} from "@/types";

/**
 * Servicio COMÚN de activación (planes, cuota gratuita y prepago).
 *
 * Antes esta lógica vivía dentro de `activarRifa`. Al llegar la segunda
 * vertical se extrajo aquí para no duplicarla: rifas y torneos deciden igual y
 * cobran igual; solo cambian el escalón de precio y la unidad de tamaño
 * (números vs. equipos).
 *
 * Orden de decisión (idéntico al histórico de rifas):
 *   1. ¿Suscripción vigente? → activa sin cobrar.
 *   2. ¿Cabe en la capa gratuita (tamaño y cuota)? → activa como `gratis`.
 *   3. Si no → crea un cobro PENDIENTE y deja la entidad en borrador hasta que
 *      el superadmin confirme el pago.
 *
 * Hace I/O (Supabase con service role): es un servicio de servidor, no un
 * núcleo puro. Los cálculos sin I/O viven en `src/lib/rifa.ts` y `torneos.ts`.
 */

/** Cómo se llama cada cosa del producto en la base de datos. */
interface ReglasProducto {
  /** Tabla del dominio (para contar las activaciones gratis). */
  tabla: string;
  /** Columna con la fecha de activación (rifas: `activada_at`; torneos: `activado_at`). */
  columnaActivacion: string;
  /** Columna del ledger `cobros` que apunta a la entidad. */
  columnaCobro: "rifa_id" | "torneo_id";
  /** Tope de tamaño que admite el plan gratis. */
  maxGratis: (c: PlataformaConfig) => number;
  /** Cuántas activaciones gratis se permiten en total y por mes. */
  cuotaTotal: (c: PlataformaConfig) => number;
  cuotaMes: (c: PlataformaConfig) => number;
  /** Precio del escalón según el tamaño (números de la rifa / cupo de equipos). */
  precio: (c: PlataformaConfig, tamano: number) => number;
}

const REGLAS: Record<ProductoPlataforma, ReglasProducto> = {
  rifas: {
    tabla: "rifas",
    columnaActivacion: "activada_at",
    columnaCobro: "rifa_id",
    maxGratis: (c) => c.free_max_numeros,
    cuotaTotal: (c) => c.free_rifas_total,
    cuotaMes: (c) => c.free_rifas_por_mes,
    precio: (c, n) =>
      n <= 100 ? c.precio_rifa_100 : n <= 500 ? c.precio_rifa_500 : c.precio_rifa_1000,
  },
  torneos: {
    tabla: "torneos",
    columnaActivacion: "activado_at",
    columnaCobro: "torneo_id",
    maxGratis: (c) => c.free_max_equipos,
    cuotaTotal: (c) => c.free_torneos_total,
    cuotaMes: (c) => c.free_torneos_por_mes,
    precio: (c, n) =>
      n <= 8
        ? c.precio_torneo_8
        : n <= 16
          ? c.precio_torneo_16
          : n <= 32
            ? c.precio_torneo_32
            : c.precio_torneo_mas,
  },
};

/** Valores por defecto si aún no existe la fila de configuración. */
const CONFIG_DEFAULT: PlataformaConfig = {
  moneda: "COP",
  precio_rifa_100: 0,
  precio_rifa_500: 0,
  precio_rifa_1000: 0,
  precio_suscripcion_mes: 0,
  free_rifas_por_mes: 1,
  free_rifas_total: 2,
  free_max_numeros: 100,
  precio_torneo_8: 0,
  precio_torneo_16: 0,
  precio_torneo_32: 0,
  precio_torneo_mas: 0,
  free_torneos_por_mes: 1,
  free_torneos_total: 2,
  free_max_equipos: 8,
  updated_at: new Date(0).toISOString(),
};

/** Qué hacer con la entidad que se quiso activar. */
export interface ResolucionActivacion {
  /** `true` → el llamador debe marcarla como activa. */
  activada: boolean;
  /** Con qué modalidad quedó cubierta (solo si `activada`). */
  cobroTipo: PlanTenant | null;
  /** `true` → quedó un cobro pendiente; sigue en borrador. */
  pendiente: boolean;
  /** Monto del cobro pendiente. */
  monto: number;
  /** Datos de transferencia de la plataforma, para mostrarle al organizador. */
  pago: PlataformaPagoConfig | null;
}

/**
 * Decide si una entidad puede activarse y, si toca pagar, registra el cobro
 * pendiente. NO cambia el estado de la entidad: eso lo hace el llamador, que
 * conoce sus propias columnas.
 */
export async function resolverActivacion(params: {
  tenantId: string;
  producto: ProductoPlataforma;
  /** Id de la rifa o del torneo que se está activando. */
  entidadId: string;
  /** Tamaño con el que se cotiza: números de la rifa o cupo de equipos. */
  tamano: number;
}): Promise<ResolucionActivacion> {
  const { tenantId, producto, entidadId, tamano } = params;
  const reglas = REGLAS[producto];
  const svc = createServiceRoleClient();

  const [{ data: tenant }, { data: cfg }, { data: pagoData }] = await Promise.all([
    svc.from("tenants").select("suscripcion_vence_at").eq("id", tenantId).maybeSingle(),
    svc.from("plataforma_config").select("*").limit(1).maybeSingle(),
    svc.from("plataforma_pago_config").select("*").limit(1).maybeSingle(),
  ]);

  const config: PlataformaConfig = {
    ...CONFIG_DEFAULT,
    ...((cfg as Partial<PlataformaConfig> | null) ?? {}),
  };
  const pago = (pagoData as PlataformaPagoConfig | null) ?? null;

  // 1) Suscripción vigente: activa sin cobrar.
  const venceAt = (tenant as { suscripcion_vence_at: string | null } | null)
    ?.suscripcion_vence_at;
  if (venceAt && new Date(venceAt).getTime() > Date.now()) {
    return { activada: true, cobroTipo: "suscripcion", pendiente: false, monto: 0, pago };
  }

  // 2) Capa gratuita: el tamaño debe caber en el tope y quedar cuota libre.
  if (tamano <= reglas.maxGratis(config)) {
    const { data: gratis } = await svc
      .from(reglas.tabla)
      .select(reglas.columnaActivacion)
      .eq("tenant_id", tenantId)
      .eq("cobro_tipo", "gratis");

    const usadas = (gratis as unknown as Record<string, string | null>[]) ?? [];
    const ahora = new Date();
    const esteMes = usadas.filter((fila) => {
      const f = fila[reglas.columnaActivacion];
      if (!f) return false;
      const d = new Date(f);
      return (
        d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth()
      );
    }).length;

    if (usadas.length < reglas.cuotaTotal(config) && esteMes < reglas.cuotaMes(config)) {
      return { activada: true, cobroTipo: "gratis", pendiente: false, monto: 0, pago };
    }
  }

  // 3) Requiere pago: cobro pendiente; la entidad sigue en borrador.
  const monto = reglas.precio(config, tamano);
  await svc.from("cobros").insert({
    tenant_id: tenantId,
    producto,
    [reglas.columnaCobro]: entidadId,
    tipo: "pago_rifa", // el ledger llama así a la modalidad "pago por unidad"
    monto,
    estado: "pendiente",
  });

  return { activada: false, cobroTipo: null, pendiente: true, monto, pago };
}

/** Precio del escalón que le corresponde a un tamaño (para mostrar en la UI). */
export function precioEscalon(
  config: PlataformaConfig,
  producto: ProductoPlataforma,
  tamano: number,
): number {
  return REGLAS[producto].precio(config, tamano);
}
