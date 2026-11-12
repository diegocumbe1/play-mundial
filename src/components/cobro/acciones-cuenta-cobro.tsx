"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Printer, UserPen } from "lucide-react";
import { toast } from "sonner";

import { completarDatosCuenta } from "@/actions/cuentas-cobro";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCOP } from "@/lib/torneos";
import type { EstadoCuentaCobro } from "@/types";

/**
 * Barra del cliente sobre la cuenta de cobro: completar sus datos (una sola vez)
 * e imprimir o guardar como PDF. No sale en la impresión.
 */
export function AccionesCuentaCobro({
  clave,
  estado,
  datosFaltan,
  valor,
  inicial,
}: {
  clave: string;
  estado: EstadoCuentaCobro;
  /** Total que el cliente acepta. */
  valor: number;
  /** Faltan datos del cliente: se le abre el formulario al entrar. */
  datosFaltan: boolean;
  inicial: { recibe_nombre: string; cliente_documento: string; contacto_nombre: string; contacto_whatsapp: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const puedeCompletar = estado === "enviada";
  const [abierto, setAbierto] = useState(puedeCompletar && datosFaltan);
  const [recibe, setRecibe] = useState(inicial.recibe_nombre);
  const [documento, setDocumento] = useState(inicial.cliente_documento);
  const [contacto, setContacto] = useState(inicial.contacto_nombre);
  const [whatsapp, setWhatsapp] = useState(inicial.contacto_whatsapp);
  const [acepto, setAcepto] = useState(false);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await completarDatosCuenta(clave, {
        recibe_nombre: recibe,
        cliente_documento: documento,
        contacto_nombre: contacto,
        contacto_whatsapp: whatsapp,
        acepto,
      });
      if (!r.success) return void toast.error(r.error);
      toast.success("Listo, recibimos tus datos y tu aceptación.");
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="cc-noprint mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2 pt-4">
      <p className="flex items-center gap-2 text-sm text-slate-700">
        {estado === "enviada" && datosFaltan && "Completa tus datos para dejar la cuenta lista."}
        {estado === "enviada" && !datosFaltan && "Revisa la cuenta y completa tus datos."}
        {estado === "datos_completos" && (
          <>
            <CheckCircle2 className="size-4 text-emerald-600" /> Datos recibidos y cuenta aceptada. Ya puedes imprimirla o guardarla en PDF.
          </>
        )}
        {estado === "pagada" && (
          <>
            <CheckCircle2 className="size-4 text-emerald-600" /> Cuenta pagada. Gracias.
          </>
        )}
        {estado === "anulada" && "Esta cuenta de cobro fue anulada."}
      </p>
      <div className="flex flex-wrap gap-2">
        {puedeCompletar && (
          <Button size="sm" onClick={() => setAbierto(true)}>
            <UserPen className="size-3.5" /> {datosFaltan ? "Completar mis datos" : "Editar mis datos"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-100">
          <Printer className="size-3.5" /> Imprimir / Guardar PDF
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Completa tus datos</DialogTitle>
            <DialogDescription>
              Salen en la cuenta de cobro, junto con tu aceptación. Solo puedes enviarlos una vez; si luego hay
              que corregir algo, nos escribes y lo ajustamos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardar} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-recibe">Nombre de quien recibe</Label>
              <Input id="cc-recibe" value={recibe} onChange={(e) => setRecibe(e.target.value)} autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-doc">NIT o cédula</Label>
              <Input id="cc-doc" value={documento} onChange={(e) => setDocumento(e.target.value)} inputMode="text" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-contacto">Nombre de contacto</Label>
              <Input id="cc-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cc-wa">WhatsApp de contacto (opcional)</Label>
              <Input id="cc-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" />
            </div>
            <label className="bg-muted/40 flex items-start gap-2 rounded-lg p-3 text-sm">
              <input
                type="checkbox"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
                className="mt-0.5 size-4 shrink-0"
                required
              />
              <span>
                {recibe.trim() ? <b>{recibe.trim()}</b> : "Yo"}: acepto esta cuenta de cobro por{" "}
                <b>{formatCOP(valor)}</b>. Se guarda la fecha y hora de mi aceptación.
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={pending}>
                Ahora no
              </Button>
              <Button type="submit" disabled={pending || !acepto}>
                Aceptar y guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
