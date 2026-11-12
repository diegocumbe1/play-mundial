"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { guardarConfigCobro } from "@/actions/cuentas-cobro";
import { Campo } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CuentaCobroConfig } from "@/types";

/** Quién cobra y a dónde pagar por defecto: cada cuenta nueva copia estos datos. */
export function EmisorCobroForm({ inicial }: { inicial: CuentaCobroConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    emisor_nombre: inicial.emisor_nombre ?? "",
    emisor_documento: inicial.emisor_documento ?? "",
    emisor_marca: inicial.emisor_marca,
    emisor_whatsapp: inicial.emisor_whatsapp ?? "",
    pago_llave: inicial.pago_llave ?? "",
    pago_banco: inicial.pago_banco ?? "",
    pago_titular: inicial.pago_titular ?? "",
    nota: inicial.nota ?? "",
    aviso_correo: inicial.aviso_correo ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await guardarConfigCobro(v);
      if (!r.success) return void toast.error(r.error);
      toast.success("Datos guardados. Las cuentas nuevas usarán estos datos.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nombre de quien cobra">
          <Input value={v.emisor_nombre} onChange={set("emisor_nombre")} />
        </Campo>
        <Campo label="Cédula o NIT">
          <Input value={v.emisor_documento} onChange={set("emisor_documento")} />
        </Campo>
        <Campo label="Marca que firma">
          <Input value={v.emisor_marca} onChange={set("emisor_marca")} />
        </Campo>
        <Campo label="WhatsApp">
          <Input value={v.emisor_whatsapp} onChange={set("emisor_whatsapp")} inputMode="tel" />
        </Campo>
        <Campo label="Llave Bre-B">
          <Input value={v.pago_llave} onChange={set("pago_llave")} placeholder="@alias" />
        </Campo>
        <Campo label="Banco">
          <Input value={v.pago_banco} onChange={set("pago_banco")} />
        </Campo>
        <Campo label="Titular">
          <Input value={v.pago_titular} onChange={set("pago_titular")} />
        </Campo>
        <Campo label="Nota por defecto (opcional)" ayuda="Por ejemplo una nota tributaria. Tú decides qué poner.">
          <Input value={v.nota} onChange={set("nota")} />
        </Campo>
        <Campo
          label="Correo para avisos"
          ayuda="Opcional. Solo funciona cuando configures el correo saliente (Resend). Mientras tanto déjalo vacío: el aviso te llega al celular."
        >
          <Input type="email" value={v.aviso_correo} onChange={set("aviso_correo")} placeholder="tucorreo@ejemplo.com" />
        </Campo>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          Guardar datos
        </Button>
      </div>
    </form>
  );
}
