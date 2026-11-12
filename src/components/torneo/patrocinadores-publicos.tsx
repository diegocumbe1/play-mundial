import { cn } from "@/lib/utils";
import type { PatrocinadorPublico } from "@/types";

/**
 * Patrocinadores en la página pública del torneo, sin invadir la lectura:
 * - Una línea discreta bajo el título (logos pequeños, sin banners fijos).
 * - Una franja al final, como el pie de los afiches: «Organiza» y
 *   «Gestores y patrocinadores».
 * Solo llegan los publicados con imagen; sin ninguno no se pinta nada.
 */

type Bloque = { titulo: string; lista: PatrocinadorPublico[]; organiza: boolean };

function Logo({ p, className }: { p: PatrocinadorPublico; className?: string }) {
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={p.logo_url!} alt={p.nombre} loading="lazy" className={cn("rounded-lg object-contain", className)} />
  );
  return p.enlace ? (
    <a href={p.enlace} target="_blank" rel="noopener noreferrer sponsored" title={p.nombre} className="contents">
      {img}
    </a>
  ) : (
    img
  );
}

/** Agrupa como en los afiches: quien organiza, y gestores + patrocinadores juntos. */
function bloques(patrocinadores: PatrocinadorPublico[]): Bloque[] {
  const organiza = patrocinadores.filter((p) => p.rol === "organiza");
  const gestores = patrocinadores.filter((p) => p.rol === "gestor");
  const patro = patrocinadores.filter((p) => p.rol === "patrocinador");
  const apoyo = [...gestores, ...patro];
  const tituloApoyo =
    gestores.length && patro.length ? "Gestores y patrocinadores" : gestores.length ? "Gestores" : "Patrocinadores";
  const out: Bloque[] = [];
  if (organiza.length) out.push({ titulo: "Organiza", lista: organiza, organiza: true });
  if (apoyo.length) out.push({ titulo: tituloApoyo, lista: apoyo, organiza: false });
  return out;
}

/** Línea compacta bajo el título: logos pequeños, sin banners ni elementos fijos. */
export function CabeceraPatrocinadores({ patrocinadores }: { patrocinadores: PatrocinadorPublico[] }) {
  const grupos = bloques(patrocinadores);
  if (grupos.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Organiza y patrocinadores">
      {grupos.map((g) => (
        <div key={g.titulo} className="flex items-center gap-2">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{g.titulo}</span>
          <div className="flex items-center gap-1.5">
            {g.lista.map((p) => (
              <div key={p.id} className="flex h-9 w-16 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] p-0.5 backdrop-blur-md">
                <Logo p={p} className="max-h-full max-w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Franja del final con todos los logos, agrupados por rol. */
export function FranjaPatrocinadores({ patrocinadores }: { patrocinadores: PatrocinadorPublico[] }) {
  const grupos = bloques(patrocinadores);
  if (grupos.length === 0) return null;
  return (
    <section className="border-border mb-6 rounded-2xl border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {grupos.map((g) => (
          <div key={g.titulo} className={cn("min-w-0", !g.organiza && "flex-1")}>
            <p className="text-muted-foreground mb-2 text-center text-[11px] font-semibold uppercase tracking-wide sm:text-left">
              {g.titulo}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {g.lista.map((p) => (
                <div key={p.id} className="flex items-center justify-center">
                  <Logo p={p} className="h-16 w-auto rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4)] sm:h-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
