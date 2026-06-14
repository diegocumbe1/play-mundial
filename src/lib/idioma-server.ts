import { cookies } from "next/headers";

import { IDIOMA_COOKIE, normalizarIdioma, type Idioma } from "@/lib/idioma";

export async function getIdioma(): Promise<Idioma> {
  const store = await cookies();
  return normalizarIdioma(store.get(IDIOMA_COOKIE)?.value);
}
