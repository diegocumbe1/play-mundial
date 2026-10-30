import { Decoracion } from "@/components/rifa/decoracion-rifa";
import { conAlfa, getTema, type DecoracionRifa, type TemaRifa } from "@/lib/temas-rifa";

/**
 * Miniatura de la página pública con el tema y la decoración elegidos, para
 * ver el resultado antes de guardar. Imita las piezas que más pesan: título,
 * botón de fecha y precio, tarjeta de premio y la grilla de números.
 */
export function TemaPreview({
  tema,
  decoracion,
  nombre,
  imagenFondoUrl,
}: {
  tema: TemaRifa;
  decoracion: DecoracionRifa;
  nombre: string;
  imagenFondoUrl?: string;
}) {
  const t = getTema(tema).web;

  return (
    <div
      className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border shadow-sm"
      style={{ background: t.bg, color: t.text, borderColor: t.line, minHeight: 360 }}
    >
      {imagenFondoUrl && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagenFondoUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0" style={{ background: conAlfa(t.bg, 0.78) }} />
        </div>
      )}
      <Decoracion
        tipo={decoracion}
        accent={t.accent}
        suave={t.ocupadoBg}
        claro={t.surface}
        escala="mini"
      />
      <div className="relative flex flex-col gap-2 px-4 pb-4 pt-9 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: t.accent }}>
          Lotería
        </p>
        <p className="text-sm font-bold leading-tight">{nombre || "Nombre de tu rifa"}</p>
        <div
          className="rounded-lg py-1.5 text-[10px] font-semibold"
          style={{ background: t.accent, color: t.accentInk }}
        >
          Juega el 24 de diciembre · $ 150.000
        </div>
        <div className="rounded-lg border p-2 text-left" style={{ background: t.surface, borderColor: t.line }}>
          <p className="text-[9px]" style={{ color: t.muted }}>
            1° premio
          </p>
          <p className="text-[11px] font-semibold">Kit solar</p>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 15 }, (_, i) => {
            const ocupado = i % 4 === 1;
            return (
              <span
                key={i}
                className="rounded border py-1 text-[9px] font-semibold"
                style={{
                  background: ocupado ? t.ocupadoBg : t.surface,
                  color: ocupado ? t.ocupadoInk : t.text,
                  borderColor: t.line,
                }}
              >
                {String(i).padStart(2, "0")}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
