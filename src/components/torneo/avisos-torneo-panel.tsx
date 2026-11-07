"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";

import {
  getPreferenciasAvisos,
  guardarAvisos,
  probarAvisos,
  quitarAvisos,
  type PreferenciasAvisos,
} from "@/actions/avisos-torneo";
import { Campo, Selector } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { MINUTOS_RECORDATORIO } from "@/lib/torneo-avisos-reglas";

const POR_DEFECTO: PreferenciasAvisos = {
  minutos_antes: 10,
  partido_nuevo: true,
  en_vivo: true,
  finalizado: true,
  siguiente: true,
};

const OPCIONES: { id: keyof Omit<PreferenciasAvisos, "minutos_antes">; label: string; ayuda: string }[] = [
  { id: "finalizado", label: "Resultado por aprobar y partido finalizado", ayuda: "Te lleva directo a aceptar o corregir lo que reportó el juez." },
  { id: "en_vivo", label: "Partido en vivo", ayuda: "Cuando empieza a marcarse." },
  { id: "siguiente", label: "Siguiente partido", ayuda: "Al terminar uno, cuál sigue, a qué hora y en qué cancha." },
  { id: "partido_nuevo", label: "Partidos nuevos", ayuda: "Cuando se genera el fixture o las eliminatorias." },
];

function aClave(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Notificaciones de torneos en ESTE dispositivo: qué avisar y cuánto antes. */
export function AvisosTorneoPanel() {
  const [cap, setCap] = useState<"cargando" | "no" | "ios" | "bloqueado" | "si">("cargando");
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasAvisos | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (iOS && !instalada) return void setTimeout(() => setCap("ios"));
    if (!soportado) return void setTimeout(() => setCap("no"));
    if (Notification.permission === "denied") return void setTimeout(() => setCap("bloqueado"));

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (actual) => {
        if (actual) {
          const r = await getPreferenciasAvisos(actual.endpoint);
          setSub(actual);
          if (r.success) setPrefs(r.data);
        }
        setCap("si");
      })
      .catch(() => setCap("no"));
  }, []);

  function activar() {
    startTransition(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setCap(permiso === "denied" ? "bloqueado" : "si");
          return void toast.error("No se activaron: falta dar el permiso de notificaciones.");
        }
        const reg = await navigator.serviceWorker.ready;
        const nueva =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: aClave(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
          }));
        const json = nueva.toJSON();
        const r = await guardarAvisos(json, POR_DEFECTO);
        if (!r.success) return void toast.error(r.error);
        setSub(nueva);
        setPrefs(POR_DEFECTO);
        const prueba = await probarAvisos(json);
        if (prueba.success) toast.success("Notificaciones activadas: te enviamos una de prueba.");
        else toast.error(prueba.error);
      } catch {
        toast.error("No se pudieron activar las notificaciones.");
      }
    });
  }

  function cambiar(cambio: Partial<PreferenciasAvisos>) {
    if (!sub || !prefs) return;
    const anterior = prefs;
    const nuevas = { ...prefs, ...cambio };
    setPrefs(nuevas);
    startTransition(async () => {
      const r = await guardarAvisos(sub.toJSON(), nuevas);
      if (!r.success) {
        setPrefs(anterior);
        toast.error(r.error);
      }
    });
  }

  function desactivar() {
    if (!sub) return;
    startTransition(async () => {
      const r = await quitarAvisos(sub.endpoint);
      if (!r.success) return void toast.error(r.error);
      setPrefs(null);
      toast.success("Notificaciones de torneos desactivadas en este dispositivo.");
    });
  }

  function probar() {
    if (!sub) return;
    startTransition(async () => {
      const r = await probarAvisos(sub.toJSON());
      if (r.success) toast.success("Prueba enviada.");
      else toast.error(r.error);
    });
  }

  return (
    <section className="border-border rounded-2xl border p-4">
      <p className="mb-1 text-sm font-semibold">Notificaciones</p>
      <p className="text-muted-foreground mb-3 text-xs">
        Para todos tus torneos, solo en este dispositivo. Actívalas también en cada celular o
        computador donde quieras recibirlas.
      </p>

      {cap === "ios" && (
        <p className="text-sm">
          En iPhone primero instala la app: en Safari toca <b>Compartir → Agregar a inicio</b>, ábrela
          desde ese ícono y vuelve aquí.
        </p>
      )}
      {cap === "no" && <p className="text-sm">Este navegador no permite notificaciones.</p>}
      {cap === "bloqueado" && (
        <p className="text-sm">
          Las notificaciones están bloqueadas para este sitio. Permítelas en los ajustes del navegador
          y recarga la página.
        </p>
      )}

      {cap === "si" && !prefs && (
        <Button onClick={activar} disabled={pending}>
          <Bell className="size-4" /> Activar notificaciones
        </Button>
      )}

      {cap === "si" && prefs && (
        <div className="flex flex-col gap-4">
          <Campo
            label="Recordarme antes de cada partido"
            ayuda="Sale hasta un minuto después de la hora exacta."
          >
            <Selector
              value={String(prefs.minutos_antes)}
              onChange={(v) => cambiar({ minutos_antes: Number(v) })}
            >
              {MINUTOS_RECORDATORIO.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "Sin recordatorio" : `${m} minutos antes`}
                </option>
              ))}
            </Selector>
          </Campo>

          <div className="flex flex-col gap-3">
            {OPCIONES.map((o) => (
              <label key={o.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs[o.id]}
                  onChange={(e) => cambiar({ [o.id]: e.target.checked })}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  {o.label}
                  <span className="text-muted-foreground block text-xs">{o.ayuda}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={probar} disabled={pending}>
              <Send className="size-3.5" /> Enviar prueba
            </Button>
            <Button size="sm" variant="ghost" onClick={desactivar} disabled={pending}>
              <BellOff className="size-3.5" /> Desactivar aquí
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
