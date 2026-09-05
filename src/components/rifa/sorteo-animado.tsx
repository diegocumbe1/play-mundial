"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight, Dices, RotateCcw, Trophy } from "lucide-react";

import { formatNumero } from "@/lib/rifa";
import type { BolaSorteo } from "@/types";

type Fase = "espera" | "girando" | "revelada" | "fin";

/**
 * Cómo se muestran las balotas:
 * - `auto`: se encadenan solas (replay y simulación rápida).
 * - `manual`: el organizador pulsa por cada balota — es el que da el suspenso.
 * - `espectador`: no manda la pantalla, manda `reveladas` (el live público).
 */
export type ModoSorteo = "auto" | "manual" | "espectador";

/** Ritmo de la animación (ms). Con reduced-motion se acorta casi a cero. */
const GIRO_MS = 1900;
const PAUSA_MS = 1100;
const TICK_MS = 70;

/**
 * Paleta: dentro de la página pública manda el tema de la rifa (vars
 * `--rifa-*`); en el backoffice no existen y cae a los tokens de la app.
 */
const C = {
  accent: "var(--rifa-accent, var(--primary))",
  accentInk: "var(--rifa-accent-ink, var(--primary-foreground))",
  surface: "var(--rifa-surface, var(--card))",
  line: "var(--rifa-line, var(--border))",
  muted: "var(--rifa-muted, var(--muted-foreground))",
  neutro: "var(--rifa-ocupado, var(--muted))",
  texto: "var(--rifa-text, var(--foreground))",
};

