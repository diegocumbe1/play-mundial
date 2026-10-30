import type { DecoracionRifa } from "@/lib/temas-rifa";

/**
 * Adornos decorativos de la página pública de una rifa. Se dibujan en las
 * esquinas, detrás del contenido, con los colores del tema. Puramente estético
 * (aria-hidden) y sin costo de red: SVG inline.
 */
export function Decoracion({
  tipo,
  accent,
  suave,
  claro,
  escala = "pagina",
}: {
  tipo: DecoracionRifa;
  /** Color de acento del tema. */
  accent: string;
  /** Tono suave (relleno principal de los adornos). */
  suave: string;
  /** Tono muy claro (detalles). */
  claro: string;
  /** `mini` = vista previa del formulario (adornos más chicos). */
  escala?: "pagina" | "mini";
}) {
  if (tipo === "ninguna") return null;
  if (tipo === "navidad") return <Navidad mini={escala === "mini"} />;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 100 100"
        className="absolute -left-6 -top-6 w-40 opacity-70 sm:w-52"
        style={{ transform: "rotate(-12deg)" }}
      >
        <Motivo tipo={tipo} accent={accent} suave={suave} claro={claro} />
      </svg>
      <svg
        viewBox="0 0 100 100"
        className="absolute -bottom-8 -right-8 w-44 opacity-60 sm:w-56"
        style={{ transform: "rotate(160deg)" }}
      >
        <Motivo tipo={tipo} accent={accent} suave={suave} claro={claro} />
      </svg>
    </div>
  );
}

const ROJO = "#D62839";
const DORADO = "#F2C14E";
const VERDE = "#2E8B57";
const PINO = "#1B5E3B";

/**
 * Navidad: guirnalda de luces de lado a lado arriba (titilan), nieve sobre toda
 * la página, bolas colgando en la esquina y ramas de pino con bolas abajo.
 * Los patrones SVG se repiten sin deformarse, en cualquier ancho de pantalla.
 */
