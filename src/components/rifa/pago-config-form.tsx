"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { guardarPagoConfig, subirQrImagen } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIPOS_CUENTA_PAGO } from "@/lib/pagos";
import { prepararImagen } from "@/lib/imagen";
import type { TenantPagoConfig } from "@/types";

/** Datos de cobro del tenant (cuenta/Llave Bre-B/QR/WhatsApp). */
export function PagoConfigForm({ inicial }: { inicial: TenantPagoConfig | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cuentaInicial = inicial?.cuenta_numero ?? inicial?.nequi_llave ?? "";
  const tipoInicial = inicial?.cuenta_tipo ?? (inicial?.nequi_llave ? "nequi" : "nequi");
  const [cuentaTipo, setCuentaTipo] = useState(tipoInicial);
  const [cuentaOtro, setCuentaOtro] = useState(
    TIPOS_CUENTA_PAGO.some((t) => t.value === tipoInicial) ? "" : tipoInicial,
  );
  const [cuentaNumero, setCuentaNumero] = useState(cuentaInicial);
  const [llave, setLlave] = useState(inicial?.llave ?? "");
  const [titular, setTitular] = useState(inicial?.titular ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [qr, setQr] = useState(inicial?.qr_url ?? "");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    // Un QR no necesita más de 1200px y así no choca con el tope del body.
    const listo = await prepararImagen(file, { ladoMax: 1200 });
    const fd = new FormData();
    fd.append("file", listo);
    const r = await subirQrImagen(fd);
    setSubiendo(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    setQr(r.data.url);
    toast.success("QR subido");
  }

  function guardar() {
    const tipoCuentaFinal = cuentaTipo === "otro" ? cuentaOtro.trim() : cuentaTipo;
    if (!cuentaNumero.trim() && !llave.trim()) {
      toast.error("Indica al menos un medio de pago: cuenta o Llave Bre-B");
      return;
    }
    if (cuentaNumero.trim() && !tipoCuentaFinal) {
      toast.error("Indica la entidad de la cuenta");
      return;
    }
    startTransition(async () => {
      const r = await guardarPagoConfig({
        cuenta_tipo: cuentaNumero.trim() ? tipoCuentaFinal : null,
        cuenta_numero: cuentaNumero.trim() || null,
        llave: llave.trim() || null,
        titular: titular.trim() || null,
        whatsapp: whatsapp.trim() || null,
        qr_url: qr.trim() || null,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Datos de cobro guardados");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Entidad de la cuenta</Label>
        <select
          value={TIPOS_CUENTA_PAGO.some((t) => t.value === cuentaTipo) ? cuentaTipo : "otro"}
          onChange={(e) => setCuentaTipo(e.target.value)}
          className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
        >
          {TIPOS_CUENTA_PAGO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Número / cuenta</Label>
        <Input value={cuentaNumero} onChange={(e) => setCuentaNumero(e.target.value)} placeholder="Cuenta, celular o producto" inputMode="text" />
      </div>
      {(cuentaTipo === "otro" || !TIPOS_CUENTA_PAGO.some((t) => t.value === cuentaTipo)) && (
        <div className="sm:col-span-2">
          <Label className="text-muted-foreground mb-1.5 block text-xs">Especifica la entidad</Label>
          <Input value={cuentaOtro} onChange={(e) => setCuentaOtro(e.target.value)} placeholder="Banco o billetera" />
        </div>
      )}
      <div className="sm:col-span-2">
        <p className="text-muted-foreground -mt-1 text-[11px]">
          Puedes usar cuenta bancaria/billetera y, si aplica, también una Llave Bre-B.
        </p>
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Llave / alias Bre-B (opcional)</Label>
        <Input value={llave} onChange={(e) => setLlave(e.target.value)} placeholder="@turifa o correo" />
      </div>
      <p className="text-muted-foreground -mt-1 text-[11px] sm:col-span-2">
        Debes indicar al menos uno: cuenta o Llave Bre-B. Los dos no son obligatorios.
      </p>

      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Titular</Label>
        <Input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Nombre del titular" />
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">WhatsApp de contacto</Label>
        <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="573000000000" inputMode="tel" />
      </div>

      {/* QR */}
      <div className="sm:col-span-2">
        <Label className="text-muted-foreground mb-1.5 block text-xs">Imagen del QR (opcional)</Label>
        <div className="flex items-center gap-3">
          {qr ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR de pago" width={72} height={72} className="border-border size-[72px] rounded-lg border object-cover" />
              <button
                type="button"
                onClick={() => setQr("")}
                aria-label="Quitar QR"
                className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div className="border-border text-muted-foreground flex size-[72px] items-center justify-center rounded-lg border border-dashed text-xs">
              Sin QR
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
            {subiendo ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}
            {qr ? "Cambiar QR" : "Subir QR"}
          </Button>
        </div>
      </div>

      <div className="sm:col-span-2">
        <Button onClick={guardar} disabled={pending || subiendo}>Guardar datos de cobro</Button>
      </div>
    </div>
  );
}
