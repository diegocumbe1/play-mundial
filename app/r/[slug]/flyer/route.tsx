import { ImageResponse } from "next/og";

import { getRifaPublica } from "@/actions/rifas";
import { formatCOP } from "@/lib/polla";
import { formatFechaCO } from "@/lib/fecha-co";
import { getTema } from "@/lib/temas-rifa";

export const dynamic = "force-dynamic";

// El flyer refleja el estado REAL de la rifa: se regenera en cada carga, sin caché.
const NO_CACHE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

/** Genera el flyer PNG (story 1080×1920) con el estado real y el tema de la rifa. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const res = await getRifaPublica(slug);

  if (!res.success) {
    const f = getTema("rosa").flyer;
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: f.bgTop, color: f.titulo, fontSize: 48,
          }}
        >
          Rifa no disponible
        </div>
      ),
      { width: 1080, height: 1920, headers: NO_CACHE },
    );
  }

  const { rifa, premios, grilla } = res.data;
  const f = getTema(rifa.tema).flyer;
  const disponibles = grilla.filter((c) => !c.ocupado).length;
  const vendidas = rifa.cantidad_numeros - disponibles;
  const pct = rifa.cantidad_numeros > 0 ? Math.round((vendidas / rifa.cantidad_numeros) * 100) : 0;
  const ancho = String(rifa.cantidad_numeros - 1).length;
  const premioPrincipal = [...premios].sort((a, b) => a.orden - b.orden)[0];
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });
  const mostrarGrilla = rifa.cantidad_numeros <= 200;
  const cell = rifa.cantidad_numeros <= 100 ? 84 : 60;
  const pago = res.data.pago;
  const pagoLinea = pago?.nequi_llave
    ? `Paga a Nequi ${pago.nequi_llave}`
    : pago?.llave
      ? `Paga a la llave ${pago.llave}`
      : null;

  const modoLabel =
    rifa.modo_cifras === "primeras_dos"
      ? "primeras cifras"
      : rifa.modo_cifras === "ambas"
        ? "primeras o últimas cifras"
        : "últimas cifras";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: `linear-gradient(180deg, ${f.bgTop} 0%, ${f.bgBottom} 100%)`,
          padding: 56, fontFamily: "sans-serif",
        }}
      >
        {/* Título */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 82, fontWeight: 800, color: f.titulo, textAlign: "center", lineHeight: 1 }}>
            {rifa.nombre}
          </div>
        </div>

        {/* Banda fecha/valor */}
        <div
          style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            background: f.band, color: f.ink, borderRadius: 18,
            padding: "22px 28px", marginTop: 36, fontSize: 40, fontWeight: 700,
          }}
        >
          <span>
            {fechaJuegoTxt ? `Juega el ${fechaJuegoTxt} · ` : ""}
            {formatCOP(rifa.precio_boleta)} por número
          </span>
        </div>

        {/* Escasez */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: f.titulo, fontSize: 34, fontWeight: 700 }}>
            <span>Quedan {disponibles} de {rifa.cantidad_numeros}</span>
            <span>{pct}% vendido</span>
          </div>
          <div style={{ display: "flex", height: 18, background: "rgba(255,255,255,0.28)", borderRadius: 10, marginTop: 12 }}>
            <div style={{ display: "flex", width: `${pct}%`, background: f.accent, borderRadius: 10 }} />
          </div>
        </div>

        {/* Grilla (ocupado/libre — nunca revela pago) */}
        {mostrarGrilla ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 32 }}>
            {grilla.map((c) => (
              <div
                key={c.numero}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: cell, height: cell, borderRadius: 12,
                  fontSize: cell * 0.34, fontWeight: 700,
                  background: c.ocupado ? f.ocupBg : f.numBg,
                  color: c.ocupado ? f.ocupInk : f.numInk,
                  textDecoration: c.ocupado ? "line-through" : "none",
                }}
              >
                {String(c.numero).padStart(ancho, "0")}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40, color: f.titulo, fontSize: 60, fontWeight: 800 }}>
            {disponibles} números disponibles
          </div>
        )}

        {/* Lotería */}
        {rifa.tipo === "loteria" && rifa.loteria && (
          <div
            style={{
              display: "flex", justifyContent: "center", textAlign: "center",
              color: f.titulo, fontSize: 36, fontWeight: 600, marginTop: 36,
              padding: "16px 20px", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 16,
            }}
          >
            Gana con las {modoLabel} de la {rifa.loteria}
          </div>
        )}

        {/* Premio */}
        {premioPrincipal && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
            <div style={{ display: "flex", color: f.titulo, fontSize: 34, fontWeight: 700 }}>PREMIO</div>
            <div style={{ display: "flex", color: f.card, fontSize: 66, fontWeight: 800, textAlign: "center" }}>
              {premioPrincipal.tipo === "valor" && premioPrincipal.valor
                ? formatCOP(premioPrincipal.valor)
                : premioPrincipal.descripcion}
            </div>
          </div>
        )}

        {/* Pie: pago + link */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", alignItems: "center" }}>
          {pagoLinea && (
            <div
              style={{
                display: "flex", justifyContent: "center", background: f.card, color: f.ink,
                borderRadius: 16, padding: "18px 28px", fontSize: 38, fontWeight: 700,
              }}
            >
              {pagoLinea}
            </div>
          )}
          {/* <div style={{ display: "flex", color: "rgba(255,255,255,0.85)", fontSize: 30, marginTop: 20 }}>
            Reserva en vivo · /r/{rifa.slug_publico}
          </div> */}
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: NO_CACHE },
  );
}
