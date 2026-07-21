import { unstable_cache } from "next/cache";

import {
  fetchMundialEnVivo,
  flashscoreActivo,
  type PartidoVivoFlash,
} from "@/lib/futbol-api/flashscore";
import { hayPartidoActivo } from "@/lib/futbol-api/ventana-activa";

/**
 * Feed EN VIVO del Mundial (minuto real, marcador, rojas) desde flashscore.
 *
 * Sostenibilidad de cuota (clave):
 *   1. Gate de ventana activa: fuera de partido NO se llama a flashscore (0).
 *   2. Caché COMPARTIDA (`unstable_cache`, TTL configurable): N usuarios pollean
 *      esta ruta pero flashscore se consulta como mucho 1 vez por TTL, sin
 *      importar cuántos la miren. Así el consumo no crece con la audiencia.
 *
 * Techo de consumo demostrable por ventana de partido (~150 min):
 *   150 min / TTL. Con TTL=60s → 150 requests/partido. Ver .env.example.
 */

const TTL_SEG = Number(process.env.FLASHSCORE_LIVE_TTL_SEG ?? 60);

interface RespuestaVivo {
  activo: boolean;
  actualizado: number;
  partidos: PartidoVivoFlash[];
}

const getVivoCacheado = unstable_cache(
  async (): Promise<RespuestaVivo> => {
    // Gate: sin key o fuera de ventana activa, no gastamos cuota.
    if (!flashscoreActivo() || !(await hayPartidoActivo())) {
      return { activo: false, actualizado: Date.now(), partidos: [] };
    }
    const partidos = await fetchMundialEnVivo();
    return { activo: true, actualizado: Date.now(), partidos };
  },
  ["flashscore-vivo"],
  { revalidate: TTL_SEG, tags: ["flashscore-vivo"] },
);

export async function GET() {
  // Polla archivada: no se consulta a flashscore ni se sirve vivo (0 cuota).
  if (process.env.POLLA_ACTIVA !== "true") {
    return Response.json({
      activo: false,
      actualizado: Date.now(),
      partidos: [],
    } satisfies RespuestaVivo);
  }
  try {
    return Response.json(await getVivoCacheado());
  } catch {
    // Nunca romper la UI por un fallo del proveedor: devolvemos vacío.
    return Response.json({
      activo: false,
      actualizado: Date.now(),
      partidos: [],
    } satisfies RespuestaVivo);
  }
}
