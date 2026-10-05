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
  /**
   * Cuánto cuesta activar. `tamano` son los números de la rifa o el cupo de
   * equipos; `precioUnitario` es lo que vale un puesto (boleta / inscripción),
   * que es la base del cobro "una boleta".
   */
  precio: (c: PlataformaConfig, tamano: number, precioUnitario: number) => number;
}

/** Deja el cobro dentro del piso y el techo configurados (0 = desactivado). */
function acotar(valor: number, min: number, max: number): number {
  let v = Math.max(0, Math.round(valor));
  if (min > 0) v = Math.max(v, min);
  if (max > 0) v = Math.min(v, max);
  return v;
}

const REGLAS: Record<ProductoPlataforma, ReglasProducto> = {
  rifas: {
    tabla: "rifas",
    columnaActivacion: "activada_at",
    columnaCobro: "rifa_id",
    maxGratis: (c) => c.free_max_numeros,
    cuotaTotal: (c) => c.free_rifas_total,
    cuotaMes: (c) => c.free_rifas_por_mes,
    precio: (c, n, precioBoleta) => {
      // Regla vigente: un % del recaudo proyectado (números × precio), acotado.
      // Es la única monótona: a más recaudo, más cobro.
      if (c.cobro_rifa_modo === "porcentaje") {
        const recaudo = Math.max(0, n) * Math.max(0, precioBoleta);
        return acotar((recaudo * c.cobro_rifa_pct) / 100, c.cobro_rifa_min, c.cobro_rifa_max);
      }
      // Modo "boleta": activar la rifa cuesta lo mismo que uno de sus puestos.
      if (c.cobro_rifa_modo === "boleta") {
        return acotar(precioBoleta, c.cobro_rifa_min, c.cobro_rifa_max);
      }
      return n <= 100 ? c.precio_rifa_100 : n <= 500 ? c.precio_rifa_500 : c.precio_rifa_1000;
    },
  },
  torneos: {
    tabla: "torneos",
    columnaActivacion: "activado_at",
    columnaCobro: "torneo_id",
    maxGratis: (c) => c.free_max_equipos,
    cuotaTotal: (c) => c.free_torneos_total,
    cuotaMes: (c) => c.free_torneos_por_mes,
    // Los torneos siguen por escalones de cupo: no hay "boleta" que replicar.
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
  cobro_rifa_modo: "porcentaje",
  cobro_rifa_pct: 1,
  cobro_rifa_min: 8000,
  cobro_rifa_max: 29900,
  pro_max_rifas_ciclo: 10,
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
  /**
   * `true` → la cuenta todavía no está aprobada por el superadmin. No se cobra
   * ni se publica nada: primero pasa la revisión.
   */
  requiereAprobacion?: boolean;
  /** Con qué modalidad quedó cubierta (solo si `activada`). */
  cobroTipo: PlanTenant | null;
  /** `true` → quedó un cobro pendiente; sigue en borrador. */
  pendiente: boolean;
  /** Monto del cobro pendiente. */
  monto: number;
  /** Cobro pendiente creado (o reutilizado), para dejarlo anclado a la entidad. */
  cobroId?: string | null;
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
  /** Valor de un puesto: la boleta de la rifa o la inscripción del torneo. */
  precioUnitario?: number;
}): Promise<ResolucionActivacion> {
  const { tenantId, producto, entidadId, tamano, precioUnitario = 0 } = params;
  const reglas = REGLAS[producto];
  const svc = createServiceRoleClient();

  const [{ data: tenant }, { data: cfg }, { data: pagoData }] = await Promise.all([
    svc.from("tenants").select("suscripcion_vence_at, estado").eq("id", tenantId).maybeSingle(),
    svc.from("plataforma_config").select("*").limit(1).maybeSingle(),
    svc.from("plataforma_pago_config").select("*").limit(1).maybeSingle(),
  ]);

  const config: PlataformaConfig = {
    ...CONFIG_DEFAULT,
    ...((cfg as Partial<PlataformaConfig> | null) ?? {}),
  };
  const pago = (pagoData as PlataformaPagoConfig | null) ?? null;

  // 0) La cuenta tiene que estar aprobada. Se revisa aquí porque es el único
  // paso por el que pasa TODO lo que se hace público (rifas y torneos), y así
  // no se registra un cobro por algo que todavía no puede publicarse.
  const estadoTenant = (tenant as { estado?: string } | null)?.estado;
  if (estadoTenant && estadoTenant !== "activo") {
    return {
      activada: false,
      requiereAprobacion: true,
      cobroTipo: null,
      pendiente: false,
      monto: 0,
      pago,
    };
  }

  // 1) PRO (suscripción) vigente: cubre la activación hasta el tope del ciclo.
  const venceAt = (tenant as { suscripcion_vence_at: string | null } | null)
    ?.suscripcion_vence_at;
  if (venceAt && new Date(venceAt).getTime() > Date.now()) {
    // El ciclo es el mes que termina en `suscripcion_vence_at`.
    const desde = new Date(venceAt);
    desde.setMonth(desde.getMonth() - 1);

    const { data: cabe } = await svc.rpc("consumir_pro", {
      p_tenant: tenantId,
      p_rifa: entidadId,
      p_max: config.pro_max_rifas_ciclo,
      p_desde: desde.toISOString(),
    });

    if (cabe === true) {
      return { activada: true, cobroTipo: "suscripcion", pendiente: false, monto: 0, pago };
    }
    // Tope alcanzado: no se bloquea al organizador, se le cobra esta rifa
    // aparte (cae al paso 3).
  }

  // 2) Capa gratuita: el tamaño debe caber en el tope y quedar cuota libre.
  // El conteo y el registro pasan por `consumir_free`, que resuelve todo en una
  // sentencia con lock: dos activaciones simultáneas no gastan el mismo cupo, y
  // borrar la rifa después ya no devuelve el beneficio.
  if (tamano <= reglas.maxGratis(config)) {
    const { data: cubierta } = await svc.rpc("consumir_free", {
      p_tenant: tenantId,
      p_rifa: entidadId,
      p_producto: producto,
      p_max_total: reglas.cuotaTotal(config),
      p_max_mes: reglas.cuotaMes(config),
    });

    if (cubierta === true) {
      return { activada: true, cobroTipo: "gratis", pendiente: false, monto: 0, pago };
    }
  }

  // 3) Requiere pago: cobro pendiente; la entidad sigue en borrador.
  const monto = reglas.precio(config, tamano, precioUnitario);

  // Si ya había un cobro pendiente para esta entidad se reutiliza: repetir
  // "Activar" no debe dejar cobros duplicados en el ledger.
  const { data: existente } = await svc
    .from("cobros")
    .select("id, monto")
    .eq(reglas.columnaCobro, entidadId)
    .eq("estado", "pendiente")
    .maybeSingle();

  let cobroId = (existente as { id: string; monto: number } | null)?.id ?? null;
  const montoFinal = (existente as { monto: number } | null)?.monto ?? monto;

  if (!cobroId) {
    const { data: creado } = await svc
      .from("cobros")
      .insert({
        tenant_id: tenantId,
        producto,
        [reglas.columnaCobro]: entidadId,
        tipo: "pago_rifa", // el ledger llama así a la modalidad "pago por unidad"
        monto,
        estado: "pendiente",
      })
      .select("id")
      .single();
    cobroId = (creado as { id: string } | null)?.id ?? null;
  }

  return {
    activada: false,
    cobroTipo: null,
    pendiente: true,
    monto: montoFinal,
    cobroId,
    pago,
  };
}

