import type { PatrocinadorPublico } from "@/types";

/**
 * Valla de patrocinadores bajo el título del torneo: todos los logos en una cinta
 * que corre de derecha a izquierda, sin cajas, como las vallas publicitarias.
 * Quien organiza va primero y cada grupo lleva su rótulo («Organiza», «Patrocinan»).
 * Se detiene al pasar el cursor o tocar encima; con «reducir movimiento» queda quieta
 * y se desliza con el dedo. Sin JavaScript: es solo CSS, incluido aquí mismo para no depender de la hoja global.
 */

/** Copias de la cinta: así nunca queda un hueco al reiniciar la vuelta, ni en pantallas anchas. */
const COPIAS = 6;
/** Segundos que tarda en pasar cada logo (más alto = más lento y más fácil de leer). */
const SEGUNDOS_POR_LOGO = 5;

function Logo({ p }: { p: PatrocinadorPublico }) {
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={p.logo_url!} alt={p.nombre} loading="lazy" draggable={false} className="h-16 w-auto rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4)] sm:h-20" />
  );
  return p.enlace ? (
    <a href={p.enlace} target="_blank" rel="noopener noreferrer sponsored" title={p.nombre} className="block">
      {img}
    </a>
  ) : (
    img
  );
}

export function BannerPatrocinadores({ patrocinadores }: { patrocinadores: PatrocinadorPublico[] }) {
  const lista = patrocinadores.filter((p) => p.logo_url);
  if (lista.length === 0) return null;

  const organiza = lista.filter((p) => p.rol === "organiza");
  const apoyo = lista.filter((p) => p.rol !== "organiza");
  const tituloApoyo =
    apoyo.some((p) => p.rol === "gestor") && apoyo.some((p) => p.rol === "patrocinador")
      ? "Gestores y patrocinan"
      : apoyo.some((p) => p.rol === "gestor")
        ? "Gestores"
        : "Patrocinan";

  const grupo = (copia: number) => (
    <div key={copia} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copia > 0}>
      {organiza.length > 0 && (
        <>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">Organiza</span>
          {organiza.map((p) => (
            <Logo key={p.id} p={p} />
          ))}
        </>
      )}
      {apoyo.length > 0 && (
        <>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">{tituloApoyo}</span>
          {apoyo.map((p) => (
            <Logo key={p.id} p={p} />
          ))}
        </>
      )}
    </div>
  );

  return (
    <section aria-label="Organiza y patrocinadores" className="valla mb-5">
      <style>{CSS}</style>
      <div
        className="valla-pista"
        style={{ "--copias": COPIAS, "--duracion": `${lista.length * SEGUNDOS_POR_LOGO}s` } as React.CSSProperties}
      >
        {Array.from({ length: COPIAS }, (_, i) => grupo(i))}
      </div>
    </section>
  );
}

const CSS = `
.valla{overflow:hidden;-webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent)}
.valla-pista{display:flex;width:max-content;animation:valla-correr var(--duracion,30s) linear infinite}
.valla:hover .valla-pista,.valla:active .valla-pista{animation-play-state:paused}
@keyframes valla-correr{to{transform:translateX(calc(-100% / var(--copias,6)))}}
@media (prefers-reduced-motion:reduce){.valla{overflow-x:auto;-webkit-mask-image:none;mask-image:none}.valla-pista{animation:none}}
`;
