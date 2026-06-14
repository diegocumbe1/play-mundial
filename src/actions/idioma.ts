"use server";

import { cookies } from "next/headers";

import { IDIOMA_COOKIE, normalizarIdioma, type Idioma } from "@/lib/idioma";

export async function cambiarIdiomaAction(idioma: Idioma) {
  const store = await cookies();
  store.set(IDIOMA_COOKIE, normalizarIdioma(idioma), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
