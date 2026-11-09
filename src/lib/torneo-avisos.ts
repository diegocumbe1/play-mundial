import "server-only";

import { leerMarcador, marcadorDisponible, type MarcadorLeido } from "@/lib/marcador-externo";
import { enviarPushDispositivo, type PushPayload } from "@/lib/push";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  cuandoYDonde,
  enlacePartido,
  minutosParaEmpezar,
  setsEnTexto,
  tocaRecordatorio,
  VENTANA_RECORDATORIO_MIN,
  type TipoAviso,
  nombreCancha,
} from "@/lib/torneo-avisos-reglas";
import { leerReglas } from "@/lib/torneo-reglas";
import type { Encuentro, Torneo } from "@/types";

/**
 * Notificaciones del organizador. Un aviso solo llega a los dispositivos de ese
 * organizador que lo tengan activo, y una sola vez por partido. Nada de esto
 * puede romper la acción que lo dispara: si falla, el resultado ya quedó guardado.
 */

interface Suscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
  tenant_id: string;
  minutos_antes: number;
  partido_nuevo: boolean;
  en_vivo: boolean;
  finalizado: boolean;
  siguiente: boolean;
}

type TorneoAviso = Pick<Torneo, "id" | "tenant_id" | "nombre"> & { reglas?: unknown };

/** Nombres de las canchas que puso el organizador (vacío = "Cancha N"). */
const canchasDe = (torneo: TorneoAviso): string[] =>
  torneo.reglas ? leerReglas(torneo.reglas).juego.nombres_canchas : [];

const svc = () => createServiceRoleClient();

async function suscripciones(tenantId: string): Promise<Suscripcion[]> {
  const { data } = await svc().from("suscripciones_avisos_torneo").select("*").eq("tenant_id", tenantId);
  return (data as Suscripcion[]) ?? [];
}

