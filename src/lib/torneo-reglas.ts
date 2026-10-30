import { z } from "zod";

import { formatCOP } from "@/lib/polla";
import type { CategoriaTorneo, PremioTorneo, Torneo } from "@/types";

/**
 * Reglas configurables de un torneo — núcleo PURO (sin I/O).
 *
 * Las preguntas que antes había que hacerle al organizador en una reunión
 * ("¿cuántos sets?", "¿qué es un referente?", "¿la premiación es garantizada?")
 * son campos de `torneos.reglas`. Cada uno tiene un valor por defecto sensato:
 * el organizador solo cambia lo que difiere de la plantilla.
 *
 * Con las respuestas se redacta el reglamento completo (`generarReglamento`),
 * así nadie tiene que escribir texto legal.
 */

// ---------------------------------------------------------------------------
// Esquema (zod v4: `prefault` aplica los defaults internos al objeto vacío)
// ---------------------------------------------------------------------------
const entero = (min = 0) => z.number().int().min(min);

export const reglasSchema = z.object({
  juego: z
    .object({
      /** Sets del partido: 1, 3 (mejor de 3) o 5. */
      sets: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(3),
      puntos_set: entero(1).default(21),
      puntos_decisivo: entero(1).default(15),
      diferencia_dos: z.boolean().default(true),
      /** Puntaje máximo del set aunque no haya diferencia de 2 (`null` = sin tope). */
      tope_puntos: entero(1).nullable().default(null),
      cambio_lado_cada: entero(0).nullable().default(7),
      tiempos_por_set: entero(0).default(1),
      tolerancia_wo_min: entero(0).default(10),
    })
    .prefault({}),
  tabla: z
    .object({
      victoria: entero().default(2),
      derrota: entero().default(1),
      wo: entero().default(0),
    })
    .prefault({}),
  participacion: z
    .object({
      solo_clientes: z.boolean().default(false),
      como_verificar_cliente: z.string().trim().default(""),
      /** Jugadores que no son clientes permitidos por equipo (`null` = sin límite). */
      max_externos: entero().nullable().default(null),
      max_referentes: entero().nullable().default(null),
      que_es_referente: z.string().trim().default(""),
      min_mujeres_cancha: entero().default(0),
      jugador_varias_categorias: z.boolean().default(false),
      edad_minima: entero(1).nullable().default(null),
    })
    .prefault({}),
  premiacion: z
    .object({
      politica: z
        .enum(["garantizada", "minimo_equipos", "proporcional"])
        .default("garantizada"),
      /** Solo con `minimo_equipos`: equipos por categoría para pagar completa. */
      minimo_equipos: entero(2).nullable().default(null),
      entrega: z.string().trim().default("Al terminar la final de cada categoría."),
    })
    .prefault({}),
  reembolso: z
    .object({
      politica: z
        .enum(["sin_reembolso", "hasta_cierre", "solo_cancelacion"])
        .default("hasta_cierre"),
    })
    .prefault({}),
});

export type ReglasTorneo = z.infer<typeof reglasSchema>;

