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
}: {
  tipo: DecoracionRifa;
  /** Color de acento del tema. */
  accent: string;
  /** Tono suave (relleno principal de los adornos). */
  suave: string;
  /** Tono muy claro (detalles). */
  claro: string;
}) {
  if (tipo === "ninguna") return null;

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