async function enviar(subs: Suscripcion[], payload: PushPayload): Promise<void> {
  await Promise.all(
    subs.map(async (s) => {
      const r = await enviarPushDispositivo(s, payload);
      if (r === "muerta") {
        await svc().from("suscripciones_avisos_torneo").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
}

/** Reserva el envío antes de hacerlo: devuelve solo quienes aún no lo tenían. */
async function sinAvisoPrevio(
  subs: Suscripcion[],
  encuentroId: string,
  tipo: TipoAviso,
): Promise<Suscripcion[]> {
  if (subs.length === 0) return [];
  const { data } = await svc()
    .from("avisos_torneo_enviados")
    .upsert(
      subs.map((s) => ({ encuentro_id: encuentroId, endpoint: s.endpoint, tipo })),
      { onConflict: "encuentro_id,endpoint,tipo", ignoreDuplicates: true },
    )
    .select("endpoint");
  const nuevos = new Set(((data as { endpoint: string }[]) ?? []).map((d) => d.endpoint));
  return subs.filter((s) => nuevos.has(s.endpoint));
}

async function nombresDe(encuentros: Pick<Encuentro, "equipo_a_id" | "equipo_b_id">[]) {
  const ids = [...new Set(encuentros.flatMap((e) => [e.equipo_a_id, e.equipo_b_id]))].filter(Boolean);
  const { data } = await svc().from("equipos_torneo").select("id, nombre").in("id", ids as string[]);
  const mapa = new Map(((data as { id: string; nombre: string }[]) ?? []).map((e) => [e.id, e.nombre]));
  return (id: string | null) => (id && mapa.get(id)) || "Por definir";
}

/** Corre un aviso sin dejar que su error llegue a quien guardó el partido. */
async function seguro(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[avisos-torneo]", err);
  }
}

/** Deja constancia de lo que reportó el juez, aunque nadie abra el partido. */
export async function guardarConstanciaJuez(e: Encuentro, leido: MarcadorLeido): Promise<void> {
  const nuevo = JSON.stringify({ sets: leido.sets, sin: leido.setSinTerminar });
  const previo = e.resultado_juez
    ? JSON.stringify({ sets: e.resultado_juez.sets, sin: e.resultado_juez.set_sin_terminar })
    : null;
  if (nuevo === previo) return;
  await svc()
    .from("encuentros")
    .update({
      resultado_juez: {
        sets: leido.sets,
        set_sin_terminar: leido.setSinTerminar,
        leido_at: new Date().toISOString(),
      },
    })
    .eq("id", e.id);
}

/** Se generó el fixture o las eliminatorias. */
export function avisarPartidosNuevos(torneo: TorneoAviso, titulo: string): Promise<void> {
  return seguro(async () => {
    const subs = (await suscripciones(torneo.tenant_id)).filter((s) => s.partido_nuevo);
    await enviar(subs, {
      torneo: torneo.nombre,
      title: titulo,
      body: "",
      url: `/admin/torneos/${torneo.id}`,
      tag: `torneo-${torneo.id}-nuevos`,
    });
  });
}

export function avisarEnVivo(torneo: TorneoAviso, e: Encuentro): Promise<void> {
  return seguro(async () => {
    const subs = await sinAvisoPrevio(
      (await suscripciones(torneo.tenant_id)).filter((s) => s.en_vivo),
      e.id,
      "en_vivo",
    );
    if (subs.length === 0) return;
    const nombre = await nombresDe([e]);
    await enviar(subs, {
      torneo: torneo.nombre,
      title: `En vivo: ${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`,
      body: e.cancha ? nombreCancha(e.cancha, canchasDe(torneo)) : "",
      url: enlacePartido(torneo.id, e.id),
      tag: `partido-${e.id}`,
    });
  });
}

/** Quedó el resultado oficial: lo avisa y anuncia el siguiente partido del torneo. */
export function avisarFinalizado(torneo: TorneoAviso, e: Encuentro): Promise<void> {
  return seguro(async () => {
    const todas = await suscripciones(torneo.tenant_id);
    const subs = await sinAvisoPrevio(todas.filter((s) => s.finalizado), e.id, "finalizado");
    const { data } = await svc()
      .from("encuentros")
      .select("*")
      .eq("torneo_id", torneo.id)
      .eq("estado", "programado")
      .not("equipo_a_id", "is", null)
      .not("equipo_b_id", "is", null)
      .gt("programado_at", new Date().toISOString())
      .order("programado_at")
      .limit(1);
    const sig = ((data as Encuentro[]) ?? [])[0] ?? null;
    const nombre = await nombresDe(sig ? [e, sig] : [e]);
    const partido = `${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`;

    if (subs.length > 0) {
      await enviar(subs, {
        torneo: torneo.nombre,
        title: `Partido finalizado: ${partido}`,
        body:
          e.estado === "wo"
            ? `Gana ${nombre(e.ganador_id)} por W.O.`
            : `${setsEnTexto(e.sets)}. Gana ${nombre(e.ganador_id)}.`,
        url: enlacePartido(torneo.id, e.id),
        tag: `partido-${e.id}`,
      });
    }
    if (!sig) return;
    const paraSiguiente = await sinAvisoPrevio(todas.filter((s) => s.siguiente), sig.id, "siguiente");
    if (paraSiguiente.length === 0) return;
    await enviar(paraSiguiente, {
      torneo: torneo.nombre,
      title: `Sigue: ${nombre(sig.equipo_a_id)} vs ${nombre(sig.equipo_b_id)}`,
      body: cuandoYDonde(sig.programado_at, sig.cancha, canchasDe(torneo)),
      url: enlacePartido(torneo.id, sig.id),
      tag: `siguiente-${sig.id}`,
    });
  });
}

/** Recordatorios de partidos cercanos, según los minutos que eligió cada dispositivo. */
async function enviarRecordatorios(ahora: Date, torneos: Map<string, TorneoAviso>): Promise<number> {
  const hasta = new Date(ahora.getTime() + VENTANA_RECORDATORIO_MIN * 60_000);
  const { data } = await svc()
    .from("encuentros")
    .select("*")
    .eq("estado", "programado")
    .not("equipo_a_id", "is", null)
    .not("equipo_b_id", "is", null)
    .gt("programado_at", ahora.toISOString())
    .lte("programado_at", hasta.toISOString());
  const partidos = ((data as Encuentro[]) ?? []).filter((e) => e.programado_at);
  if (partidos.length === 0) return 0;
  await cargarTorneos(partidos, torneos);
  const nombre = await nombresDe(partidos);

  let enviados = 0;
  for (const e of partidos) {
    const torneo = torneos.get(e.torneo_id);
    if (!torneo) continue;
    const candidatas = (await suscripciones(torneo.tenant_id)).filter((s) =>
      tocaRecordatorio(e.programado_at as string, s.minutos_antes, ahora),
    );
    const subs = await sinAvisoPrevio(candidatas, e.id, "recordatorio");
    if (subs.length === 0) continue;
    enviados += subs.length;
    await enviar(subs, {
      torneo: torneo.nombre,
      title: `En ${minutosParaEmpezar(e.programado_at as string, ahora)} min: ${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`,
      body: cuandoYDonde(e.programado_at, e.cancha, canchasDe(torneo)),
      url: enlacePartido(torneo.id, e.id),
      tag: `partido-${e.id}`,
    });
  }
  return enviados;
}

/** Revisa los marcadores abiertos: si el juez terminó, pide aprobar el resultado. */
async function revisarMarcadores(torneos: Map<string, TorneoAviso>): Promise<number> {
  if (!marcadorDisponible()) return 0;
  const { data } = await svc()
    .from("encuentros")
    .select("*")
    .eq("estado", "en_vivo")
    .not("sala_marcador", "is", null)
    .limit(50);
  const partidos = (data as Encuentro[]) ?? [];
  if (partidos.length === 0) return 0;
  await cargarTorneos(partidos, torneos);
  const nombre = await nombresDe(partidos);

  const conteos = await Promise.all(
    partidos.map(async (e) => {
      const torneo = torneos.get(e.torneo_id);
      const leido = await leerMarcador(e.sala_marcador as string);
      if (!torneo || !leido?.terminado) return 0;
      await guardarConstanciaJuez(e, leido);
      const subs = await sinAvisoPrevio(
        (await suscripciones(torneo.tenant_id)).filter((s) => s.finalizado),
        e.id,
        "por_aprobar",
      );
      await enviar(subs, {
        torneo: torneo.nombre,
        title: `Resultado por aprobar: ${nombre(e.equipo_a_id)} vs ${nombre(e.equipo_b_id)}`,
        body: leido.setSinTerminar
          ? "El juez cerró el partido antes de terminar. Toca para corregirlo."
          : `El juez reportó ${setsEnTexto(leido.sets)}. Toca para aceptar o corregir.`,
        url: enlacePartido(torneo.id, e.id),
        tag: `partido-${e.id}`,
      });
      return subs.length;
    }),
  );
  return conteos.reduce((a, b) => a + b, 0);
}

async function cargarTorneos(partidos: Encuentro[], torneos: Map<string, TorneoAviso>): Promise<void> {
  const faltan = [...new Set(partidos.map((e) => e.torneo_id))].filter((id) => !torneos.has(id));
  if (faltan.length === 0) return;
  const { data } = await svc().from("torneos").select("id, tenant_id, nombre, reglas").in("id", faltan);
  for (const t of (data as TorneoAviso[]) ?? []) torneos.set(t.id, t);
}

/** Lo que corre cada minuto. */
export async function procesarAvisosTorneo(ahora = new Date()) {
  const torneos = new Map<string, TorneoAviso>();
  const recordatorios = await enviarRecordatorios(ahora, torneos);
  const porAprobar = await revisarMarcadores(torneos);
  return { recordatorios, porAprobar };
}
