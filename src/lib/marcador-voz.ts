/**
 * Voz del marcador en vivo (dc-sport-score): quién habla y si los anuncios
 * nombran a los equipos por su nombre o por su color. Se elige antes de abrir
 * la sala; el juez la puede cambiar durante el partido desde el menú ☰.
 *
 * Los valores deben coincidir con `public/config/options.json` de dc-sport-score
 * (`voiceSpeaker`, `voiceAnnounce` y `teamColors`).
 */

export const VOCES_MARCADOR = [
  { value: "co-f", label: "Colombia · mujer (Salomé)" },
  { value: "co-m", label: "Colombia · hombre (Gonzalo)" },
  { value: "mx-f", label: "México · mujer (Dalia)" },
  { value: "mx-m", label: "México · hombre (Jorge)" },
  { value: "la-f", label: "Latinoamérica · mujer (Paloma)" },
  { value: "la-m", label: "Latinoamérica · hombre (Alonso)" },
] as const;

export type VozMarcador = (typeof VOCES_MARCADOR)[number]["value"];
export const VOZ_POR_DEFECTO: VozMarcador = "co-f";

/** Colores que el marcador sabe decir en voz alta. */
export const COLORES_MARCADOR = [
  { value: "#1e6fd9", label: "Azul" },
  { value: "#d62f4b", label: "Rojo" },
  { value: "#1f9d55", label: "Verde" },
  { value: "#e0a100", label: "Amarillo" },
  { value: "#8e44ad", label: "Morado" },
  { value: "#e8590c", label: "Naranja" },
  { value: "#0ea5e9", label: "Celeste" },
  { value: "#db2777", label: "Rosado" },
  { value: "#4b5563", label: "Gris" },
  { value: "#7c4a1e", label: "Café" },
] as const;

export const COLORES_POR_DEFECTO: [string, string] = [COLORES_MARCADOR[0].value, COLORES_MARCADOR[1].value];

export interface OpcionesMarcador {
  /** «nombre» (por defecto): «Los Tigres, 5». «color»: «Azul, 5». */
  anuncio: "nombre" | "color";
  /** Colores de A y B en la pantalla (y en la voz si se anuncia por color). */
  colores: [string, string];
  voz: VozMarcador;
}

export const OPCIONES_MARCADOR_POR_DEFECTO: OpcionesMarcador = {
  anuncio: "nombre",
  colores: COLORES_POR_DEFECTO,
  voz: VOZ_POR_DEFECTO,
};

/** Normaliza lo que llega del cliente; cualquier valor desconocido vuelve al de por defecto. */
export function limpiarOpcionesMarcador(o: Partial<OpcionesMarcador> | null | undefined): OpcionesMarcador {
  const color = (c: unknown, i: 0 | 1) =>
    COLORES_MARCADOR.some((x) => x.value === c) ? (c as string) : COLORES_POR_DEFECTO[i];
  let colores: [string, string] = [color(o?.colores?.[0], 0), color(o?.colores?.[1], 1)];
  // Dos equipos del mismo color no se distinguen ni en la pantalla ni en la voz.
  if (colores[0] === colores[1]) {
    colores = [colores[0], COLORES_MARCADOR.find((x) => x.value !== colores[0])!.value];
  }
  return {
    anuncio: o?.anuncio === "color" ? "color" : "nombre",
    colores,
    voz: VOCES_MARCADOR.some((v) => v.value === o?.voz) ? (o!.voz as VozMarcador) : VOZ_POR_DEFECTO,
  };
}

const COLOR_POR_VALOR = new Map<string, string>(COLORES_MARCADOR.map((c) => [c.value, c.label]));

/** «LOS CUMBE» → «Los Cumbe» (en mayúsculas algunas voces deletrean). */
const hablado = (n: string) => n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * Frase de ejemplo con los equipos reales, igual a como canta el marcador:
 * «Los Cumbe contra Fase 4. Cero a cero. Los Cumbe, 5. Fase 4, 3. Empate a 3. Saca Fase 4.»
 */
export function fraseDePrueba(nombreA: string, nombreB: string, o: OpcionesMarcador): string {
  const [A, B] =
    o.anuncio === "color"
      ? [COLOR_POR_VALOR.get(o.colores[0]) ?? "Azul", COLOR_POR_VALOR.get(o.colores[1]) ?? "Rojo"]
      : [hablado(nombreA), hablado(nombreB)];
  return `${A} contra ${B}. Cero a cero. ${A}, 5. ${B}, 3. Empate a 3. Saca ${B}. Punto de set para ${A}.`;
}
