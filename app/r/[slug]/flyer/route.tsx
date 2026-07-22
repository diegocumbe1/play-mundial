import { ImageResponse } from "next/og";

import { getRifaPublica } from "@/actions/rifas";
import { formatCOP, labelModoCifras } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { getDecoracion, getTema, type DecoracionRifa, type TemaFlyer } from "@/lib/temas-rifa";

/**
 * Adornos decorativos del flyer. Satori solo soporta flexbox y formas simples,
 * así que se dibujan con divs absolutos + border-radius (nada de SVG complejo).
 */
function adornosFlyer(tipo: DecoracionRifa, f: TemaFlyer) {
  if (tipo === "ninguna") return null;

  const piezas: { x: number; y: number; w: number; h: number; r: number; c: string; o: number }[] = [];
  const esquinas = [
    { x: -60, y: -60 },
    { x: 900, y: 1620 },
  ];

  for (const e of esquinas) {
    if (tipo === "floral") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        piezas.push({
          x: e.x + 110 + Math.cos(a) * 82,
          y: e.y + 110 + Math.sin(a) * 82,
          w: 96, h: 62, r: 48, c: f.numBg, o: 0.75,
        });
      }
      piezas.push({ x: e.x + 78, y: e.y + 78, w: 64, h: 64, r: 32, c: f.accent, o: 0.9 });
      piezas.push({ x: e.x + 190, y: e.y + 30, w: 70, h: 46, r: 35, c: f.band, o: 0.6 });
    } else if (tipo === "hojas") {
      for (let i = 0; i < 5; i++) {
        piezas.push({
          x: e.x + 40 + i * 46, y: e.y + 60 + (i % 2) * 70,
          w: 54, h: 128, r: 27, c: f.numBg, o: 0.55,
        });
      }
    } else if (tipo === "geometrico") {
      piezas.push({ x: e.x + 40, y: e.y + 40, w: 140, h: 140, r: 70, c: f.numBg, o: 0.6 });
      piezas.push({ x: e.x + 170, y: e.y + 20, w: 90, h: 90, r: 18, c: f.band, o: 0.5 });
      piezas.push({ x: e.x + 70, y: e.y + 180, w: 70, h: 70, r: 35, c: f.accent, o: 0.5 });
    } else {
      // confeti
      for (let i = 0; i < 10; i++) {
        piezas.push({
          x: e.x + 30 + ((i * 53) % 240),
          y: e.y + 20 + ((i * 71) % 220),
          w: i % 2 ? 18 : 26, h: i % 2 ? 34 : 18, r: 8,
          c: i % 3 === 0 ? f.accent : i % 3 === 1 ? f.numBg : f.band,
          o: 0.7,
        });
      }
    }
  }

  return (
    <div style={{ display: "flex", position: "absolute", inset: 0 }}>
      {piezas.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: p.x, top: p.y,
            width: p.w, height: p.h, borderRadius: p.r,
            background: p.c, opacity: p.o,
          }}
        />
      ))}
    </div>
  );
}

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
  // Hasta 3 premios (1°, 2°, 3°) para que el flyer siga legible.
  const premiosTop = [...premios].sort((a, b) => a.orden - b.orden).slice(0, 3);
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });
  const mostrarGrilla = rifa.cantidad_numeros <= 200;
  const cell = rifa.cantidad_numeros <= 100 ? 84 : 60;
  const pago = res.data.pago;
  // Solo se embebe el QR si es una URL http(s) válida (satori la descarga).
  const qrOk = Boolean(pago?.qr_url && /^https?:\/\//i.test(pago.qr_url));
  const pagoLinea = pago?.nequi_llave
    ? `Paga a Nequi ${pago.nequi_llave}`
    : pago?.llave
      ? `Paga a la llave ${pago.llave}`
      : null;

  const modoLabel = labelModoCifras(rifa.modo_cifras ?? "ultimas_dos", rifa.formato_cifras);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
          background: `linear-gradient(180deg, ${f.bgTop} 0%, ${f.bgBottom} 100%)`,
          padding: 56, fontFamily: "sans-serif",
        }}
      >
        {adornosFlyer(getDecoracion(rifa.decoracion), f)}

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

        {/* Premios (hasta 3) */}
        {premiosTop.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 36 }}>
            <div style={{ display: "flex", color: f.titulo, fontSize: 32, fontWeight: 700 }}>
              {premiosTop.length > 1 ? "PREMIOS" : "PREMIO"}
            </div>
            {premiosTop.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 14, marginTop: 8,
                  color: f.card,
                  fontSize: premiosTop.length > 1 ? (i === 0 ? 52 : 40) : 66,
                  fontWeight: 800, textAlign: "center",
                }}
              >
                {premiosTop.length > 1 && (
                  <span
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 46, height: 46, borderRadius: 23,
                      background: f.accent, color: f.card, fontSize: 24,
                    }}
                  >
                    {i + 1}°
                  </span>
                )}
                <span>
                  {p.tipo === "valor" && p.valor ? formatCOP(p.valor) : p.descripcion}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pie: pago + link */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {qrOk && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pago!.qr_url!}
                alt=""
                width={190}
                height={190}
                style={{ borderRadius: 16, background: "#fff", objectFit: "contain" }}
              />
            )}
            {pagoLinea && (
              <div
                style={{
                  display: "flex", justifyContent: "center", background: f.card, color: f.ink,
                  borderRadius: 16, padding: "18px 28px", fontSize: qrOk ? 32 : 38, fontWeight: 700,
                }}
              >
                {pagoLinea}
              </div>
            )}
          </div>
          {/* <div style={{ display: "flex", color: "rgba(255,255,255,0.85)", fontSize: 30, marginTop: 20 }}>
            Reserva en vivo · /r/{rifa.slug_publico}
          </div> */}
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: NO_CACHE },
  );
}
