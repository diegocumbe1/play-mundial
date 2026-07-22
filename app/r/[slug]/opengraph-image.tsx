import { ImageResponse } from "next/og";

import { getRifaPublica } from "@/actions/rifas";
import { formatCOP, labelModoCifras } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { getTema } from "@/lib/temas-rifa";

/**
 * Imagen de la vista previa del enlace (WhatsApp, Facebook, X…).
 *
 * Es la misma identidad del flyer (tema, datos, escasez) pero en 1200×630: los
 * crawlers recortan al centro, así que la story vertical 1080×1920 salía
 * ilegible. Se mantiene liviana a propósito —sin grilla ni QR remoto— porque
 * WhatsApp abandona la descarga si tarda unos segundos y entonces muestra el
 * enlace pelado.
 */
export const alt = "Vista previa de la rifa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// La imagen se cachea 2 min: el crawler de WhatsApp reintenta varias veces por
// enlace y no debe regenerarla en cada intento (de ahí la demora del preview).
export const revalidate = 120;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getRifaPublica(slug);

  if (!res.success) {
    const f = getTema("rosa").flyer;
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: f.bgTop, color: f.titulo, fontSize: 56,
            fontFamily: "sans-serif",
          }}
        >
          Rifa no disponible
        </div>
      ),
      size,
    );
  }

  const { rifa, premios, disponibles } = res.data;
  const f = getTema(rifa.tema).flyer;
  const vendidas = rifa.cantidad_numeros - disponibles;
  const pct = rifa.cantidad_numeros > 0 ? Math.round((vendidas / rifa.cantidad_numeros) * 100) : 0;
  const premio = [...premios].sort((a, b) => a.orden - b.orden)[0];
  const premioTxt = premio
    ? premio.tipo === "valor" && premio.valor
      ? formatCOP(premio.valor)
      : premio.descripcion
    : null;
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });
  const cifrasTxt =
    rifa.tipo === "loteria" && rifa.modo_cifras
      ? `Juega con las ${labelModoCifras(rifa.modo_cifras, rifa.formato_cifras)}${
          rifa.loteria ? ` de la ${rifa.loteria}` : ""
        }`
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          background: `linear-gradient(135deg, ${f.bgTop} 0%, ${f.bgBottom} 100%)`,
          padding: 56, fontFamily: "sans-serif", color: f.titulo,
        }}
      >
        {/* Izquierda: qué es y cómo se gana */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            {rifa.nombre}
          </div>

          <div
            style={{
              display: "flex", alignSelf: "flex-start", marginTop: 24,
              background: f.band, color: f.ink, borderRadius: 14,
              padding: "14px 22px", fontSize: 32, fontWeight: 700,
            }}
          >
            {fechaJuegoTxt ? `Juega el ${fechaJuegoTxt} · ` : ""}
            {formatCOP(rifa.precio_boleta)} por número
          </div>

          {cifrasTxt && (
            <div style={{ display: "flex", marginTop: 22, fontSize: 30, fontWeight: 600 }}>
              🎯 {cifrasTxt}
            </div>
          )}

          {premioTxt && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700, opacity: 0.85 }}>
                PREMIO
              </div>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: f.card }}>
                {premioTxt}
              </div>
            </div>
          )}
        </div>

        {/* Derecha: escasez (el gancho que hace clic) */}
        <div
          style={{
            display: "flex", flexDirection: "column", justifyContent: "center",
            alignItems: "center", width: 380, background: f.card, color: f.ink,
            borderRadius: 28, padding: 32,
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>QUEDAN</div>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 1 }}>
            {disponibles}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
            de {rifa.cantidad_numeros} números
          </div>
          <div
            style={{
              display: "flex", width: "100%", height: 16, marginTop: 26,
              background: f.ocupBg, borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", width: `${pct}%`, background: f.accent, borderRadius: 8 }} />
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 26, fontWeight: 700 }}>
            {pct}% vendido
          </div>
        </div>
      </div>
    ),
    size,
  );
}
