// =============================================================================
// Ajusta cuántos PJ / PG se le muestran a un equipo en la tabla de posiciones,
// SIN tocar sus puntos, sus sets ni los de los demás equipos.
//
// Caso típico: un equipo retirado dejó un partido jugado y su rival quedó con
// un partido (y una victoria) de más que los demás. Se le resta 1 PJ y 1 PG.
//
// El ajuste vive en `torneos.reglas.tabla.ajustes` → { "<equipo_id>": { pj, pg } }
// y lo leen las tablas del panel, la página pública y la clasificación a
// eliminatorias. Es un valor ABSOLUTO (no se acumula): correrlo dos veces deja
// lo mismo. Para quitarlo: --pj 0 --pg 0.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/ajustar-tabla-equipo.mjs \
//        --torneo <id> --equipo "Desnivel" --pj -1 --pg -1 [--dry]
//
//   --equipo   Nombre (sin importar mayúsculas) o id del equipo.
//   --pj/--pg  Cuánto se suma a PJ / PG (negativo = restar). Por defecto 0.
//   --dry      No escribe: solo muestra el antes y el después.
//
// Necesita en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const opt = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = args.includes("--dry");
const torneoId = opt("torneo");
const buscado = opt("equipo");
const pj = Number.parseInt(opt("pj") ?? "0", 10);
const pg = Number.parseInt(opt("pg") ?? "0", 10);

if (!torneoId || !buscado || Number.isNaN(pj) || Number.isNaN(pg)) {
  console.error('Uso: --torneo <id> --equipo "<nombre o id>" [--pj -1] [--pg -1] [--dry]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa --env-file=.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: torneo, error: e1 } = await db.from("torneos").select("id, nombre, reglas").eq("id", torneoId).maybeSingle();
if (e1 || !torneo) {
  console.error("Torneo no encontrado.", e1?.message ?? "");
  process.exit(1);
}

const { data: equipos, error: e2 } = await db.from("equipos_torneo").select("id, nombre, estado").eq("torneo_id", torneoId);
if (e2) {
  console.error(e2.message);
  process.exit(1);
}
const coinciden = equipos.filter((e) => e.id === buscado || e.nombre.trim().toLowerCase() === buscado.trim().toLowerCase());
if (coinciden.length !== 1) {
  console.error(
    coinciden.length === 0
      ? `Ningún equipo se llama «${buscado}». Equipos: ${equipos.map((e) => e.nombre).join(", ")}`
      : `Hay ${coinciden.length} equipos con ese nombre; usa el id.`,
  );
  process.exit(1);
}
const equipo = coinciden[0];

const reglas = torneo.reglas ?? {};
const tabla = reglas.tabla ?? {};
const ajustes = { ...(tabla.ajustes ?? {}) };
const antes = ajustes[equipo.id] ?? { pj: 0, pg: 0 };
if (pj === 0 && pg === 0) delete ajustes[equipo.id];
else ajustes[equipo.id] = { pj, pg };

console.log(`Torneo:  ${torneo.nombre}`);
console.log(`Equipo:  ${equipo.nombre} (${equipo.id})`);
console.log(`Antes:   PJ ${antes.pj >= 0 ? "+" : ""}${antes.pj} · PG ${antes.pg >= 0 ? "+" : ""}${antes.pg}`);
console.log(`Después: PJ ${pj >= 0 ? "+" : ""}${pj} · PG ${pg >= 0 ? "+" : ""}${pg}`);

if (dry) {
  console.log("--dry: no se escribió nada.");
  process.exit(0);
}

const { error: e3 } = await db
  .from("torneos")
  .update({ reglas: { ...reglas, tabla: { ...tabla, ajustes } } })
  .eq("id", torneoId);
if (e3) {
  console.error(e3.message);
  process.exit(1);
}
console.log("Listo. Recarga la página del torneo para ver la tabla.");