/**
 * Cuánto lleva pagado el tenant en activaciones sueltas durante el ciclo en
 * curso. Es la base del upsell: si ya pagó $44.900 y PRO cuesta $59.900, se le
 * ofrece por los $15.000 de diferencia.
 *
 * Se calcula al vuelo sobre el ledger: no crea saldo a favor, no es
 * transferible y no sobrevive al ciclo.
 */
export async function creditoCicloPro(
  tenantId: string,
): Promise<{ pagado: number; precioPro: number; falta: number }> {
  const svc = createServiceRoleClient();
  const [{ data: cfg }, { data: tenant }] = await Promise.all([
    svc.from("plataforma_config").select("*").limit(1).maybeSingle(),
    svc.from("tenants").select("suscripcion_vence_at").eq("id", tenantId).maybeSingle(),
  ]);
  const config: PlataformaConfig = {
    ...CONFIG_DEFAULT,
    ...((cfg as Partial<PlataformaConfig> | null) ?? {}),
  };

  // Ciclo: el mes de la suscripción vigente, o el mes calendario si no hay.
  const venceAt = (tenant as { suscripcion_vence_at: string | null } | null)?.suscripcion_vence_at;
  let desde: Date;
  if (venceAt && new Date(venceAt).getTime() > Date.now()) {
    desde = new Date(venceAt);
    desde.setMonth(desde.getMonth() - 1);
  } else {
    const hoy = new Date();
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  const { data: cobros } = await svc
    .from("cobros")
    .select("monto")
    .eq("tenant_id", tenantId)
    .eq("tipo", "pago_rifa")
    .eq("estado", "pagado")
    .gte("pagado_at", desde.toISOString());

  const pagado = ((cobros as { monto: number }[]) ?? []).reduce((a, c) => a + c.monto, 0);
  const precioPro = config.precio_suscripcion_mes;
  return { pagado, precioPro, falta: Math.max(0, precioPro - pagado) };
}

/** Precio del escalón que le corresponde a un tamaño (para mostrar en la UI). */
export function precioEscalon(
  config: PlataformaConfig,
  producto: ProductoPlataforma,
  tamano: number,
  precioUnitario = 0,
): number {
  return REGLAS[producto].precio(config, tamano, precioUnitario);
}

/**
 * A qué porcentaje del recaudo equivale el cobro. Con el modo "boleta" el
 * resultado es 100/N y NO depende del precio del puesto: 1% en una rifa de 100
 * números, 3,3% en una de 30, 0,1% en una de 1000. Es el dato que se le muestra
 * al organizador para que no se lleve sorpresas.
 */
export function porcentajeDelRecaudo(monto: number, tamano: number, precioUnitario: number): number | null {
  const recaudo = tamano * precioUnitario;
  if (recaudo <= 0 || monto <= 0) return null;
  return (monto / recaudo) * 100;
}
