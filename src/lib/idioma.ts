export type Idioma = "es" | "en";

export const IDIOMA_COOKIE = "polla_idioma";

export function normalizarIdioma(value: string | undefined | null): Idioma {
  return value === "en" ? "en" : "es";
}

const EQUIPOS_ES: Record<string, string> = {
  Albania: "Albania",
  Algeria: "Argelia",
  Angola: "Angola",
  Argentina: "Argentina",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Bélgica",
  Bolivia: "Bolivia",
  Brazil: "Brasil",
  Bulgaria: "Bulgaria",
  Cameroon: "Camerún",
  Canada: "Canadá",
  Chile: "Chile",
  China: "China",
  Colombia: "Colombia",
  "Costa Rica": "Costa Rica",
  Croatia: "Croacia",
  "Czech Republic": "República Checa",
  Denmark: "Dinamarca",
  Ecuador: "Ecuador",
  Egypt: "Egipto",
  England: "Inglaterra",
  Finland: "Finlandia",
  France: "Francia",
  Germany: "Alemania",
  Ghana: "Ghana",
  Greece: "Grecia",
  Honduras: "Honduras",
  Hungary: "Hungría",
  Iceland: "Islandia",
  Iran: "Irán",
  Iraq: "Irak",
  Ireland: "Irlanda",
  Italy: "Italia",
  "Ivory Coast": "Costa de Marfil",
  Japan: "Japón",
  Mexico: "México",
  Morocco: "Marruecos",
  Netherlands: "Países Bajos",
  "New Zealand": "Nueva Zelanda",
  Nigeria: "Nigeria",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguay",
  Peru: "Perú",
  Poland: "Polonia",
  Portugal: "Portugal",
  Qatar: "Catar",
  Romania: "Rumania",
  Russia: "Rusia",
  "Saudi Arabia": "Arabia Saudita",
  Scotland: "Escocia",
  Senegal: "Senegal",
  Serbia: "Serbia",
  Slovakia: "Eslovaquia",
  Slovenia: "Eslovenia",
  "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur",
  Spain: "España",
  Sweden: "Suecia",
  Switzerland: "Suiza",
  Tunisia: "Túnez",
  Turkey: "Turquía",
  Ukraine: "Ucrania",
  Uruguay: "Uruguay",
  USA: "Estados Unidos",
  "United States": "Estados Unidos",
  Wales: "Gales",
};

const LIGAS_ES: Record<string, string> = {
  "FIFA World Cup": "Mundial 2026",
  "World Cup": "Mundial 2026",
};

export function traducirEquipo(nombre: string, idioma: Idioma): string {
  if (idioma === "en") return nombre;
  return EQUIPOS_ES[nombre] ?? nombre;
}

export function traducirLiga(nombre: string | null, idioma: Idioma): string {
  if (!nombre) return idioma === "en" ? "World Cup 2026" : "Mundial 2026";
  if (idioma === "en") return nombre;
  return LIGAS_ES[nombre] ?? nombre;
}