/** Mezcla un color del tema con transparencia (para halos y fondos suaves). */
function velo(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

const MQ_MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

function suscribirMovimiento(avisar: () => void) {
  const mq = window.matchMedia(MQ_MENOS_MOVIMIENTO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

/** ¿El sistema pide menos movimiento? En el servidor se asume que no. */
function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia(MQ_MENOS_MOVIMIENTO).matches,
    () => false,
  );
}

/**
 * Sorteo tipo baloto: la tómbola gira, sale una balota a la vez y al final se
 * corona la del premio mayor.
 *
 * No decide nada: recibe la secuencia REAL ya sorteada en el servidor y la
 * reproduce. Por eso sirve para el momento del sorteo (con el organizador
 * marcando el ritmo), para el live del público y para volver a verlo después.
 */
export function SorteoAnimado({
  bolas,
  ancho,
  min,
  max,
  modo = "auto",
  autoPlay = true,
  reveladas = 0,
  total,
  finalistas = 0,
  onRevelar,
  onFin,
}: {
  bolas: BolaSorteo[];
  /** Dígitos con los que se pintan los números (2 → "07"). */
  ancho: number;
  /** Rango de los números que pasan volando mientras gira. */
  min: number;
  max: number;
  modo?: ModoSorteo;
  /** Solo en `auto`: `false` la muestra ya terminada. */
  autoPlay?: boolean;
  /** Solo en `espectador`: cuántas balotas ya cantó el organizador. */
  reveladas?: number;
  /**
   * Balotas del sorteo completo. En `espectador` suele ser mayor que
   * `bolas.length` (las que faltan se pintan como espacios vacíos).
   */
  total?: number;
  /**
   * Cuántas de las balotas son de la 1ª ronda (finalistas). Si es 0 —o igual al
   * total— se pinta una sola tanda; si no, se separan las dos rondas.
   */
  finalistas?: number;
  /** En `manual`: se avisa cada vez que se canta una balota (índice 0-based). */
  onRevelar?: (indice: number) => void;
  onFin?: () => void;
}) {
  const espectador = modo === "espectador";
  const manual = modo === "manual";
  const totalBolas = Math.max(total ?? bolas.length, bolas.length);

  const [estado, setEstado] = useState<{ paso: number; fase: Fase }>(() => {
    // En manual se retoma donde quedó: si ya se cantaron balotas, el sorteo
    // sigue desde ahí (el público nunca ve menos de lo que ya vio).
    if (manual) {
      const yaCantadas = Math.min(Math.max(0, reveladas), bolas.length);
      return yaCantadas >= bolas.length && bolas.length > 0
        ? { paso: bolas.length, fase: "fin" }
        : { paso: yaCantadas, fase: "espera" };
    }
    if (espectador) return { paso: 0, fase: "girando" };
    return autoPlay && bolas.length > 0
      ? { paso: 0, fase: "girando" }
      : { paso: bolas.length, fase: "fin" };
  });
  const [ruleta, setRuleta] = useState(min);

  const onFinRef = useRef(onFin);
  const onRevelarRef = useRef(onRevelar);
  useEffect(() => {
    onFinRef.current = onFin;
    onRevelarRef.current = onRevelar;
  });

  // Quien pidió menos movimiento igual ve el resultado, casi sin espera.
  const rapido = useMenosMovimiento();
  const giroMs = rapido ? 250 : GIRO_MS;
  const pausaMs = rapido ? 200 : PAUSA_MS;

  // En el live no manda esta pantalla: manda cuántas balotas van cantadas.
  const efectivo: { paso: number; fase: Fase } = espectador
    ? reveladas >= totalBolas
      ? { paso: totalBolas, fase: "fin" }
      : { paso: reveladas, fase: "girando" }
    : estado;

  useEffect(() => {
    if (espectador) return;
    if (efectivo.fase === "girando") {
      const t = setTimeout(() => setEstado((s) => ({ ...s, fase: "revelada" })), giroMs);
      return () => clearTimeout(t);
    }
    // En manual la pausa la marca el organizador con el botón.
    if (efectivo.fase === "revelada" && !manual) {
      const t = setTimeout(() => {
        setEstado((s) =>
          s.paso + 1 < totalBolas
            ? { paso: s.paso + 1, fase: "girando" }
            : { paso: totalBolas, fase: "fin" },
        );
      }, pausaMs);
      return () => clearTimeout(t);
    }
  }, [espectador, manual, efectivo.fase, totalBolas, giroMs, pausaMs]);

  // Números que pasan volando mientras la tómbola gira.
  useEffect(() => {
    if (efectivo.fase !== "girando") return;
    const id = setInterval(() => {
      setRuleta(min + Math.floor(Math.random() * Math.max(1, max - min + 1)));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [efectivo.fase, efectivo.paso, min, max]);

  // Cada balota cantada se avisa hacia afuera (el panel la publica para el live).
  useEffect(() => {
    if (efectivo.fase === "revelada") onRevelarRef.current?.(efectivo.paso);
  }, [efectivo.fase, efectivo.paso]);

  useEffect(() => {
    if (efectivo.fase === "fin") onFinRef.current?.();
  }, [efectivo.fase]);

  if (totalBolas === 0) return null;

  const girando = efectivo.fase === "girando";
  const enEspera = efectivo.fase === "espera";
  const termino = efectivo.fase === "fin";
  const actual = bolas[Math.min(efectivo.paso, bolas.length - 1)];
  const ultimaCantada = termino ? bolas[bolas.length - 1] : actual;
  const enPantalla = girando || enEspera ? ruleta : (ultimaCantada?.numero ?? min);

  // Rondas: la clasificatoria filtra finalistas, la final saca al ganador.
  const corte = finalistas > 0 && finalistas < totalBolas ? finalistas : 0;
  const dosRondas = corte > 0;

  /** "la 2ª balota finalista" / "la balota ganadora", según en qué ronda va. */
  function etiquetaPaso(indice: number): string {
    if (!dosRondas) return `la balota ${indice + 1} de ${totalBolas}`;
    return indice < corte
      ? `la finalista ${indice + 1} de ${corte}`
      : `la ganadora ${indice - corte + 1} de ${totalBolas - corte}`;
  }

  /** El organizador canta la balota que está girando / pasa a la siguiente. */
  function avanzar() {
    setEstado((s) => {
      if (s.fase === "espera") return { ...s, fase: "girando" };
      if (s.fase === "revelada") {
        return s.paso + 1 < totalBolas
          ? { paso: s.paso + 1, fase: "espera" }
          : { paso: totalBolas, fase: "fin" };
      }
      return s;
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Tómbola */}
      <div
        className={
          "relative flex size-40 items-center justify-center rounded-full border-4 " +
          (girando ? "animate-tombola" : "")
        }
        style={{
          borderColor: velo(C.accent, 45),
          background: C.surface,
          boxShadow: `0 0 44px -10px ${velo(C.accent, 70)}`,
        }}
        aria-hidden
      >
        {/* Balotas de relleno dando vueltas dentro del bombo */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="absolute size-3.5 rounded-full"
            style={{
              background: velo(C.accent, 30),
              left: `${46 + 36 * Math.cos((i / 6) * Math.PI * 2)}%`,
              top: `${46 + 36 * Math.sin((i / 6) * Math.PI * 2)}%`,
              animation: girando ? `float 1.1s ease-in-out ${i * 0.12}s infinite` : undefined,
            }}
          />
        ))}

        <span
          key={`${efectivo.paso}-${girando || enEspera ? "giro" : "fija"}`}
          className={
            "relative flex size-24 items-center justify-center rounded-full text-3xl font-black tabular-nums " +
            (girando ? "opacity-90" : enEspera ? "opacity-45" : "animate-bola-sale")
          }
          style={{ background: C.accent, color: C.accentInk }}
        >
          {formatNumero(enPantalla, ancho)}
        </span>
      </div>

      <p
        className="text-center text-sm font-medium"
        style={{ color: termino ? C.texto : C.muted }}
        aria-live="polite"
      >
        {enEspera
          ? `Listo para sacar ${etiquetaPaso(efectivo.paso)}`
          : girando
            ? `Sacando ${etiquetaPaso(efectivo.paso)}…`
            : termino
              ? "¡Sorteo terminado!"
              : actual?.premio
                ? `${formatNumero(actual.numero, ancho)} → ${actual.mayor ? "¡GANADOR! " : ""}${actual.premio}`
                : `${formatNumero(actual?.numero ?? min, ancho)} — no válido, sigue el sorteo`}
      </p>

      {/* Control del organizador: una pulsada por balota */}
      {manual && !termino && (
        <button
          type="button"
          disabled={girando}
          onClick={avanzar}
          className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold shadow-lg disabled:opacity-60"
          style={{ background: C.accent, color: C.accentInk }}
        >
          {girando ? (
            <>
              <Dices className="size-4 animate-spin" /> Girando…
            </>
          ) : efectivo.fase === "espera" ? (
            <>
              <Dices className="size-4" />
              {efectivo.paso === 0
                ? "GIRAR"
                : dosRondas && efectivo.paso === corte
                  ? "Sortear el ganador"
                  : `Sacar ${etiquetaPaso(efectivo.paso)}`}
            </>
          ) : (
            <>
              <ChevronRight className="size-4" />
              {efectivo.paso + 1 < totalBolas
                ? dosRondas && efectivo.paso + 1 === corte
                  ? "Pasar a la ronda final"
                  : "Siguiente balota"
                : "Cerrar el sorteo"}
            </>
          )}
        </button>
      )}

      {/* Balotas que ya salieron, en orden. Con dos rondas se separan para que
          se entienda que las finalistas no ganan por sí solas. */}
      {dosRondas ? (
        <div className="flex w-full flex-col gap-3">
          <Tanda titulo={`Finalistas (${corte})`}>{tramo(0, corte)}</Tanda>
          <Tanda titulo={`Sorteo final (${totalBolas - corte})`}>
            {tramo(corte, totalBolas)}
          </Tanda>
        </div>
      ) : (
        <ol className="flex w-full flex-wrap justify-center gap-2">{tramo(0, totalBolas)}</ol>
      )}

      {termino && !espectador && (
        <button
          type="button"
          onClick={() => setEstado({ paso: 0, fase: manual ? "espera" : "girando" })}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: C.accent }}
        >
          <RotateCcw className="size-3.5" /> Ver el sorteo otra vez
        </button>
      )}
    </div>
  );

  function tramo(desde: number, hasta: number) {
    return Array.from({ length: Math.max(0, hasta - desde) }, (_, k) => {
          const i = desde + k;
          const b = bolas[i];
          const visible =
            !!b && (i < efectivo.paso || (i === efectivo.paso && !girando && !enEspera));
          return (
            <li
              key={i}
              className="flex min-w-24 flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-opacity"
              style={{
                opacity: visible ? 1 : 0.35,
                borderColor: visible && b.mayor ? C.accent : C.line,
                background: visible && b.mayor ? velo(C.accent, 12) : "transparent",
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: C.muted }}
              >
                {dosRondas
                  ? i < corte
                    ? `Finalista ${i + 1}`
                    : `Ganadora ${i - corte + 1}`
                  : `${i + 1}ª balota`}
              </span>
              <span
                key={visible ? "cantada" : "pendiente"}
                className={
                  "flex size-10 items-center justify-center rounded-full text-base font-black tabular-nums " +
                  (visible ? "animate-bola-sale" : "border border-dashed")
                }
                style={
                  visible
                    ? {
                        background: b.mayor ? C.accent : C.neutro,
                        color: b.mayor ? C.accentInk : C.texto,
                      }
                    : { borderColor: C.line, color: C.muted }
                }
              >
                {visible ? formatNumero(b.numero, ancho) : "?"}
              </span>
              {visible && (
                <>
                  <span
                    className="flex items-center gap-1 text-center text-[11px] font-semibold"
                    style={b.premio ? undefined : { color: C.muted }}
                  >
                    {b.mayor && <Trophy className="size-3" style={{ color: C.accent }} />}
                    {b.premio ?? "No válido"}
                  </span>
                  {b.nombre && (
                    <span className="text-center text-[11px]" style={{ color: C.muted }}>
                      {b.nombre}
                    </span>
                  )}
                </>
              )}
            </li>
          );
    });
  }
}

/** Una ronda del sorteo, con su título. */
function Tanda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: C.muted }}
      >
        {titulo}
      </p>
      <ol className="flex flex-wrap justify-center gap-2">{children}</ol>
    </div>
  );
}
