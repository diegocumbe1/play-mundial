"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { guardarEmailConfig, probarEmail, type EmailConfigVista } from "@/actions/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MARCA } from "@/lib/marca";

/**
 * Correo saliente de la plataforma (Resend).
 *
 * La API key no viaja al navegador: solo llega una pista (`re_…a1b2`). Dejar el
 * campo vacío conserva la que ya está guardada, así se puede cambiar el
 * remitente sin volver a pegarla.
 *
 * El orden de uso es configurar → probar → encender: por eso el envío de prueba
 * funciona aunque el canal esté apagado.
 */
export function EmailConfigForm({ inicial }: { inicial: EmailConfigVista }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState("");
  const [fromEmail, setFromEmail] = useState(inicial.from_email ?? "");
  const [fromNombre, setFromNombre] = useState(inicial.from_nombre ?? "");
  const [replyTo, setReplyTo] = useState(inicial.reply_to ?? "");
  const [activo, setActivo] = useState(inicial.activo);
  const [destinoPrueba, setDestinoPrueba] = useState("");

  function guardar() {
    startTransition(async () => {
      const r = await guardarEmailConfig({
        resend_api_key: key.trim() || undefined,
        from_email: fromEmail.trim(),
        from_nombre: fromNombre.trim() || undefined,
        reply_to: replyTo.trim() || "",
        activo,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setKey("");
      toast.success("Configuración de correo guardada");
      router.refresh();
    });
  }

  function probar() {
    startTransition(async () => {
      const r = await probarEmail(destinoPrueba);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Correo de prueba enviado");
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <div
          className={
            "flex items-start gap-2 rounded-lg border p-3 text-sm " +
            (inicial.estado.listo
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/10")
          }
        >
          {inicial.estado.listo ? (
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 size-4 text-amber-500" />
          )}
          <div>
            <p className="font-medium">
              {inicial.estado.listo ? "Credenciales completas" : "Falta configuración"}
            </p>
            <p className="text-muted-foreground text-xs">
              {inicial.estado.detalle}
              {inicial.estado.listo && !inicial.activo ? " · canal apagado" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="sm:col-span-2">
        <Label className="text-muted-foreground mb-1.5 block text-xs">
          API key de Resend
        </Label>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          type="password"
          autoComplete="off"
          placeholder={inicial.tieneKey ? `Guardada (${inicial.pistaKey}) — escribe una nueva para reemplazarla` : "re_..."}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Se guarda cifrada del lado del servidor y nunca vuelve al navegador. Déjala
          vacía para conservar la actual.
        </p>
      </div>

      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">
          Correo remitente
        </Label>
        <Input
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder="no-responder@tudominio.com"
          inputMode="email"
        />
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">
          Nombre del remitente
        </Label>
        <Input
          value={fromNombre}
          onChange={(e) => setFromNombre(e.target.value)}
          placeholder={MARCA.nombre}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-muted-foreground mb-1.5 block text-xs">
          Reply-to (opcional)
        </Label>
        <Input
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="soporte@tudominio.com"
          inputMode="email"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          El dominio del remitente debe estar verificado en Resend (SPF + DKIM) o los
          correos caen en spam.
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Canal de correo encendido
        </label>
        <p className="text-muted-foreground mt-1 text-xs">
          Apagado, la app no manda correos (la prueba de abajo sí funciona).
        </p>
      </div>

      <div className="sm:col-span-2">
        <Button onClick={guardar} disabled={pending}>
          Guardar configuración de correo
        </Button>
      </div>

      <div className="border-border sm:col-span-2 mt-2 rounded-lg border p-3">
        <p className="mb-2 text-sm font-semibold">Enviar prueba</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={destinoPrueba}
            onChange={(e) => setDestinoPrueba(e.target.value)}
            placeholder="tu@correo.com"
            inputMode="email"
            className="max-w-xs"
          />
          <Button variant="outline" disabled={pending || !destinoPrueba.trim()} onClick={probar}>
            <Send className="size-4" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
