"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { guardarPagoConfig, subirQrImagen } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TenantPagoConfig } from "@/types";

/** Datos de cobro del tenant (Nequi/Llave/QR/WhatsApp). Requiere Nequi o Llave. */
export function PagoConfigForm({ inicial }: { inicial: TenantPagoConfig | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nequi, setNequi] = useState(inicial?.nequi_llave ?? "");
  const [llave, setLlave] = useState(inicial?.llave ?? "");
  const [titular, setTitular] = useState(inicial?.titular ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [qr, setQr] = useState(inicial?.qr_url ?? "");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.append("file", file);
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
    if (!nequi.trim() && !llave.trim()) {
      toast.error("Indica al menos un medio de pago: Nequi o Llave");
      return;
    }
    startTransition(async () => {
      const r = await guardarPagoConfig({
        nequi_llave: nequi.trim() || null,
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
        <Label className="text-muted-foreground mb-1.5 block text-xs">Nequi (opcional)</Label>
        <Input value={nequi} onChange={(e) => setNequi(e.target.value)} placeholder="300 000 0000" inputMode="tel" />
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Llave / alias Bre-B (opcional)</Label>
        <Input value={llave} onChange={(e) => setLlave(e.target.value)} placeholder="@turifa o correo" />
      </div>
      <p className="text-muted-foreground -mt-1 text-[11px] sm:col-span-2">
        Debes indicar al menos uno (Nequi o Llave). Los dos no son obligatorios.
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
