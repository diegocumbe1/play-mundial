import { ImageResponse } from "next/og";

import { getRifaPublica } from "@/actions/rifas";
import {
  anchoNumeros,
  comoSeGanaPremio,
  formatCOP,
  formatNumero,
  labelModoCifras,
  labelSorteoPropio,
} from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { imagenRenderizableEnFlyer } from "@/lib/imagen";
import { labelCuentaPago } from "@/lib/pagos";
import {
  conAlfa,
  getDecoracion,
  getTema,
  type DecoracionRifa,
  type TemaFlyer,
} from "@/lib/temas-rifa";

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
  const ancho = anchoNumeros(rifa);
  // Hasta 3 premios (1°, 2°, 3°) para que el flyer siga legible.
  const premiosTop = [...premios].sort((a, b) => a.orden - b.orden).slice(0, 3);
  // Con 2 o más premios cada uno va en su tarjeta (foto + cómo se gana), como
  // los flyers de "1° primeras cifras / 2° últimas cifras".
  const conTarjetas = premiosTop.length > 1;
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });
  const mostrarGrilla = rifa.cantidad_numeros <= 200;
  // Las tarjetas de premios piden ~330 px: la grilla se compacta para dejarles sitio.
  const cell = rifa.cantidad_numeros <= 100 ? (conTarjetas ? 78 : 84) : conTarjetas ? 52 : 60;
  // Con celdas más chicas cabrían 11 por fila: se fija a 10 para que lea 00–09, 10–19…
  const anchoGrilla =
    conTarjetas && rifa.cantidad_numeros <= 100 ? cell * 10 + 8 * 9 : undefined;
  const pago = res.data.pago;
  // Solo se embebe el QR si es una URL http(s) válida (satori la descarga).
  const qrOk = Boolean(pago?.qr_url && /^https?:\/\//i.test(pago.qr_url));
  // Imágenes de la publicación: satori solo descarga http(s) y no sabe dibujar
  // WebP/AVIF (dejaría un hueco en blanco), así que esas se omiten.
  const fondoOk = imagenRenderizableEnFlyer(rifa.imagen_fondo_url);
  // Portada: la de la rifa o, si solo hay un premio, la foto de ese producto.
  const portada =
    rifa.imagen_url ?? (premiosTop.length === 1 ? premiosTop[0].imagen_url : null);
  // Con tarjetas, la portada solo entra si la grilla es corta: los productos ya
  // se ven en cada tarjeta.
  const fotoOk =
    imagenRenderizableEnFlyer(portada) &&
    (!conTarjetas || !mostrarGrilla || rifa.cantidad_numeros <= 40);
  // La foto cede altura cuando además hay que pintar la grilla completa.
  const fotoAlto = !mostrarGrilla
    ? conTarjetas ? 420 : 520
    : rifa.cantidad_numeros <= 40 ? (conTarjetas ? 300 : 420) : 260;
  const anchoTarjeta = premiosTop.length === 2 ? 476 : 312;
  const fotoTarjeta = premiosTop.length === 2 ? 170 : 120;
  const cuentaPago = pago?.cuenta_numero ?? pago?.nequi_llave ?? null;
  const pagoLinea = cuentaPago
    ? `Paga a ${labelCuentaPago(pago?.cuenta_tipo ?? (pago?.nequi_llave ? "nequi" : null))} ${cuentaPago}`
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
        {fondoOk && (
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rifa.imagen_fondo_url!} alt="" width={1080} height={1920} style={{ objectFit: "cover" }} />
          </div>
        )}
        {/* Velo suave: la foto tiene que verse. El título del flyer siempre es de
            color claro, así que un oscurecido leve basta para que se lea, y el
            color del tema vuelve abajo, donde va el pie de pago. */}
        {fondoOk && (
          <div
            style={{
              display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: 1920,
              background: `linear-gradient(180deg, rgba(0,0,0,0.34) 0%, ${conAlfa(f.bgBottom, 0.42)} 45%, ${conAlfa(f.bgBottom, 0.78)} 100%)`,
            }}
          />
        )}

        {adornosFlyer(getDecoracion(rifa.decoracion), f)}

        {/* Título. Sobre una foto el texto se pierde contra el dibujo de la
            imagen; satori no tiene backdrop-filter, así que el "desenfoque" se
            simula con dos placas translúcidas superpuestas. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex", borderRadius: 48,
              padding: fondoOk ? 14 : 0,
              background: fondoOk ? "rgba(0,0,0,0.28)" : "transparent",
            }}
          >
            <div
              style={{
                display: "flex", borderRadius: 36,
                padding: fondoOk ? "20px 34px" : 0,
                background: fondoOk ? "rgba(0,0,0,0.62)" : "transparent",
              }}
            >
              <div
                style={{
                  fontSize: 82, fontWeight: 800, color: f.titulo, textAlign: "center", lineHeight: 1,
                  textShadow: fondoOk ? "0 4px 18px rgba(0,0,0,0.65)" : "none",
                }}
              >
                {rifa.nombre}
              </div>
            </div>
          </div>
        </div>

        {/* Foto del premio */}
        {fotoOk && (
          <div
            style={{
              display: "flex", marginTop: 28, borderRadius: 28, overflow: "hidden",
              width: "100%", height: fotoAlto,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portada!}
              alt=""
              width={968}
              height={fotoAlto}
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        {/* Banda fecha/valor */}
        <div
          style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            background: f.band, color: f.ink, borderRadius: 18,
            padding: conTarjetas ? "18px 28px" : "22px 28px",
            marginTop: conTarjetas ? 28 : 36, fontSize: 40, fontWeight: 700,
          }}
        >
          <span>
            {fechaJuegoTxt ? `Juega el ${fechaJuegoTxt} · ` : ""}
            {formatCOP(rifa.precio_boleta)} por número
          </span>
        </div>

        {/* Escasez */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: conTarjetas ? 24 : 32 }}>
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
          <div
            style={{
              display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
              marginTop: conTarjetas ? 24 : 32, width: anchoGrilla, alignSelf: "center",
            }}
          >
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
                {formatNumero(c.numero, ancho)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40, color: f.titulo, fontSize: 60, fontWeight: 800 }}>
            {disponibles} números disponibles
          </div>
        )}

        {/* Lotería (con tarjetas, el criterio va en cada premio) */}
        {!conTarjetas && rifa.tipo === "loteria" && rifa.loteria && (
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

        {/* Cómo se juega (sorteo propio) */}
        {!conTarjetas && rifa.tipo === "interna" && (
          <div
            style={{
              display: "flex", justifyContent: "center", textAlign: "center",
              color: f.titulo, fontSize: 34, fontWeight: 600, marginTop: 36,
              padding: "16px 20px", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 16,
            }}
          >
            {labelSorteoPropio(rifa.sorteo_bolas || 1, rifa.sorteo_ganadores || 1, rifa.sorteo_orden)}
          </div>
        )}

        {/* Un solo premio: en grande y centrado */}
        {premiosTop.length === 1 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 36 }}>
            <div style={{ display: "flex", color: f.titulo, fontSize: 32, fontWeight: 700 }}>
              PREMIO
            </div>
            <div
              style={{
                display: "flex", marginTop: 8, color: f.card,
                fontSize: 66, fontWeight: 800, textAlign: "center",
              }}
            >
              {premiosTop[0].tipo === "valor" && premiosTop[0].valor
                ? formatCOP(premiosTop[0].valor)
                : premiosTop[0].descripcion}
            </div>
          </div>
        )}

        {/* Varios premios: una tarjeta por premio */}
        {conTarjetas && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
            <div
              style={{
                display: "flex", justifyContent: "center", color: f.titulo,
                fontSize: 30, fontWeight: 700, letterSpacing: 2,
              }}
            >
              {rifa.tipo === "loteria" && rifa.loteria
                ? `PREMIOS · ${rifa.loteria.toUpperCase()}`
                : "PREMIOS"}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              {premiosTop.map((p, i) => {
                const gana = comoSeGanaPremio(rifa, p.criterio, i + 1);
                const fotoPremio = imagenRenderizableEnFlyer(p.imagen_url) ? p.imagen_url : null;
                const titulo = p.tipo === "valor" && p.valor ? formatCOP(p.valor) : p.descripcion;
                const subtitulo = p.tipo === "valor" && p.valor ? p.descripcion : null;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", flexDirection: "column", width: anchoTarjeta,
                      padding: 18, borderRadius: 26,
                      background: i === 0 ? conAlfa(f.accent, 0.22) : "rgba(0,0,0,0.28)",
                      border: `3px solid ${i === 0 ? f.accent : "rgba(255,255,255,0.45)"}`,
                    }}
                  >
                    {/* Puesto + cómo se gana */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 58, height: 58, borderRadius: 29, flexShrink: 0,
                          background: i === 0 ? f.accent : f.card,
                          color: i === 0 ? f.card : f.ink, fontSize: 30, fontWeight: 800,
                        }}
                      >
                        {i + 1}°
                      </div>
                      {gana && (
                        <div
                          style={{
                            display: "flex", flexDirection: "column", flex: 1,
                            padding: "8px 12px", borderRadius: 14,
                            background: i === 0 ? f.accent : f.card,
                            color: i === 0 ? f.card : f.ink,
                          }}
                        >
                          <div style={{ display: "flex", fontSize: 20, fontWeight: 600 }}>
                            {gana.antes}
                          </div>
                          <div
                            style={{
                              display: "flex", lineHeight: 1.05, fontWeight: 800,
                              fontSize: premiosTop.length === 2 ? 30 : 24,
                            }}
                          >
                            {gana.destacado.toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Foto + producto */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: premiosTop.length === 2 ? "row" : "column",
                        alignItems: premiosTop.length === 2 ? "center" : "flex-start",
                        gap: 14, marginTop: 14,
                      }}
                    >
                      {fotoPremio && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fotoPremio}
                          alt=""
                          width={fotoTarjeta}
                          height={fotoTarjeta}
                          style={{ borderRadius: 18, objectFit: "cover", background: "#fff", flexShrink: 0 }}
                        />
                      )}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <div
                          style={{
                            display: "flex", color: f.titulo, fontWeight: 800, lineHeight: 1.1,
                            fontSize: premiosTop.length === 2 ? (fotoPremio ? 34 : 42) : 28,
                          }}
                        >
                          {titulo}
                        </div>
                        {subtitulo && (
                          <div
                            style={{
                              display: "flex", color: f.titulo, opacity: 0.85, marginTop: 4,
                              fontSize: premiosTop.length === 2 ? 24 : 20,
                            }}
                          >
                            {subtitulo}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
