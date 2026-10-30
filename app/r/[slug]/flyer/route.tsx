import { ImageResponse } from "next/og";

import { getRifaPublica } from "@/actions/rifas";
import {
  anchoNumeros,
  comoSeGanaPremio,
  decodificarOcupados,
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
  esTemaClaro,
  getDecoracion,
  getTema,
  type DecoracionRifa,
} from "@/lib/temas-rifa";

/** Colores con que se pintan los adornos (salen de la paleta web del tema). */
type ColoresAdorno = { accent: string; suave: string; claro: string };

const NAV_ROJO = "#D62839";
const NAV_DORADO = "#F2C14E";
const NAV_VERDE = "#2E8B57";
const NAV_PINO = "#1B5E3B";

/**
 * Adornos decorativos del flyer. Satori solo soporta flexbox y formas simples,
 * así que se dibujan con divs absolutos + border-radius (nada de SVG complejo).
 * Van detrás del contenido y nunca encima del título: solo esquinas y bordes.
 */
function adornosFlyer(tipo: DecoracionRifa, c: ColoresAdorno) {
  if (tipo === "ninguna") return null;

  type Pieza = { x: number; y: number; w: number; h: number; r: number; c: string; o: number };
  const piezas: Pieza[] = [];

  if (tipo === "navidad") {
    // Guirnalda de luces de lado a lado, pegada al borde de arriba.
    piezas.push({ x: 0, y: 16, w: 1080, h: 4, r: 2, c: NAV_PINO, o: 1 });
    const colores = [NAV_ROJO, NAV_DORADO, NAV_VERDE, "#3B82F6"];
    for (let i = 0; i < 20; i++) {
      const color = colores[i % 4];
      const x = 18 + i * 54;
      const y = i % 2 ? 22 : 18;
      // Halo: un círculo translúcido detrás (boxShadow tumba el render de satori).
      piezas.push({ x: x - 9, y: y - 6, w: 36, h: 38, r: 19, c: color, o: 0.28 });
      piezas.push({ x, y, w: 18, h: 26, r: 9, c: color, o: 1 });
    }
    // Bolas agrupadas en la esquina de abajo, lejos del pie de pago.
    const grupo = [
      { x: 930, y: 1790, d: 140, c: NAV_ROJO },
      { x: 1010, y: 1730, d: 110, c: NAV_DORADO },
      { x: 860, y: 1860, d: 96, c: NAV_VERDE },
      { x: -50, y: 1840, d: 120, c: NAV_DORADO },
      { x: 40, y: 1880, d: 90, c: NAV_ROJO },
    ];
    for (const b of grupo) {
      piezas.push({ x: b.x, y: b.y, w: b.d, h: b.d, r: b.d / 2, c: b.c, o: 0.95 });
      piezas.push({ x: b.x + b.d / 4, y: b.y + b.d / 6, w: b.d / 5, h: b.d / 5, r: b.d / 10, c: "#FFFFFF", o: 0.5 });
    }
    // Nieve sobre el fondo (las tarjetas la tapan: queda solo en los bordes).
    for (let i = 0; i < 70; i++) {
      const d = i % 3 === 0 ? 10 : 6;
      piezas.push({
        x: (i * 157) % 1060, y: 70 + ((i * 263) % 1820),
        w: d, h: d, r: d / 2, c: "#FFFFFF", o: 0.35,
      });
    }
  } else {
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
            w: 96, h: 62, r: 48, c: c.suave, o: 0.75,
          });
        }
        piezas.push({ x: e.x + 78, y: e.y + 78, w: 64, h: 64, r: 32, c: c.accent, o: 0.9 });
        piezas.push({ x: e.x + 190, y: e.y + 30, w: 70, h: 46, r: 35, c: c.claro, o: 0.6 });
      } else if (tipo === "hojas") {
        for (let i = 0; i < 5; i++) {
          piezas.push({
            x: e.x + 40 + i * 46, y: e.y + 60 + (i % 2) * 70,
            w: 54, h: 128, r: 27, c: c.suave, o: 0.55,
          });
        }
      } else if (tipo === "geometrico") {
        piezas.push({ x: e.x + 40, y: e.y + 40, w: 140, h: 140, r: 70, c: c.suave, o: 0.6 });
        piezas.push({ x: e.x + 170, y: e.y + 20, w: 90, h: 90, r: 18, c: c.claro, o: 0.5 });
        piezas.push({ x: e.x + 70, y: e.y + 180, w: 70, h: 70, r: 35, c: c.accent, o: 0.5 });
      } else {
        // confeti
        for (let i = 0; i < 10; i++) {
          piezas.push({
            x: e.x + 30 + ((i * 53) % 240),
            y: e.y + 20 + ((i * 71) % 220),
            w: i % 2 ? 18 : 26, h: i % 2 ? 34 : 18, r: 8,
            c: i % 3 === 0 ? c.accent : i % 3 === 1 ? c.suave : c.claro,
            o: 0.7,
          });
        }
      }
    }
  }

  return (
    // Esquina real del lienzo: con `inset: 0` satori lo corre al borde del relleno.
    <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
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

  const { rifa, premios, ocupados } = res.data;
  const grilla = decodificarOcupados(rifa, ocupados);
  // El flyer usa la MISMA paleta que la página pública: lo que circula por
  // WhatsApp tiene que verse igual a lo que abre el enlace.
  const tema = getTema(rifa.tema);
  const t = tema.web;
  const claro = esTemaClaro(tema);
  const disponibles = grilla.filter((c) => !c.ocupado).length;
  const vendidas = rifa.cantidad_numeros - disponibles;
  const pct = rifa.cantidad_numeros > 0 ? Math.round((vendidas / rifa.cantidad_numeros) * 100) : 0;
  const ancho = anchoNumeros(rifa);
  // Hasta 4 premios, en tarjetas de a dos por fila como en la página pública.
  const premiosTop = [...premios].sort((a, b) => a.orden - b.orden).slice(0, 4);
  const conTarjetas = premiosTop.length > 1;
  const filasPremios = Math.ceil(premiosTop.length / 2);
  const fechaJuego =
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo;
  const fechaJuegoTxt = formatFechaCO(fechaJuego, { conAnio: false });
  const mostrarGrilla = rifa.cantidad_numeros <= 200;
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
  const fotoAlto = !mostrarGrilla
    ? conTarjetas ? 420 : 520
    : rifa.cantidad_numeros <= 40 ? (conTarjetas ? 300 : 420) : 260;
  // La grilla cede altura a las tarjetas de premios (cada fila ~190 px).
  const cell =
    rifa.cantidad_numeros <= 100
      ? conTarjetas ? (filasPremios > 1 ? 66 : 76) : 84
      : conTarjetas ? (filasPremios > 1 ? 44 : 50) : 58;
  // Con 100 o menos se fija a 10 por fila para que lea 00–09, 10–19…
  const anchoGrilla = rifa.cantidad_numeros <= 100 ? cell * 10 + 8 * 9 : undefined;
  const anchoTarjeta = 450;
  const cuentaPago = pago?.cuenta_numero ?? pago?.nequi_llave ?? null;
  const pagoLinea = cuentaPago
    ? `Paga a ${labelCuentaPago(pago?.cuenta_tipo ?? (pago?.nequi_llave ? "nequi" : null))} ${cuentaPago}`
    : pago?.llave
      ? `Paga a la llave ${pago.llave}`
      : null;

  const modoLabel = labelModoCifras(rifa.modo_cifras ?? "ultimas_dos", rifa.formato_cifras);
  const navidad = getDecoracion(rifa.decoracion) === "navidad";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
          background: t.bg, color: t.text,
          // La guirnalda navideña ocupa la franja de arriba: el contenido baja.
          padding: navidad ? "84px 56px 56px" : 56, fontFamily: "sans-serif",
        }}
      >
        {fondoOk && (
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rifa.imagen_fondo_url!} alt="" width={1080} height={1920} style={{ objectFit: "cover" }} />
          </div>
        )}
        {/* Velo con el color del tema, como en la página pública: más fuerte en
            temas claros (texto oscuro) para que todo se siga leyendo. */}
        {fondoOk && (
          <div
            style={{
              display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: 1920,
              background: `linear-gradient(180deg, ${conAlfa(t.bg, claro ? 0.7 : 0.5)} 0%, ${conAlfa(t.bg, claro ? 0.88 : 0.8)} 55%, ${conAlfa(t.bg, 0.94)} 100%)`,
            }}
          />
        )}

        {adornosFlyer(getDecoracion(rifa.decoracion), {
          accent: t.accent,
          suave: t.ocupadoBg,
          claro: t.surface,
        })}

        {/* Encabezado: lotería, nombre y cuántos premios (igual que la URL) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {rifa.tipo === "loteria" && rifa.loteria && (
            <div style={{ display: "flex", color: t.accent, fontSize: 28, fontWeight: 700, letterSpacing: 3 }}>
              {rifa.loteria.toUpperCase()}
            </div>
          )}
          <div
            style={{
              display: "flex", fontSize: 78, fontWeight: 800, color: t.text,
              textAlign: "center", lineHeight: 1.05, marginTop: 8,
            }}
          >
            {rifa.nombre}
          </div>
          {conTarjetas && (
            <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 700, color: t.text, opacity: 0.85 }}>
              {premios.length} premios
            </div>
          )}
        </div>

        {/* Foto del premio */}
        {fotoOk && (
          <div
            style={{
              display: "flex", marginTop: 24, borderRadius: 28, overflow: "hidden",
              width: "100%", height: fotoAlto,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada!} alt="" width={968} height={fotoAlto} style={{ objectFit: "cover" }} />
          </div>
        )}

        {/* Banda fecha/valor: el CTA de la página pública */}
        <div
          style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            background: t.accent, color: t.accentInk, borderRadius: 26,
            padding: "20px 28px", marginTop: 26, fontSize: 38, fontWeight: 800,
          }}
        >
          <span>
            {fechaJuegoTxt ? `Juega el ${fechaJuegoTxt} · ` : ""}
            {formatCOP(rifa.precio_boleta)} por número
          </span>
        </div>

        {/* Escasez */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: t.muted, fontSize: 28, fontWeight: 600 }}>
            <span>Quedan {disponibles} de {rifa.cantidad_numeros}</span>
            <span>{pct}% vendido</span>
          </div>
          <div style={{ display: "flex", height: 14, background: t.line, borderRadius: 8, marginTop: 10 }}>
            <div style={{ display: "flex", width: `${pct}%`, background: t.accent, borderRadius: 8 }} />
          </div>
        </div>

        {/* Varios premios: tarjetas de a dos, como en la página pública */}
        {conTarjetas && (
          <div
            style={{
              display: "flex", flexDirection: "column", marginTop: 24, padding: 20,
              borderRadius: 28, background: t.surface, border: `2px solid ${t.line}`,
            }}
          >
            <div style={{ display: "flex", color: t.text, fontSize: 30, fontWeight: 800 }}>
              Premios
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
              {premiosTop.map((p, i) => {
                const gana = comoSeGanaPremio(rifa, p.criterio, i + 1);
                const fotoPremio = imagenRenderizableEnFlyer(p.imagen_url) ? p.imagen_url : null;
                const titulo = p.tipo === "valor" && p.valor ? formatCOP(p.valor) : p.descripcion;
                const subtitulo = p.tipo === "valor" && p.valor ? p.descripcion : null;
                // El ancho del texto es fijo: satori no reparte bien `flex: 1`
                // en columnas y el texto terminaba encimado.
                // Impar: el último ocupa la fila completa (no queda el hueco).
                const anchoCard =
                  premiosTop.length % 2 === 1 && i === premiosTop.length - 1 ? 916 : anchoTarjeta;
                // En la tarjeta ancha la foto del producto se luce más grande.
                const ladoFoto = anchoCard > anchoTarjeta ? 180 : 100;
                const anchoTexto = anchoCard - 40 - (fotoPremio ? ladoFoto + 12 : 0);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", flexDirection: "column", width: anchoCard,
                      padding: 18, borderRadius: 22,
                      background: i === 0 ? conAlfa(t.accent, 0.1) : t.bg,
                      border: `3px solid ${i === 0 ? t.accent : t.line}`,
                    }}
                  >
                    {/* Puesto + cómo se gana */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 52, height: 52, borderRadius: 26, flexShrink: 0,
                          background: t.accent, color: t.accentInk, fontSize: 26, fontWeight: 800,
                        }}
                      >
                        {i + 1}°
                      </div>
                      {gana && (
                        <div style={{ display: "flex", flexDirection: "column", width: anchoCard - 104 }}>
                          <div style={{ display: "flex", fontSize: 20, color: t.muted }}>{gana.antes}</div>
                          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: t.text }}>
                            {gana.destacado.toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Foto + premio */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                      {fotoPremio && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fotoPremio}
                          alt=""
                          width={ladoFoto}
                          height={ladoFoto}
                          // Completa, sin recortar ni bandas blancas: sobre el fondo del tema.
                          style={{ borderRadius: 14, objectFit: "contain", background: t.bg, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ display: "flex", flexDirection: "column", width: anchoTexto }}>
                        <div style={{ display: "flex", color: t.text, fontWeight: 800, fontSize: 36, lineHeight: 1.1 }}>
                          {titulo}
                        </div>
                        {subtitulo && (
                          <div style={{ display: "flex", color: t.muted, fontSize: 22, marginTop: 4 }}>
                            {subtitulo}
                          </div>
                        )}
                        {p.fecha_loteria && (
                          <div style={{ display: "flex", color: t.accent, fontWeight: 800, fontSize: 24, marginTop: 6 }}>
                            {`Juega el ${formatFechaCO(p.fecha_loteria, { conAnio: false })}`}
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

        {/* Lotería (con tarjetas, el criterio va en cada premio) */}
        {!conTarjetas && rifa.tipo === "loteria" && rifa.loteria && (
          <div
            style={{
              display: "flex", justifyContent: "center", textAlign: "center",
              color: t.text, fontSize: 32, fontWeight: 600, marginTop: 26,
              padding: "16px 20px", background: t.surface, border: `2px solid ${t.line}`, borderRadius: 18,
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
              color: t.text, fontSize: 30, fontWeight: 600, marginTop: 26,
              padding: "16px 20px", background: t.surface, border: `2px solid ${t.line}`, borderRadius: 18,
            }}
          >
            {labelSorteoPropio(rifa.sorteo_bolas || 1, rifa.sorteo_ganadores || 1, rifa.sorteo_orden)}
          </div>
        )}

        {/* Un solo premio: en grande y centrado */}
        {premiosTop.length === 1 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26 }}>
            <div style={{ display: "flex", color: t.muted, fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
              PREMIO
            </div>
            <div style={{ display: "flex", marginTop: 6, color: t.text, fontSize: 62, fontWeight: 800, textAlign: "center" }}>
              {premiosTop[0].tipo === "valor" && premiosTop[0].valor
                ? formatCOP(premiosTop[0].valor)
                : premiosTop[0].descripcion}
            </div>
          </div>
        )}

        {/* Grilla (ocupado/libre — nunca revela pago) */}
        {mostrarGrilla ? (
          <div
            style={{
              display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
              marginTop: 24, width: anchoGrilla, alignSelf: "center",
            }}
          >
            {grilla.map((c) => (
              <div
                key={c.numero}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: cell, height: cell, borderRadius: 12,
                  fontSize: cell * 0.36, fontWeight: 700,
                  background: c.ocupado ? t.ocupadoBg : t.surface,
                  color: c.ocupado ? t.ocupadoInk : t.text,
                  border: `2px solid ${t.line}`,
                  textDecoration: c.ocupado ? "line-through" : "none",
                }}
              >
                {formatNumero(c.numero, ancho)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40, color: t.text, fontSize: 60, fontWeight: 800 }}>
            {disponibles} números disponibles
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
                  display: "flex", justifyContent: "center", background: t.surface, color: t.text,
                  border: `2px solid ${t.line}`,
                  borderRadius: 18, padding: "18px 28px", fontSize: qrOk ? 32 : 36, fontWeight: 700,
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