/** Reglas válidas a partir de lo guardado (rellena lo que falte con defaults). */
export function leerReglas(raw: unknown): ReglasTorneo {
  const r = reglasSchema.safeParse(raw ?? {});
  return r.success ? r.data : reglasSchema.parse({});
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------
/** Categoría sugerida por una plantilla. */
export interface CategoriaPlantilla {
  nombre: string;
  jugadores_en_cancha: number | null;
  max_jugadores: number | null;
  cupo_equipos: number;
}

export interface ConfigPlantilla {
  formato: Torneo["formato"];
  categorias: CategoriaPlantilla[];
  reglas: ReglasTorneo;
}

/**
 * Plantilla de voleiplaya en código: es el respaldo si la tabla
 * `plantillas_torneo` no responde. La versión editable vive en la base.
 */
export const PLANTILLA_VOLEIPLAYA: ConfigPlantilla = {
  formato: "grupos_eliminacion",
  categorias: [
    { nombre: "3 vs 3", jugadores_en_cancha: 3, max_jugadores: 5, cupo_equipos: 12 },
    { nombre: "5 vs 5", jugadores_en_cancha: 5, max_jugadores: 8, cupo_equipos: 16 },
  ],
  reglas: reglasSchema.parse({}),
};

/** Lee el `config` jsonb de una plantilla; lo inválido cae al respaldo. */
export function leerConfigPlantilla(raw: unknown): ConfigPlantilla {
  const obj = (raw ?? {}) as Partial<Record<keyof ConfigPlantilla, unknown>>;
  return {
    formato: (obj.formato as Torneo["formato"]) ?? PLANTILLA_VOLEIPLAYA.formato,
    categorias: Array.isArray(obj.categorias)
      ? (obj.categorias as CategoriaPlantilla[])
      : PLANTILLA_VOLEIPLAYA.categorias,
    reglas: leerReglas(obj.reglas),
  };
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export const POLITICAS_PREMIACION: Record<
  ReglasTorneo["premiacion"]["politica"],
  string
> = {
  garantizada: "Garantizada: se paga completa sin importar cuántos equipos se inscriban",
  minimo_equipos: "Sujeta a un mínimo de equipos inscritos por categoría",
  proporcional: "Proporcional a los equipos inscritos",
};

export const POLITICAS_REEMBOLSO: Record<
  ReglasTorneo["reembolso"]["politica"],
  string
> = {
  hasta_cierre: "Se devuelve si el equipo se retira antes del cierre de inscripciones",
  solo_cancelacion: "Solo se devuelve si el organizador cancela el torneo",
  sin_reembolso: "No se devuelve en ningún caso",
};

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------
/** Valor de inscripción efectivo de una categoría. */
export function inscripcionCategoria(
  categoria: Pick<CategoriaTorneo, "valor_inscripcion">,
  torneo: Pick<Torneo, "valor_inscripcion">,
): number {
  return categoria.valor_inscripcion ?? torneo.valor_inscripcion;
}

/** Dinero en premios de una categoría. */
export function premiacionCategoria(
  premios: Pick<PremioTorneo, "categoria_id" | "tipo" | "valor">[],
  categoriaId: string,
): number {
  return premios
    .filter((p) => p.categoria_id === categoriaId && p.tipo === "valor")
    .reduce((s, p) => s + (p.valor ?? 0), 0);
}

/** Equipos necesarios para cubrir la premiación solo con inscripciones. */
export function equiposParaCubrirPremios(
  totalPremios: number,
  inscripcion: number,
): number | null {
  if (inscripcion <= 0 || totalPremios <= 0) return null;
  return Math.ceil(totalPremios / inscripcion);
}

// ---------------------------------------------------------------------------
// Reglamento automático
// ---------------------------------------------------------------------------
/** "1 punto" / "2 puntos". */
function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function textoSets(j: ReglasTorneo["juego"]): string {
  if (j.sets === 1) {
    return `Los partidos se juegan a 1 set de ${j.puntos_set} puntos.`;
  }
  return (
    `Los partidos se juegan al mejor de ${j.sets} sets. Los sets se juegan a ` +
    `${j.puntos_set} puntos y el set decisivo a ${j.puntos_decisivo} puntos.`
  );
}

/**
 * Redacta el reglamento y las condiciones del torneo a partir de las
 * respuestas del organizador. Es texto plano: la página pública lo muestra
 * tal cual (`whitespace-pre-line`) y cada equipo lo acepta al inscribirse.
 */
export function generarReglamento(
  torneo: Pick<Torneo, "nombre" | "valor_inscripcion">,
  categorias: Pick<
    CategoriaTorneo,
    "id" | "nombre" | "jugadores_en_cancha" | "max_jugadores" | "cupo_equipos" | "valor_inscripcion"
  >[],
  premios: Pick<PremioTorneo, "categoria_id" | "puesto" | "tipo" | "valor" | "descripcion">[],
  organizador: string,
  reglas: ReglasTorneo,
): string {
  const { juego, tabla, participacion: p, premiacion, reembolso } = reglas;
  const secciones: string[] = [];
  let n = 0;
  const seccion = (titulo: string, lineas: (string | null | false)[]) => {
    n += 1;
    const cuerpo = lineas.filter(Boolean).map((l) => `• ${l}`).join("\n");
    secciones.push(`${n}. ${titulo.toUpperCase()}\n${cuerpo}`);
  };

  if (categorias.length > 0) {
    seccion(
      "Categorías",
      categorias.map((c) => {
        const partes = [
          c.jugadores_en_cancha ? `${c.jugadores_en_cancha} jugadores en cancha` : null,
          c.max_jugadores ? `hasta ${c.max_jugadores} inscritos por equipo` : null,
          `cupo de ${c.cupo_equipos} equipos`,
          `inscripción de ${formatCOP(inscripcionCategoria(c, torneo))} por equipo`,
        ].filter(Boolean);
        return `${c.nombre}: ${partes.join(", ")}.`;
      }),
    );
  }

  seccion("Sistema de juego", [
    textoSets(juego),
    juego.diferencia_dos
      ? juego.tope_puntos
        ? `Se gana el set con 2 puntos de diferencia, con tope de ${juego.tope_puntos} puntos.`
        : "Se gana el set con 2 puntos de diferencia, sin tope."
      : "Gana el set quien llegue primero al puntaje, sin necesidad de diferencia.",
    juego.cambio_lado_cada
      ? `Los equipos cambian de lado cada ${juego.cambio_lado_cada} puntos.`
      : null,
    `Cada equipo tiene ${plural(juego.tiempos_por_set, "tiempo muerto", "tiempos muertos")} por set.`,
    `Tolerancia de ${juego.tolerancia_wo_min} minutos después de la hora programada. ` +
      "Pasado ese tiempo, el equipo ausente pierde por W.O.",
  ]);

  seccion("Tabla de posiciones", [
    `Partido ganado: ${plural(tabla.victoria, "punto", "puntos")}. ` +
      `Partido perdido: ${plural(tabla.derrota, "punto", "puntos")}. ` +
      `Pérdida por W.O.: ${plural(tabla.wo, "punto", "puntos")}.`,
    "Desempate, en este orden: más partidos ganados, mejor cociente de sets, " +
      "mejor cociente de puntos y resultado del partido entre los equipos empatados.",
  ]);

  seccion("Quién puede jugar", [
    p.solo_clientes
      ? `Torneo exclusivo para clientes de ${organizador}.` +
        (p.como_verificar_cliente ? ` Se verifica así: ${p.como_verificar_cliente}.` : "")
      : null,
    p.max_externos != null
      ? p.max_externos === 0
        ? "No se permiten jugadores externos."
        : `Máximo ${plural(p.max_externos, "jugador externo", "jugadores externos")} por equipo.`
      : null,
    p.max_referentes != null
      ? `Máximo ${plural(p.max_referentes, "referente", "referentes")} por equipo.` +
        (p.que_es_referente ? ` Se considera referente: ${p.que_es_referente}.` : "")
      : null,
    p.min_mujeres_cancha > 0
      ? `Mínimo ${plural(p.min_mujeres_cancha, "mujer", "mujeres")} en cancha durante todo el partido. ` +
        "Si no se cumple, el equipo pierde el partido."
      : null,
    p.jugador_varias_categorias
      ? "Un jugador puede inscribirse en más de una categoría."
      : "Cada jugador puede inscribirse en un solo equipo y una sola categoría.",
    p.edad_minima ? `Edad mínima: ${p.edad_minima} años.` : null,
    "La plantilla inscrita no se puede cambiar después del cierre de inscripciones.",
  ]);

  const lineasPremios = categorias.flatMap((c) => {
    const lista = premios
      .filter((pr) => pr.categoria_id === c.id)
      .sort((a, b) => a.puesto - b.puesto)
      .map((pr) =>
        `${pr.puesto}° puesto: ${pr.tipo === "valor" && pr.valor ? formatCOP(pr.valor) : pr.descripcion}`,
      );
    return lista.length ? [`${c.nombre} — ${lista.join(" · ")}.`] : [];
  });
  seccion("Premiación", [
    ...lineasPremios,
    POLITICAS_PREMIACION[premiacion.politica] + ".",
    premiacion.politica === "minimo_equipos" && premiacion.minimo_equipos
      ? `Para pagar la premiación completa se necesitan al menos ${premiacion.minimo_equipos} ` +
        "equipos confirmados en la categoría."
      : null,
    `Entrega de premios: ${premiacion.entrega}`,
    "Los premios en dinero pueden estar sujetos a las retenciones de ley.",
  ]);

  seccion("Inscripción y reembolsos", [
    "La inscripción queda confirmada cuando el organizador valida el pago.",
    POLITICAS_REEMBOLSO[reembolso.politica] + ".",
    "Si el organizador cancela el torneo, se devuelve el valor completo de la inscripción.",
  ]);

  seccion("Condiciones generales", [
    "Las decisiones del árbitro en cancha son definitivas.",
    "Cada jugador participa bajo su propia responsabilidad y declara estar en condiciones de salud para jugar.",
    "Los participantes autorizan el uso de fotos y videos del torneo en las redes del organizador y sus patrocinadores.",
    "La conducta antideportiva puede sancionarse con la pérdida del partido o la expulsión del torneo.",
    `El organizador del torneo es ${organizador}. La plataforma solo provee la herramienta de gestión.`,
    "Los datos personales se tratan únicamente para gestionar el torneo, conforme a la Ley 1581 de 2012.",
  ]);

  return `REGLAMENTO Y CONDICIONES — ${torneo.nombre}\n\n${secciones.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Guía de configuración (lo que falta para publicar)
// ---------------------------------------------------------------------------
export interface PasoConfiguracion {
  id: string;
  titulo: string;
  ayuda: string;
  hecho: boolean;
}

/**
 * Lista de pasos que guía al organizador en los primeros 10 minutos. Solo
 * mira datos: la UI decide a dónde lleva cada paso.
 */
export function pasosConfiguracion(
  torneo: Pick<Torneo, "fecha_inicio" | "escenario" | "reglamento" | "estado" | "reglas">,
  categorias: Pick<CategoriaTorneo, "id">[],
  premios: Pick<PremioTorneo, "categoria_id">[],
  pagoConfigurado: boolean,
): PasoConfiguracion[] {
  const reglasGuardadas = Object.keys(torneo.reglas ?? {}).length > 0;
  const todasConPremio =
    categorias.length > 0 &&
    categorias.every((c) => premios.some((p) => p.categoria_id === c.id));
  return [
    {
      id: "datos",
      titulo: "Fechas y sede",
      ayuda: "Cuándo empieza y dónde se juega.",
      hecho: !!torneo.fecha_inicio && !!torneo.escenario,
    },
    {
      id: "categorias",
      titulo: "Categorías y premiación",
      ayuda: "Cada categoría con su cupo, inscripción y premios por puesto.",
      hecho: todasConPremio,
    },
    {
      id: "reglas",
      titulo: "Reglas del juego y de participación",
      ayuda: "Sets, puntos, quién puede jugar y qué pasa con la premiación.",
      hecho: reglasGuardadas,
    },
    {
      id: "reglamento",
      titulo: "Reglamento generado",
      ayuda: "Se redacta solo con las reglas. Revísalo antes de publicar.",
      hecho: !!torneo.reglamento?.trim(),
    },
    {
      id: "cobro",
      titulo: "Datos de cobro",
      ayuda: "Cuenta, Bre-B o QR para que los equipos paguen la inscripción.",
      hecho: pagoConfigurado,
    },
    {
      id: "publicar",
      titulo: "Publicar y compartir el enlace",
      ayuda: "Abre las inscripciones y comparte por WhatsApp.",
      hecho: torneo.estado !== "borrador",
    },
  ];
}
