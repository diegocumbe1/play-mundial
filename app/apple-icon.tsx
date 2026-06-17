import { ImageResponse } from "next/og";

/** Ícono para "Agregar a inicio" en iOS (apple-touch-icon). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#0a0a0a",
          color: "#f5c518",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        PM
      </div>
    ),
    { ...size },
  );
}
