import type { ProductoPlataforma } from "@/types";

/**
 * Catálogo de verticales de la plataforma, con su copy para el backoffice.
 *
 * Vive aparte de `src/lib/productos.ts` porque aquel es `server-only` (consulta
 * Supabase) y este se necesita también en componentes de cliente.
 */
export const PRODUCTOS_UI: {
  id: ProductoPlataforma;
  nombre: string;
  descripcion: string;
}[] = [
  {
    id: "rifas",
    nombre: "Rifas",
    descripcion: "Números, pagos, sorteo y enlace público.",
  },
  {
    id: "torneos",
    nombre: "Torneos deportivos",
    descripcion:
      "Campeonatos, equipos, inscripciones, fixture, resultados y rentabilidad.",
  },
];

/** Ids de todas las verticales, en el orden en que se muestran. */
export const IDS_PRODUCTOS: ProductoPlataforma[] = PRODUCTOS_UI.map((p) => p.id);
