import { z } from "zod";

import type { ReglasTorneo } from "@/lib/torneo-reglas";

/**
 * Plantilla de jugadores — núcleo PURO. La misma validación corre en el
 * formulario (aviso en vivo) y en el servidor (no se confía en el navegador).
 */

export const jugadorInputSchema = z.object({
  nombre: z.string().trim().min(3, "Escribe el nombre completo de cada jugador"),
  documento: z
    .string()
    .trim()
    .transform((v) => v.replace(/[.\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{5,15}$/, "Documento inválido (solo números o letras, 5 a 15)")),
  genero: z.enum(["femenino", "masculino"], { error: "Indica el género de cada jugador" }),
  es_externo: z.boolean().default(false),
  es_referente: z.boolean().default(false),
  referencia_cliente: z.string().trim().nullable().optional(),
});

export type JugadorInput = z.input<typeof jugadorInputSchema>;
export type JugadorValido = z.output<typeof jugadorInputSchema>;

/** Documento normalizado para comparar (sin puntos, espacios ni guiones). */
export function normalizarDocumento(doc: string): string {
  return doc.replace(/[.\s-]/g, "").toUpperCase();
}

export interface LimitesPlantilla {
  /** Mínimo de inscritos: los que juegan en cancha. */
  minimo: number | null;
  maximo: number | null;
}

/**
 * Errores de la plantilla según las reglas del torneo, en lenguaje del
 * organizador. Vacío = la plantilla cumple.
 *
 * `documentosOcupados`: documentos ya inscritos en OTROS equipos donde este
 * jugador no puede estar (todo el torneo, o la misma categoría si se permite
 * jugar en varias).
 */
export function erroresPlantilla(
  jugadores: Pick<JugadorValido, "nombre" | "documento" | "genero" | "es_externo" | "es_referente" | "referencia_cliente">[],
  reglas: ReglasTorneo["participacion"],
  limites: LimitesPlantilla,
  documentosOcupados: Set<string> = new Set(),
): string[] {
  const errores: string[] = [];
  const n = jugadores.length;

  if (limites.minimo && n < limites.minimo) {
    errores.push(`Inscribe al menos ${limites.minimo} jugadores (los que juegan en cancha).`);
  }
  if (limites.maximo && n > limites.maximo) {
    errores.push(`Máximo ${limites.maximo} jugadores por equipo.`);
  }

  const vistos = new Set<string>();
  for (const j of jugadores) {
    const doc = normalizarDocumento(j.documento);
    if (!doc) continue;
    if (vistos.has(doc)) errores.push(`El documento ${doc} está repetido en el equipo.`);
    vistos.add(doc);
    if (documentosOcupados.has(doc)) {
      errores.push(`${j.nombre || doc} ya está inscrito en otro equipo del torneo.`);
    }
  }

  if (reglas.solo_clientes) {
    const externos = jugadores.filter((j) => j.es_externo).length;
    if (reglas.max_externos != null && externos > reglas.max_externos) {
      errores.push(
        reglas.max_externos === 0
          ? "Este torneo no permite jugadores externos."
          : `Máximo ${reglas.max_externos} externo(s) por equipo; marcaste ${externos}.`,
      );
    }
    const sinReferencia = jugadores.filter((j) => !j.es_externo && !j.referencia_cliente?.trim());
    if (sinReferencia.length > 0) {
      errores.push(
        `Falta cómo demuestra que es cliente: ${sinReferencia.map((j) => j.nombre || "jugador").join(", ")}.`,
      );
    }
  }

  const referentes = jugadores.filter((j) => j.es_referente).length;
  if (reglas.max_referentes != null && referentes > reglas.max_referentes) {
    errores.push(`Máximo ${reglas.max_referentes} referente(s) por equipo; marcaste ${referentes}.`);
  }

  const mujeres = jugadores.filter((j) => j.genero === "femenino").length;
  if (reglas.min_mujeres_cancha > 0 && n > 0 && mujeres < reglas.min_mujeres_cancha) {
    errores.push(
      `Se exige mínimo ${reglas.min_mujeres_cancha} mujer(es) en cancha: inscribe al menos ${reglas.min_mujeres_cancha}.`,
    );
  }

  return errores;
}
