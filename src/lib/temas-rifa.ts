/**
 * Temas visuales de una rifa (presets). Se aplican a la página pública
 * `/r/[slug]` (paleta `web`, vía CSS vars) y al flyer PNG (paleta `flyer`, hex
 * para satori). El owner elige el tema al crear/editar la rifa.
 */

export type TemaRifa = "rosa" | "clasico" | "esmeralda" | "oceano" | "durazno";

export interface TemaWeb {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  line: string;
  ocupadoBg: string;
  ocupadoInk: string;
}

export interface TemaFlyer {
  bgTop: string;
  bgBottom: string;
  band: string;
  card: string;
  ink: string;
  accent: string;
  titulo: string;
  numBg: string;
  numInk: string;
  ocupBg: string;
  ocupInk: string;
}

export interface Tema {
  nombre: string;
  /** Color representativo para el selector. */
  chip: string;
  web: TemaWeb;
  flyer: TemaFlyer;
}

export const TEMAS: Record<TemaRifa, Tema> = {
  rosa: {
    nombre: "Rosa floral",
    chip: "#D06A88",
    web: {
      bg: "#E9EEEA", surface: "#FCF3F6", text: "#3A4A3F", muted: "#7A8A80",
      accent: "#D0648A", accentInk: "#FFFFFF", line: "#DCE5DE",
      ocupadoBg: "#E4CDD3", ocupadoInk: "#9A7A82",
    },
    flyer: {
      bgTop: "#7E9A84", bgBottom: "#6B8872", band: "#F7D9E2", card: "#FCF6F2",
      ink: "#3A4A3F", accent: "#D06A88", titulo: "#FBE3EA",
      numBg: "#FBE3EA", numInk: "#3A4A3F", ocupBg: "#E4CDD3", ocupInk: "#9A7A82",
    },
  },
  clasico: {
    nombre: "Clásico oscuro",
    chip: "#E9B949",
    web: {
      bg: "#0E1116", surface: "#171B22", text: "#E8EAED", muted: "#9AA3AE",
      accent: "#E9B949", accentInk: "#1A1A1A", line: "#262B33",
      ocupadoBg: "#2A2F37", ocupadoInk: "#6B7280",
    },
    flyer: {
      bgTop: "#1B2130", bgBottom: "#0C0F17", band: "#E9B949", card: "#1E2430",
      ink: "#E8EAED", accent: "#E9B949", titulo: "#E9B949",
      numBg: "#232A38", numInk: "#E8EAED", ocupBg: "#2A3140", ocupInk: "#5B6474",
    },
  },
  esmeralda: {
    nombre: "Esmeralda",
    chip: "#0E9F6E",
    web: {
      bg: "#EAF3EE", surface: "#FFFFFF", text: "#123227", muted: "#5F7A6C",
      accent: "#0E9F6E", accentInk: "#FFFFFF", line: "#D6E7DD",
      ocupadoBg: "#DDE7E1", ocupadoInk: "#8AA397",
    },
    flyer: {
      bgTop: "#0E9F6E", bgBottom: "#0B7A54", band: "#D1FAE5", card: "#F0FDF4",
      ink: "#123227", accent: "#0B7A54", titulo: "#D1FAE5",
      numBg: "#DCFCE7", numInk: "#123227", ocupBg: "#BFD8C9", ocupInk: "#6B8577",
    },
  },
  oceano: {
    nombre: "Océano",
    chip: "#2563EB",
    web: {
      bg: "#EAF1F8", surface: "#FFFFFF", text: "#0F2A43", muted: "#5E7492",
      accent: "#2563EB", accentInk: "#FFFFFF", line: "#D5E2F0",
      ocupadoBg: "#DCE4EF", ocupadoInk: "#8595A8",
    },
    flyer: {
      bgTop: "#2563EB", bgBottom: "#1E40AF", band: "#DBEAFE", card: "#EFF6FF",
      ink: "#0F2A43", accent: "#1E40AF", titulo: "#DBEAFE",
      numBg: "#DBEAFE", numInk: "#0F2A43", ocupBg: "#C2D2E8", ocupInk: "#7488A3",
    },
  },
  durazno: {
    nombre: "Durazno",
    chip: "#EA7A3B",
    web: {
      bg: "#FBF0E8", surface: "#FFFFFF", text: "#4A2E22", muted: "#8A6A58",
      accent: "#EA7A3B", accentInk: "#FFFFFF", line: "#F0DECD",
      ocupadoBg: "#EFD9C9", ocupadoInk: "#A98A76",
    },
    flyer: {
      bgTop: "#F0A968", bgBottom: "#E0824A", band: "#FDE9D6", card: "#FFF6EE",
      ink: "#4A2E22", accent: "#D9662E", titulo: "#FDE9D6",
      numBg: "#FDE9D6", numInk: "#4A2E22", ocupBg: "#EFD3BC", ocupInk: "#A98A76",
    },
  },
};

export const TEMA_DEFAULT: TemaRifa = "rosa";

export function getTema(t?: string | null): Tema {
  return TEMAS[(t as TemaRifa) ?? TEMA_DEFAULT] ?? TEMAS[TEMA_DEFAULT];
}
