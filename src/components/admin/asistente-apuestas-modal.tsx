"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { crearApuestasAdmin } from "@/actions/apuestas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MetodoPago, Partido } from "@/types";

type PartidoAdmin = Pick<
  Partido,
  "id" | "equipo_local" | "equipo_visitante" | "fecha" | "estado"
>;

type ApuestaDetectada = {
  key: string;
  partidoId: string;
  golesLocal: number;
  golesVisitante: number;
  original: string;
};

type ParticipanteDetectado = {
  key: string;
  nombre: string;
  apuestas: ApuestaDetectada[];
};

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function limpiarLinea(linea: string) {
  return linea
    .replace(/\b\d{1,2}:\d{2}\s?(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)?\b/gi, "")
    .replace(/[^\p{L}\p{N}\s+().-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPartido(partido: PartidoAdmin) {
  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(partido.fecha));

  return `${partido.equipo_local} vs ${partido.equipo_visitante} · ${fecha}`;
}

function crearClienteIdAdmin() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `admin-${id}`;
}

function detectarEquipo(textoNormalizado: string, partidos: PartidoAdmin[]) {
  const equipos = partidos.flatMap((p) => [p.equipo_local, p.equipo_visitante]);

  return equipos
    .map((equipo) => ({ original: equipo, normalizado: normalizar(equipo) }))
    .filter(({ normalizado }) => textoNormalizado.includes(normalizado))
    .sort((a, b) => b.normalizado.length - a.normalizado.length)[0];
}

function detectarEquipoEnTexto(texto: string, partidos: PartidoAdmin[]) {
  return detectarEquipo(normalizar(texto), partidos);
}

function partidoConEquipo(equipo: string, partidos: PartidoAdmin[]) {
  const normalizado = normalizar(equipo);
  return partidos.find(
    (p) =>
      normalizar(p.equipo_local) === normalizado ||
      normalizar(p.equipo_visitante) === normalizado,
  );
}

function partidoConEquipos(
  equipoA: string,
  equipoB: string,
  partidos: PartidoAdmin[],
) {
  const a = normalizar(equipoA);
  const b = normalizar(equipoB);
  return partidos.find((p) => {
    const local = normalizar(p.equipo_local);
    const visitante = normalizar(p.equipo_visitante);
    return (
      (local === a && visitante === b) ||
      (local === b && visitante === a)
    );
  });
}

function detectarPago(textoNormalizado: string): {
  pagado: boolean;
  metodo: MetodoPago | null;
} {
  const pagado = /\b(ya\s+pag[óo]|pag[óo]|pagado|pague|pagu[eé])\b/.test(
    textoNormalizado,
  );
  if (!pagado) return { pagado: false, metodo: null };

  if (/\b(efectivo|cash)\b/.test(textoNormalizado)) {
    return { pagado: true, metodo: "efectivo" };
  }
  if (/\b(transfer|transferencia|nequi|daviplata|bancolombia|qr)\b/.test(textoNormalizado)) {
    return { pagado: true, metodo: "transferencia" };
  }

  return { pagado: true, metodo: null };
}

function marcadorParaPartido({
  partido,
  equipoMencionado,
  golesEquipo,
  golesRival,
}: {
  partido: PartidoAdmin;
  equipoMencionado?: string;
  golesEquipo: number;
  golesRival: number;
}) {
  if (!equipoMencionado) {
    return { golesLocal: golesEquipo, golesVisitante: golesRival };
  }

  const mencionado = normalizar(equipoMencionado);
  if (normalizar(partido.equipo_visitante) === mencionado) {
    return { golesLocal: golesRival, golesVisitante: golesEquipo };
  }

  return { golesLocal: golesEquipo, golesVisitante: golesRival };
}

function apuestaDesdeMarcadorConEquipos(
  linea: string,
  partidos: PartidoAdmin[],
  index: number,
): ApuestaDetectada | null {
  const match = linea.match(/^(\d{1,2})\s+(.+?)\s+(\d{1,2})\s+(.+)$/i);
  if (!match) return null;

  const golesA = Number(match[1]);
  const equipoA = detectarEquipoEnTexto(match[2], partidos);
  const golesB = Number(match[3]);
  const equipoB = detectarEquipoEnTexto(match[4], partidos);
  if (!equipoA || !equipoB) return null;

  const partido = partidoConEquipos(equipoA.original, equipoB.original, partidos);
  if (!partido) return null;

  const localEsA = normalizar(partido.equipo_local) === equipoA.normalizado;
  return {
    key: `equipos-${index}-${partido.id}`,
    partidoId: partido.id,
    golesLocal: localEsA ? golesA : golesB,
    golesVisitante: localEsA ? golesB : golesA,
    original: linea,
  };
}

function apuestaDesdeGanador(
  linea: string,
  partidos: PartidoAdmin[],
  index: number,
): ApuestaDetectada | null {
  const texto = normalizar(linea);
  if (!/\b(ganador|gana|ganando)\b/.test(texto)) return null;
  if (/\b(los dos|las dos|ambos|ambas)\b/.test(texto)) return null;

  const equipo = detectarEquipo(texto, partidos);
  if (!equipo) return null;

  const partido = partidoConEquipo(equipo.original, partidos);
  if (!partido) return null;

  const marcador = marcadorParaPartido({
    partido,
    equipoMencionado: equipo.original,
    golesEquipo: 1,
    golesRival: 0,
  });

  return {
    key: `ganador-${index}-${partido.id}`,
    partidoId: partido.id,
    original: linea,
    ...marcador,
  };
}

function limpiarNombreCandidato(value: string, partidos: PartidoAdmin[]) {
  const limpio = value
    .replace(/\b(marcador|apuesta|partido|de|del|para)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpio || !/[a-záéíóúñ]/i.test(limpio)) return "";

  const normalizado = normalizar(limpio);
  const esEquipo = partidos.some(
    (p) =>
      normalizar(p.equipo_local) === normalizado ||
      normalizar(p.equipo_visitante) === normalizado,
  );

  return esEquipo ? "" : limpio;
}

function esLineaNombre(linea: string, partidos: PartidoAdmin[]) {
  const texto = normalizar(linea);
  if (/\d+\s*[-–]\s*\d+/.test(texto)) return false;
  if (/\b(ganador|gana|ganando|marcador|apuesta|partido|pag[óo]|pagado)\b/.test(texto)) {
    return false;
  }
  if (detectarEquipo(texto, partidos)) return false;
  return Boolean(limpiarNombreCandidato(linea, partidos));
}

function nombreAntesDelGanador(linea: string, partidos: PartidoAdmin[]) {
  const [antes] = linea.split(/\b(?:ganador|gana|ganando)\b/i);
  return limpiarNombreCandidato(antes ?? "", partidos);
}

function parsearMensaje(mensaje: string, partidos: PartidoAdmin[]) {
  const lineas = mensaje
    .split(/\r?\n/)
    .map(limpiarLinea)
    .filter(Boolean);
  const textoNormalizado = normalizar(lineas.join(" "));
  const equipo = detectarEquipo(textoNormalizado, partidos);
  const candidatos = equipo
    ? partidos.filter(
        (p) =>
          normalizar(p.equipo_local) === equipo.normalizado ||
          normalizar(p.equipo_visitante) === equipo.normalizado,
      )
    : partidos;
  const partidoBase = candidatos[0] ?? partidos[0];
  const pago = detectarPago(textoNormalizado);
  const participantes: ParticipanteDetectado[] = [];
  let nombreActual = "";

  function agregarApuesta(nombre: string, apuesta: ApuestaDetectada) {
    const nombreLimpio = limpiarNombreCandidato(nombre, partidos) || nombreActual;
    if (!nombreLimpio) return;

    const key = normalizar(nombreLimpio);
    const existente = participantes.find((p) => normalizar(p.nombre) === key);
    if (existente) {
      existente.apuestas.push(apuesta);
      return;
    }

    participantes.push({
      key: `${key}-${participantes.length}`,
      nombre: nombreLimpio,
      apuestas: [apuesta],
    });
  }

  lineas.forEach((linea, index) => {
    if (esLineaNombre(linea, partidos)) {
      nombreActual = limpiarNombreCandidato(linea, partidos);
      return;
    }

    const marcadorEquipos = apuestaDesdeMarcadorConEquipos(linea, partidos, index);
    if (marcadorEquipos) {
      agregarApuesta(nombreActual, marcadorEquipos);
      return;
    }

    const scores = [...linea.matchAll(/(\d{1,2})\s*[-–]\s*(\d{1,2})/g)];
    if (scores.length > 0 && partidoBase) {
      scores.forEach((match, scoreIndex) => {
        const nombreEnLinea = limpiarNombreCandidato(
          linea.slice(0, match.index),
          partidos,
        );
        const golesEquipo = Number(match[1]);
        const golesRival = Number(match[2]);
        const marcador = marcadorParaPartido({
          partido: partidoBase,
          equipoMencionado: equipo?.original,
          golesEquipo,
          golesRival,
        });

        agregarApuesta(nombreEnLinea, {
          key: `${index}-${scoreIndex}-${match[0]}-${partidoBase.id}`,
          partidoId: partidoBase.id,
          original: match[0],
          ...marcador,
        });
      });
      return;
    }

    const ganador = apuestaDesdeGanador(linea, candidatos, index);
    if (ganador) {
      agregarApuesta(nombreAntesDelGanador(linea, partidos), ganador);
    }
  });

  return {
    participantes,
    equipo: equipo?.original,
    pago,
  };
}

export function AsistenteApuestasModal({ partidos }: { partidos: PartidoAdmin[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [telefono, setTelefono] = useState("");
  const [equipoDetectado, setEquipoDetectado] = useState<string | undefined>();
  const [pagoDetectado, setPagoDetectado] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteDetectado[]>([]);
  const [pending, startTransition] = useTransition();

  const partidosOrdenados = useMemo(
    () =>
      [...partidos]
        .filter((p) => p.estado === "programado")
        .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha)),
    [partidos],
  );

  function analizar() {
    if (partidosOrdenados.length === 0) {
      toast.error("No hay partidos próximos para apostar.");
      return;
    }

    const resultado = parsearMensaje(mensaje, partidosOrdenados);
    if (resultado.participantes.length === 0) {
      toast.error("No encontré marcadores tipo 1-0 o 3-1.");
      return;
    }

    setParticipantes(resultado.participantes);
    setEquipoDetectado(resultado.equipo);
    setPagoDetectado(resultado.pago.pagado);
    setMetodoPago(resultado.pago.metodo);
  }

  function actualizarParticipante(key: string, nombre: string) {
    setParticipantes((prev) =>
      prev.map((participante) =>
        participante.key === key ? { ...participante, nombre } : participante,
      ),
    );
  }

  function actualizarApuesta(
    participanteKey: string,
    key: string,
    update: Partial<Omit<ApuestaDetectada, "key" | "original">>,
  ) {
    setParticipantes((prev) =>
      prev.map((participante) =>
        participante.key === participanteKey
          ? {
              ...participante,
              apuestas: participante.apuestas.map((apuesta) =>
                apuesta.key === key ? { ...apuesta, ...update } : apuesta,
              ),
            }
          : participante,
      ),
    );
  }

  function confirmar() {
    if (pending) return;
    const participantesValidos = participantes
      .map((participante) => ({
        ...participante,
        nombre: participante.nombre.trim(),
      }))
      .filter((participante) => participante.nombre && participante.apuestas.length > 0);

    if (participantesValidos.length === 0) {
      toast.error("Agrega al menos una apuesta.");
      return;
    }
    if (pagoDetectado && !metodoPago) {
      toast.error("Elige si pagó por transferencia o en efectivo.");
      return;
    }

    startTransition(async () => {
      let total = 0;
      for (const participante of participantesValidos) {
        const result = await crearApuestasAdmin({
          nombre: participante.nombre,
          cliente_id: crearClienteIdAdmin(),
          telefono: telefono.trim() === "" ? null : telefono.trim(),
          pagado: pagoDetectado,
          metodo_pago: pagoDetectado ? metodoPago : null,
          apuestas: participante.apuestas.map((apuesta) => ({
            partido_id: apuesta.partidoId,
            goles_local: apuesta.golesLocal,
            goles_visitante: apuesta.golesVisitante,
          })),
        });

        if (!result.success) {
          toast.error(`${participante.nombre}: ${result.error}`);
          return;
        }
        total += result.data.count;
      }

      toast.success(
        `${total} apuesta(s) creada(s) para ${participantesValidos.length} persona(s).`,
      );
      setOpen(false);
      setMensaje("");
      setTelefono("");
      setEquipoDetectado(undefined);
      setPagoDetectado(false);
      setMetodoPago(null);
      setParticipantes([]);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-polla-line bg-polla-surface text-white hover:bg-polla-elevated"
      >
        <MessageSquareText className="size-4" />
        Asistente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-polla-surface border-polla-line grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="min-w-0">
            <DialogTitle className="font-heading text-polla-gold px-4 pt-4 pr-12 text-xl tracking-wide sm:text-2xl">
              Asistente de apuestas
            </DialogTitle>
            <DialogDescription className="text-polla-muted px-4">
              Pega o escribe apuestas, revisa la interpretación y confirma.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 min-w-0 gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={5}
              placeholder={
                "nombre 2-1 gana Colombia\nNombre 0-0 partido de Colombia\n2 Colombia 0 Croacia"
              }
              className="border-polla-line bg-polla-elevated focus:ring-polla-gold/40 w-full resize-none rounded-lg border px-3 py-2 text-sm text-white outline-none focus:ring-2"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button type="button" onClick={analizar} disabled={pending}>
                <Wand2 className="size-4" />
                Interpretar
              </Button>
              {equipoDetectado && (
                <span className="text-polla-muted min-w-0 truncate text-xs">
                  Equipo detectado: {equipoDetectado}
                </span>
              )}
              {pagoDetectado && (
                <span className="text-polla-gold text-xs">
                  Pago detectado
                </span>
              )}
            </div>

            {participantes.length > 0 && (
              <div className="grid min-w-0 gap-4">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="text-polla-muted self-end text-sm">
                    {participantes.length} persona(s) detectada(s)
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-polla-muted text-xs font-medium">
                      Teléfono opcional común
                    </span>
                    <input
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="border-polla-line bg-polla-elevated focus:ring-polla-gold/40 h-10 rounded-lg border px-3 text-white outline-none focus:ring-2"
                    />
                  </label>
                </div>

                {pagoDetectado && (
                  <div className="border-polla-gold/30 bg-polla-gold/10 grid gap-3 rounded-lg border p-3">
                    <div>
                      <div className="font-semibold text-white">
                        El mensaje dice que ya pagó
                      </div>
                      <div className="text-polla-muted text-xs">
                        Confirma el medio antes de crear las apuestas como pagadas.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={metodoPago === "transferencia" ? "default" : "outline"}
                        onClick={() => setMetodoPago("transferencia")}
                        className={
                          metodoPago === "transferencia"
                            ? "bg-polla-gold text-polla-dark hover:bg-polla-gold/90"
                            : undefined
                        }
                      >
                        Transferencia
                      </Button>
                      <Button
                        type="button"
                        variant={metodoPago === "efectivo" ? "default" : "outline"}
                        onClick={() => setMetodoPago("efectivo")}
                        className={
                          metodoPago === "efectivo"
                            ? "bg-polla-gold text-polla-dark hover:bg-polla-gold/90"
                            : undefined
                        }
                      >
                        Efectivo
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid min-w-0 gap-3">
                  {participantes.map((participante) => (
                    <div
                      key={participante.key}
                      className="border-polla-line bg-polla-elevated/60 grid min-w-0 gap-3 rounded-lg border p-3"
                    >
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-polla-muted text-xs font-medium">
                          Persona
                        </span>
                        <input
                          value={participante.nombre}
                          onChange={(e) =>
                            actualizarParticipante(participante.key, e.target.value)
                          }
                          className="border-polla-line bg-polla-surface focus:ring-polla-gold/40 h-10 rounded-lg border px-3 text-white outline-none focus:ring-2"
                        />
                      </label>

                      {participante.apuestas.map((apuesta, index) => {
                        const partido = partidosOrdenados.find(
                          (p) => p.id === apuesta.partidoId,
                        );

                        return (
                          <div key={apuesta.key} className="grid min-w-0 gap-3">
                            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                              <span className="font-semibold whitespace-nowrap text-white">
                                Apuesta {index + 1}
                              </span>
                              <span className="text-polla-muted min-w-0 truncate text-right text-xs">
                                Detectado: {apuesta.original}
                              </span>
                            </div>
                            <select
                              value={apuesta.partidoId}
                              onChange={(e) =>
                                actualizarApuesta(participante.key, apuesta.key, {
                                  partidoId: e.target.value,
                                })
                              }
                              className="border-polla-line bg-polla-surface focus:ring-polla-gold/40 h-10 w-full min-w-0 rounded-lg border px-3 text-sm text-white outline-none focus:ring-2"
                            >
                              {partidosOrdenados.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatPartido(p)}
                                </option>
                              ))}
                            </select>
                            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_72px_72px] sm:items-end">
                              <div className="text-polla-muted min-w-0 truncate text-sm">
                                {partido
                                  ? `${partido.equipo_local} vs ${partido.equipo_visitante}`
                                  : "Partido"}
                              </div>
                              <div className="grid grid-cols-2 gap-2 sm:contents">
                                <input
                                  type="number"
                                  min={0}
                                  value={apuesta.golesLocal}
                                  onChange={(e) =>
                                    actualizarApuesta(participante.key, apuesta.key, {
                                      golesLocal: Number(e.target.value),
                                    })
                                  }
                                  aria-label="Goles local"
                                  className="border-polla-line bg-polla-surface focus:ring-polla-gold/40 h-10 min-w-0 rounded-lg border px-2 text-center text-white outline-none focus:ring-2"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={apuesta.golesVisitante}
                                  onChange={(e) =>
                                    actualizarApuesta(participante.key, apuesta.key, {
                                      golesVisitante: Number(e.target.value),
                                    })
                                  }
                                  aria-label="Goles visitante"
                                  className="border-polla-line bg-polla-surface focus:ring-polla-gold/40 h-10 min-w-0 rounded-lg border px-2 text-center text-white outline-none focus:ring-2"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-polla-line bg-polla-surface/95 -mx-0 -mb-0 flex-col rounded-none p-4 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmar}
              disabled={pending || participantes.length === 0}
              className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 w-full sm:w-auto"
            >
              {pending ? "Creando..." : "Confirmar apuestas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
