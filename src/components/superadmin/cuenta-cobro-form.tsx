"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  actualizarCuentaCobro,
  crearCuentaCobro,
  type TorneoParaCobro,
} from "@/actions/cuentas-cobro";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { Campo, Selector } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fechaLarga, hoyColombia, lineasDe, totalLinea, valorEnLetras } from "@/lib/cuenta-cobro";
import type { CuentaCobro, CuentaCobroConfig } from "@/types";

/** Un concepto en el formulario: todo como texto mientras se escribe. */
interface LineaForm {
  descripcion: string;
  detalle: string;
  cantidad: string;
  valor: string;
}

const rango = (a: string | null, b: string | null) =>
  a && b ? `${fechaLarga(a)} al ${fechaLarga(b)}` : a ? `desde el ${fechaLarga(a)}` : "";

/**
 * Crear o editar una cuenta de cobro. Es un documento independiente: el torneo es
 * opcional y solo adelanta el cliente y el concepto. Al editar, el superadmin puede
 * corregir también los datos que llenó el cliente.
 */
export function CuentaCobroForm({
  torneos,
  config,
  inicial,
}: {
  torneos: TorneoParaCobro[];
  config: CuentaCobroConfig;
  inicial?: CuentaCobro;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const edita = !!inicial;

  const [torneoId, setTorneoId] = useState(inicial?.torneo_id ?? "");
  const [numero, setNumero] = useState(inicial ? String(inicial.numero) : "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyColombia());
  const [fechaLimite, setFechaLimite] = useState(inicial?.fecha_limite ?? "");
  const [clienteNombre, setClienteNombre] = useState(inicial?.cliente_nombre ?? "");
  const [ciudad, setCiudad] = useState(inicial?.cliente_ciudad ?? "");
  const [lineas, setLineas] = useState<LineaForm[]>(
    inicial
      ? lineasDe(inicial).map((l) => ({
          descripcion: l.descripcion,
          detalle: l.detalle ?? "",
          cantidad: String(l.cantidad),
          valor: String(l.valor_unitario),
        }))
      : [{ descripcion: "", detalle: "", cantidad: "1", valor: "" }],
  );
  const [items, setItems] = useState((inicial?.items ?? []).join("\n"));
  const total = lineas.reduce(
    (suma, l) => suma + totalLinea({ cantidad: Number(l.cantidad) || 0, valor_unitario: Number(l.valor) || 0 }),
    0,
  );
  const cambiarLinea = (i: number, parche: Partial<LineaForm>) =>
    setLineas((prev) => prev.map((l, k) => (k === i ? { ...l, ...parche } : l)));
  const [nota, setNota] = useState(inicial?.nota ?? config.nota ?? "");
  const [recibe, setRecibe] = useState(inicial?.recibe_nombre ?? "");
  const [documento, setDocumento] = useState(inicial?.cliente_documento ?? "");
  const [contacto, setContacto] = useState(inicial?.contacto_nombre ?? "");
  const [contactoWa, setContactoWa] = useState(inicial?.contacto_whatsapp ?? "");
  const [eNombre, setENombre] = useState(inicial?.emisor_nombre ?? config.emisor_nombre ?? "");
  const [eDoc, setEDoc] = useState(inicial?.emisor_documento ?? config.emisor_documento ?? "");
  const [eMarca, setEMarca] = useState(inicial?.emisor_marca ?? config.emisor_marca);
  const [eWa, setEWa] = useState(inicial?.emisor_whatsapp ?? config.emisor_whatsapp ?? "");
  const [pLlave, setPLlave] = useState(inicial?.pago_llave ?? config.pago_llave ?? "");
  const [pBanco, setPBanco] = useState(inicial?.pago_banco ?? config.pago_banco ?? "");
  const [pTitular, setPTitular] = useState(inicial?.pago_titular ?? config.pago_titular ?? "");

  /** Al vincular un torneo se adelanta el cliente y el concepto; todo sigue editable. */
  function elegirTorneo(id: string) {
    setTorneoId(id);
    const t = torneos.find((x) => x.id === id);
    if (!t) return;
    if (!clienteNombre) setClienteNombre(t.organizador);
    const fechas = rango(t.fecha_inicio, t.fecha_fin);
    cambiarLinea(0, {
      descripcion: `Uso de la plataforma Play Mundial para el torneo «${t.nombre}»`,
      ...(fechas ? { detalle: fechas } : {}),
    });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      torneo_id: torneoId || null,
      ...(numero ? { numero: Number(numero) } : {}),
      fecha,
      fecha_limite: fechaLimite || null,
      cliente_nombre: clienteNombre,
      cliente_ciudad: ciudad,
      lineas: lineas
        .filter((l) => l.descripcion.trim())
        .map((l) => ({
          descripcion: l.descripcion,
          detalle: l.detalle,
          cantidad: Number(l.cantidad) || 1,
          valor_unitario: Number(l.valor) || 0,
        })),
      items: items.split("\n").map((s) => s.trim()).filter(Boolean),
      nota,
      recibe_nombre: recibe,
      cliente_documento: documento,
      contacto_nombre: contacto,
      contacto_whatsapp: contactoWa,
      emisor_nombre: eNombre,
      emisor_documento: eDoc,
      emisor_marca: eMarca,
      emisor_whatsapp: eWa,
      pago_llave: pLlave,
      pago_banco: pBanco,
      pago_titular: pTitular,
    };
    startTransition(async () => {
      if (inicial) {
        const r = await actualizarCuentaCobro(inicial.id, input);
        if (!r.success) return void toast.error(r.error);
        toast.success("Cuenta de cobro guardada");
        router.refresh();
      } else {
        const r = await crearCuentaCobro(input);
        if (!r.success) return void toast.error(r.error);
        toast.success("Cuenta de cobro creada");
        router.push(`/superadmin/cuentas-cobro/${r.data.id}`);
      }
    });
  }

  const seccion = "border-border flex flex-col gap-3 rounded-xl border p-4";

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      <section className={seccion}>
        <p className="text-sm font-semibold">Documento</p>
        <Campo label="Vincular a un torneo (opcional)" ayuda="Adelanta el cliente y el concepto. La cuenta sigue siendo un documento independiente.">
          <Selector value={torneoId} onChange={elegirTorneo}>
            <option value="">Sin torneo</option>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.organizador}
              </option>
            ))}
          </Selector>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          {edita && (
            <Campo label="N.º">
              <Input inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} />
            </Campo>
          )}
          <Campo label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
          <Campo label="Fecha límite de pago">
            <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          </Campo>
        </div>
      </section>

      <section className={seccion}>
        <p className="text-sm font-semibold">Cliente</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del cliente">
            <Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} required />
          </Campo>
          <Campo label="Ciudad">
            <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
          </Campo>
        </div>
        <p className="text-muted-foreground text-xs">
          NIT o cédula, quién recibe y el contacto los llena el cliente desde su enlace. Aquí puedes
          adelantarlos o corregirlos.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre de quien recibe">
            <Input value={recibe} onChange={(e) => setRecibe(e.target.value)} />
          </Campo>
          <Campo label="NIT o cédula">
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </Campo>
          <Campo label="Nombre de contacto">
            <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </Campo>
          <Campo label="WhatsApp de contacto">
            <Input value={contactoWa} onChange={(e) => setContactoWa(e.target.value)} inputMode="tel" />
          </Campo>
        </div>
      </section>

      <section className={seccion}>
        <p className="text-sm font-semibold">Conceptos y valor</p>
        <div className="flex flex-col gap-3">
          {lineas.map((l, i) => (
            <div key={i} className="bg-muted/30 flex flex-col gap-2 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Campo label={lineas.length > 1 ? `Concepto ${i + 1}` : "Concepto"}>
                    <Input value={l.descripcion} onChange={(e) => cambiarLinea(i, { descripcion: e.target.value })} />
                  </Campo>
                </div>
                {lineas.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="mt-6"
                    aria-label={`Quitar concepto ${i + 1}`}
                    onClick={() => setLineas((prev) => prev.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <Campo label="Detalle (opcional)">
                <Input value={l.detalle} onChange={(e) => cambiarLinea(i, { detalle: e.target.value })} />
              </Campo>
              <div className="grid grid-cols-[5rem_1fr] items-end gap-3">
                <Campo label="Cantidad">
                  <Input
                    inputMode="numeric"
                    value={l.cantidad}
                    onChange={(e) => cambiarLinea(i, { cantidad: e.target.value.replace(/\D/g, "") })}
                  />
                </Campo>
                <Campo
                  label="Valor unitario (COP)"
                  ayuda={
                    Number(l.cantidad) > 1 && l.valor
                      ? `Subtotal: $${totalLinea({ cantidad: Number(l.cantidad), valor_unitario: Number(l.valor) }).toLocaleString("es-CO")}`
                      : undefined
                  }
                >
                  <InputMoneda value={l.valor} onChange={(v) => cambiarLinea(i, { valor: v })} placeholder="130.000" />
                </Campo>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLineas((prev) => [...prev, { descripcion: "", detalle: "", cantidad: "1", valor: "" }])}
          >
            <Plus className="size-3.5" /> Agregar otro concepto
          </Button>
          <p className="text-sm">
            Total: <b>${total.toLocaleString("es-CO")}</b>
            {total > 0 && <span className="text-muted-foreground block text-xs">{valorEnLetras(total)}</span>}
          </p>
        </div>
        <Campo label="Qué incluye (una línea por punto, opcional)">
          <textarea
            value={items}
            onChange={(e) => setItems(e.target.value)}
            rows={4}
            className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm"
          />
        </Campo>
        <Campo label="Nota (opcional)" ayuda="Por ejemplo una nota tributaria. Sale al final del documento.">
          <Input value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </section>

      <section className={seccion}>
        <p className="text-sm font-semibold">Quien cobra y forma de pago</p>
        <p className="text-muted-foreground text-xs">
          Se copia de «Datos de quien cobra» al crear; aquí puedes ajustarlo solo para esta cuenta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Prestador del servicio">
            <Input value={eNombre} onChange={(e) => setENombre(e.target.value)} required />
          </Campo>
          <Campo label="Cédula o NIT">
            <Input value={eDoc} onChange={(e) => setEDoc(e.target.value)} />
          </Campo>
          <Campo label="Marca que firma">
            <Input value={eMarca} onChange={(e) => setEMarca(e.target.value)} />
          </Campo>
          <Campo label="WhatsApp">
            <Input value={eWa} onChange={(e) => setEWa(e.target.value)} inputMode="tel" />
          </Campo>
          <Campo label="Llave Bre-B">
            <Input value={pLlave} onChange={(e) => setPLlave(e.target.value)} placeholder="@alias" />
          </Campo>
          <Campo label="Banco">
            <Input value={pBanco} onChange={(e) => setPBanco(e.target.value)} />
          </Campo>
          <Campo label="Titular">
            <Input value={pTitular} onChange={(e) => setPTitular(e.target.value)} />
          </Campo>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {edita ? "Guardar cambios" : "Crear cuenta de cobro"}
        </Button>
      </div>
    </form>
  );
}
