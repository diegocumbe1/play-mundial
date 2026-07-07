import { createServiceRoleClient } from "@/lib/supabase/server";

import type { DetalleFlash } from "@/types";

import {
  fetchDetallePartido,
  fetchMundialResultados,
  flashscoreActivo,
  normalizarNombre,
} from "./flashscore";

/**
 * Auto-completa el marcador REGLAMENTARIO (90') de los partidos finalizados
 * usando flashscore, para no depender del ajuste manual.
 *
 * Por qué hace falta: los proveedores "fuente de verdad" (football-data /
 * api-football) dejan el reglamentario en null o, peor, con el marcador que
 * INCLUYE el alargue en partidos de eliminatoria. Flashscore reconstruye el
 * 90' exacto desde el feed de goles (ver `fetchMarcadorReglamentario`).
 *
 * Cuota: primero hace una consulta barata a la BD. Si no hay ningún partido
 * finalizado pendiente de confirmar, NO llama a flashscore. Cuando sí lo llama,
 * bloquea el resultado (`resultado_manual = true`) para (a) que el sync diario
 * no lo pise y (b) no volver a pedir su `summary` en cada corrida.
 */

/** Ventana de tolerancia para cruzar un partido nuestro con el de flashscore. */
const MATCH_VENTANA_MS = 36 * 60 * 60 * 1000;

/**
 * Cruce tolerante de nombres entre proveedores: igualdad tras normalizar, o que
 * uno contenga al otro (p.ej. "Cape Verde Islands" ⊇ "Cape Verde"). Exige
 * longitud mínima para no dar falsos positivos con nombres muy cortos.
 */
function mismoEquipo(a: string | null, b: string): boolean {
  const na = normalizarNombre(a ?? "");
  const nb = normalizarNombre(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
}

interface ResumenAutoFill {
  pendientes: number;
  autollenados: number;
  sinCruce: number;
}

export async function autocompletarReglamentario(): Promise<ResumenAutoFill> {
  const vacio: ResumenAutoFill = {
    pendientes: 0,
    autollenados: 0,
    sinCruce: 0,
  };
  if (!flashscoreActivo()) return vacio;

  const supabase = createServiceRoleClient();

  // Gate barato: finalizados de la API que aún NO tienen el detalle de
  // flashscore. Incluye los verificados manualmente (a esos solo les agregamos
  // el detalle informativo, sin tocar su reglamentario). Una vez enriquecidos,
  // `detalle_flash` deja de ser null y no se vuelven a pedir.
  const { data: pendientes } = await supabase
    .from("partidos")
    .select("id,equipo_local,equipo_visitante,fecha,resultado_manual")
    .eq("fuente", "api")
    .eq("estado", "finalizado")
    .is("detalle_flash", null);

  if (!pendientes || pendientes.length === 0) return vacio;

  // Recién ahora gastamos 1 request: todos los resultados del torneo.
  const resultados = await fetchMundialResultados();

  let autollenados = 0;
  let sinCruce = 0;

  for (const p of pendientes) {
    const fs = resultados.find((r) => {
      const cerca =
        Math.abs(r.timestamp * 1000 - new Date(p.fecha).getTime()) <
        MATCH_VENTANA_MS;
      return (
        cerca &&
        mismoEquipo(r.home_team.name, p.equipo_local) &&
        mismoEquipo(r.away_team.name, p.equipo_visitante)
      );
    });

    if (!fs) {
      sinCruce += 1;
      continue;
    }

    // 1 request por partido (solo la primera vez; luego detalle_flash != null).
    const detalle = await fetchDetallePartido(fs.match_id);

    // Final REAL = reglamentario + alargue (sin tanda de penales).
    const detalleFlash: DetalleFlash = {
      final: {
        local: detalle.reglamentario.local + (detalle.alargue?.local ?? 0),
        visitante:
          detalle.reglamentario.visitante + (detalle.alargue?.visitante ?? 0),
      },
      alargue: detalle.alargue,
      penales: detalle.penales,
      goleadores: detalle.goleadores,
      match_id: fs.match_id,
    };

    // Siempre guardamos el detalle informativo. El reglamentario (que liquida)
    // solo lo escribimos/bloqueamos si el admin NO lo confirmó a mano.
    const cambios: Record<string, unknown> = { detalle_flash: detalleFlash };
    if (!p.resultado_manual) {
      cambios.goles_reglamentario_local = detalle.reglamentario.local;
      cambios.goles_reglamentario_visitante = detalle.reglamentario.visitante;
      cambios.resultado_manual = true;
    }

    const { error } = await supabase
      .from("partidos")
      .update(cambios)
      .eq("id", p.id);

    if (!error) autollenados += 1;
  }

  return { pendientes: pendientes.length, autollenados, sinCruce };
}