function Navidad({ mini }: { mini: boolean }) {
  const k = mini ? 0.55 : 1;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Nieve */}
      <svg className="absolute inset-0 size-full opacity-60">
        <defs>
          <pattern id="nieve" width={90 * k} height={110 * k} patternUnits="userSpaceOnUse">
            <circle cx={12 * k} cy={18 * k} r={2.2 * k} fill="#FFFFFF" />
            <circle cx={58 * k} cy={8 * k} r={1.4 * k} fill="#FFFFFF" />
            <circle cx={40 * k} cy={62 * k} r={1.8 * k} fill="#FFFFFF" />
            <circle cx={78 * k} cy={84 * k} r={2.4 * k} fill="#FFFFFF" />
            <circle cx={20 * k} cy={96 * k} r={1.2 * k} fill="#FFFFFF" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nieve)" />
      </svg>

      {/* Guirnalda de luces */}
      <svg className="absolute left-0 top-0 w-full" height={34 * k}>
        <defs>
          <pattern id="guirnalda" width={64 * k} height={34 * k} patternUnits="userSpaceOnUse">
            <path
              d={`M0 ${4 * k} Q ${32 * k} ${20 * k} ${64 * k} ${4 * k}`}
              stroke={PINO}
              strokeWidth={2.5 * k}
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100%" height={34 * k} fill="url(#guirnalda)" />
      </svg>
      <div className="absolute left-0 top-0 flex w-full justify-around" style={{ paddingTop: 9 * k }}>
        {Array.from({ length: mini ? 9 : 24 }, (_, i) => (
          <span
            key={i}
            className={i % 2 ? "animate-pulse" : undefined}
            style={{
              width: 8 * k,
              height: 12 * k,
              borderRadius: 999,
              background: [ROJO, DORADO, VERDE, "#3B82F6"][i % 4],
              boxShadow: `0 0 ${8 * k}px ${[ROJO, DORADO, VERDE, "#3B82F6"][i % 4]}`,
              animationDelay: `${(i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Bolas colgando, esquina superior izquierda */}
      <svg
        viewBox="0 0 100 100"
        // En pantallas angostas las bolas se achican y se pegan a la esquina
        // para no rozar el título centrado.
        className={mini ? "absolute -left-1" : "absolute -left-2 w-[96px] sm:w-[150px]"}
        style={{ top: 18 * k, width: mini ? 70 : undefined }}
      >
        {[
          { x: 14, largo: 18, r: 9, c: ROJO },
          { x: 38, largo: 32, r: 7, c: DORADO },
          { x: 60, largo: 12, r: 8, c: VERDE },
        ].map((b, i) => (
          <g key={i}>
            <line x1={b.x} y1={0} x2={b.x} y2={b.largo} stroke="#FFF8E7" strokeWidth={0.8} />
            <rect x={b.x - 2.5} y={b.largo - 1} width={5} height={3} rx={0.8} fill="#C9A227" />
            <circle cx={b.x} cy={b.largo + 2 + b.r} r={b.r} fill={b.c} />
            <circle cx={b.x - b.r * 0.35} cy={b.largo + 2 + b.r * 0.6} r={b.r * 0.25} fill="#FFFFFF" opacity={0.55} />
          </g>
        ))}
      </svg>

      {/* Rama de pino con bolas, esquina inferior derecha */}
      <svg
        viewBox="0 0 120 80"
        className="absolute bottom-0 right-0"
        style={{ width: mini ? 90 : 200 }}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <ellipse
            key={i}
            cx={30 + i * 13}
            cy={62 - (i % 2) * 8}
            rx={16}
            ry={5}
            fill={i % 2 ? PINO : "#24734A"}
            transform={`rotate(${-25 + i * 6} ${30 + i * 13} ${62 - (i % 2) * 8})`}
          />
        ))}
        <circle cx={52} cy={58} r={9} fill={ROJO} />
        <circle cx={74} cy={50} r={7} fill={DORADO} />
        <circle cx={92} cy={62} r={8} fill={ROJO} />
        <circle cx={49} cy={55} r={2.2} fill="#FFFFFF" opacity={0.55} />
        <circle cx={71} cy={48} r={1.8} fill="#FFFFFF" opacity={0.55} />
      </svg>
    </div>
  );
}

function Motivo({
  tipo,
  accent,
  suave,
  claro,
}: {
  tipo: DecoracionRifa;
  accent: string;
  suave: string;
  claro: string;
}) {
  if (tipo === "floral") {
    const flores = [
      { cx: 32, cy: 30, r: 16, color: suave },
      { cx: 60, cy: 18, r: 11, color: claro },
      { cx: 18, cy: 58, r: 12, color: suave },
    ];
    return (
      <>
        {flores.map((f, i) => (
          <g key={i}>
            {Array.from({ length: 8 }, (_, p) => {
              const a = (p / 8) * Math.PI * 2;
              const cx = f.cx + Math.cos(a) * f.r * 0.62;
              const cy = f.cy + Math.sin(a) * f.r * 0.62;
              return (
                <ellipse
                  key={p}
                  cx={cx}
                  cy={cy}
                  rx={f.r * 0.46}
                  ry={f.r * 0.22}
                  fill={f.color}
                  transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`}
                />
              );
            })}
            <circle cx={f.cx} cy={f.cy} r={f.r * 0.32} fill={accent} opacity={0.85} />
          </g>
        ))}
      </>
    );
  }

  if (tipo === "hojas") {
    const hojas = [
      { x: 30, y: 26, r: 20, rot: 15 },
      { x: 58, y: 14, r: 14, rot: -30 },
      { x: 16, y: 56, r: 16, rot: 60 },
    ];
    return (
      <>
        {hojas.map((h, i) => (
          <g key={i} transform={`rotate(${h.rot} ${h.x} ${h.y})`}>
            <ellipse cx={h.x} cy={h.y} rx={h.r * 0.28} ry={h.r} fill={suave} />
            <ellipse cx={h.x} cy={h.y} rx={h.r * 0.08} ry={h.r * 0.9} fill={accent} opacity={0.5} />
          </g>
        ))}
      </>
    );
  }

  if (tipo === "geometrico") {
    return (
      <>
        <circle cx={30} cy={28} r={20} fill={suave} />
        <rect x={52} y={10} width={22} height={22} rx={5} fill={claro} transform="rotate(20 63 21)" />
        <circle cx={16} cy={60} r={11} fill={accent} opacity={0.55} />
        <rect x={38} y={52} width={16} height={16} rx={4} fill={suave} transform="rotate(-15 46 60)" />
      </>
    );
  }

  // confeti
  const puntos = [
    [28, 22], [46, 14], [16, 38], [60, 30], [34, 46], [10, 58], [52, 52], [24, 62],
  ];
  return (
    <>
      {puntos.map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={i % 2 ? 5 : 7}
          height={i % 2 ? 9 : 5}
          rx={2}
          fill={i % 3 === 0 ? accent : i % 3 === 1 ? suave : claro}
          transform={`rotate(${(i * 37) % 180} ${x} ${y})`}
        />
      ))}
    </>
  );
}
