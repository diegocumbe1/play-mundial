import { ImageResponse } from "next/og";

/** Ícono para "Agregar a inicio" en iOS (apple-touch-icon): boleta de rifa. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const FONDO = "#0F1115";
const ORO = "#F0B928";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FONDO,
          position: "relative",
        }}
      >
        {/* Cuerpo de la boleta */}
        <div
          style={{ display: "flex", width: 128, height: 76, borderRadius: 18, background: ORO }}
        />
        {/* Muescas: círculos del color del fondo montados sobre los bordes */}
        <div
          style={{
            position: "absolute", top: 37, left: 75,
            width: 30, height: 30, borderRadius: 15, background: FONDO,
          }}
        />
        <div
          style={{
            position: "absolute", top: 113, left: 75,
            width: 30, height: 30, borderRadius: 15, background: FONDO,
          }}
        />
        {/* Perforación central */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute", top: 74 + i * 14, left: 87.5,
              width: 5, height: 9, borderRadius: 3, background: FONDO,
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  );
}
