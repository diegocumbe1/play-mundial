"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";

import {
  eliminarSuscripcion,
  enviarPruebaPush,
  guardarSuscripcion,
} from "@/actions/push";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Botón para que el admin active/desactive las notificaciones push. */
export function NotificacionesToggle() {
  const [cap, setCap] = useState({ soportado: false, iosSinInstalar: false });
  const [suscrito, setSuscrito] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de capacidades al montar (necesita window/navigator)
    setCap({ soportado: ok, iosSinInstalar: iOS && !standalone });

    if (ok) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSuscrito(!!sub))
        .catch(() => {});
    }
  }, []);

  async function activar() {
    setCargando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        toast.error("Permiso de notificaciones denegado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });
      const json = JSON.parse(JSON.stringify(sub)) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await guardarSuscripcion({
        endpoint: json.endpoint,
        keys: json.keys,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSuscrito(true);
      await enviarPruebaPush();
      toast.success("Notificaciones activadas");
    } catch {
      toast.error("No se pudo activar las notificaciones");
    } finally {
      setCargando(false);
    }
  }

  async function desactivar() {
    setCargando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await eliminarSuscripcion(sub.endpoint);
        await sub.unsubscribe();
      }
      setSuscrito(false);
      toast.success("Notificaciones desactivadas");
    } catch {
      toast.error("No se pudo desactivar");
    } finally {
      setCargando(false);
    }
  }

  if (cap.iosSinInstalar) {
    return (
      <span className="text-polla-muted max-w-44 text-xs">
        Para notificaciones: Compartir → “Agregar a inicio”.
      </span>
    );
  }
  if (!cap.soportado) return null;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={cargando}
      onClick={suscrito ? desactivar : activar}
    >
      {suscrito ? <BellRing /> : <Bell />}
      {suscrito ? "Notificaciones on" : "Activar notificaciones"}
    </Button>
  );
}
