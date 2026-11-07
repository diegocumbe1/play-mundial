import { ImageResponse } from "next/og";

import { MARCA_SIMBOLO_PATH } from "@/lib/marca";

/** Ícono para "Agregar a inicio" en iOS (apple-touch-icon): el símbolo de la marca. */
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
        }}
      >
        {/* iOS redondea las esquinas por su cuenta: aquí el fondo va a sangre. */}
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path fill={ORO} fillRule="evenodd" d={MARCA_SIMBOLO_PATH} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
