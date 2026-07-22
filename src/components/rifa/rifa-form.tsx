"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { actualizarRifa, crearRifa, guardarPremios } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputMoneda } from "@/components/rifa/input-moneda";
import {
  DECORACIONES,
  TEMAS,
  type DecoracionRifa,
  type TemaRifa,
} from "@/lib/temas-rifa";
import type { CriterioPremio, Premio, Rifa, TipoRifa } from "@/types";

interface PremioDraft {
  tipo: "valor" | "producto";
  descripcion: string;
  valor: string;
  cantidad_ganadores: string;
  criterio: CriterioPremio | "";
}

function premioVacio(): PremioDraft {
  return { tipo: "valor", descripcion: "", valor: "", cantidad_ganadores: "1", criterio: "" };
}

/** Formulario de creación/edición de una rifa (con editor de premios). */
export function RifaForm({
  rifa,
  premiosIniciales,
  esSuperadmin = false,
  tenants = [],
}: {
  rifa?: Rifa;
  premiosIniciales?: Premio[];
  /** Si el usuario es superadmin, puede delegar la rifa a otro organizador. */
  esSuperadmin?: boolean;
  tenants?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const esEdicion = !!rifa;

  const [nombre, setNombre] = useState(rifa?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rifa?.descripcion ?? "");
  const [tipo, setTipo] = useState<TipoRifa>(rifa?.tipo ?? "loteria");
  const [precio, setPrecio] = useState(String(rifa?.precio_boleta ?? ""));
  const [cantidad, setCantidad] = useState(String(rifa?.cantidad_numeros ?? "100"));
  const [formato, setFormato] = useState<2 | 3>(rifa?.formato_cifras ?? 2);
  const [soloPagadas, setSoloPagadas] = useState(rifa?.solo_pagadas_juegan ?? true);
  const [loteria, setLoteria] = useState(rifa?.loteria ?? "");
  const [loteriaUrl, setLoteriaUrl] = useState(rifa?.loteria_url ?? "");
  const [fechaLoteria, setFechaLoteria] = useState(rifa?.fecha_loteria ?? "");
  const [modoCifras, setModoCifras] = useState(rifa?.modo_cifras ?? "ultimas_dos");
  const [fechaSorteo, setFechaSorteo] = useState(
    rifa?.fecha_sorteo ? rifa.fecha_sorteo.slice(0, 10) : "",
  );
  const [tema, setTema] = useState<TemaRifa>((rifa?.tema as TemaRifa) ?? "rosa");
  const [decoracion, setDecoracion] = useState<DecoracionRifa>(
    (rifa?.decoracion as DecoracionRifa) ?? "floral",
  );
  const [tenantId, setTenantId] = useState<string>("");

  // Con un solo premio no se vuelve a preguntar por las cifras: se hereda del
  // "Se gana con…" de la rifa.
  const criterioPorDefecto: CriterioPremio =
    modoCifras === "primeras_dos" ? "primeras_2" : "ultimas_2";

  const [premios, setPremios] = useState<PremioDraft[]>(
    premiosIniciales && premiosIniciales.length > 0
      ? premiosIniciales.map((p) => ({
          tipo: p.tipo,
          descripcion: p.descripcion,
          valor: p.valor != null ? String(p.valor) : "",
          cantidad_ganadores: String(p.cantidad_ganadores),
          criterio: p.criterio ?? "",
        }))
      : [premioVacio()],
  );

  function setPremio(i: number, patch: Partial<PremioDraft>) {
    setPremios((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function submit() {
    const input = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      tipo,
      precio_boleta: Number(precio) || 0,
      cantidad_numeros: Number(cantidad) || 0,
      formato_cifras: formato,
      solo_pagadas_juegan: soloPagadas,
      tema,
      decoracion,
      loteria: tipo === "loteria" ? loteria.trim() || null : null,
      loteria_url: tipo === "loteria" ? loteriaUrl.trim() || null : null,
      fecha_loteria: tipo === "loteria" ? fechaLoteria || null : null,
      modo_cifras: tipo === "loteria" ? modoCifras : null,
      fecha_sorteo: fechaSorteo || null,
      tenant_id: tenantId || null,
    };

    const premiosInput = premios
      .filter((p) => p.descripcion.trim())
      .map((p, i) => ({
        tipo: p.tipo,
        descripcion: p.descripcion.trim(),
        valor: p.tipo === "valor" ? Number(p.valor) || 0 : null,
        cantidad_ganadores: Number(p.cantidad_ganadores) || 1,
        criterio:
          tipo === "loteria"
            ? ((premios.length > 1 ? p.criterio : "") || criterioPorDefecto)
            : null,
        orden: i + 1,
      }));

    startTransition(async () => {
      let rifaId: string;
      if (esEdicion) {
        const res = await actualizarRifa(rifa!.id, input);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        rifaId = rifa!.id;
      } else {
        const res = await crearRifa(input);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        rifaId = res.data.id;
      }
      const rp = await guardarPremios(rifaId, premiosInput);
      if (!rp.success) {
        toast.error(rp.error);
        return;
      }
      toast.success(esEdicion ? "Rifa actualizada" : "Rifa creada");
      router.push(`/admin/rifas/${rifaId}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {esSuperadmin && !esEdicion && tenants.length > 0 && (
        <section className="border-border rounded-xl border p-4">
          <Label className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Responsable de la rifa
          </Label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
          >
            <option value="">A mi nombre (superadmin)</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Puedes delegarla a un organizador para que no quede atada a ti.
          </p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la rifa" className="sm:col-span-2">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Súper rifa de solidaridad" />
        </Field>
        <Field label="Descripción (opcional)" className="sm:col-span-2">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Motivo de la rifa" />
        </Field>

        <Field label="Tipo de rifa">
          <Segmented
            value={tipo}
            onChange={(v) => setTipo(v as TipoRifa)}
            options={[
              { value: "loteria", label: "Con lotería" },
              { value: "interna", label: "Sorteo propio" },
            ]}
          />
        </Field>
        <Field label="Precio por número (COP)">
          <InputMoneda value={precio} onChange={setPrecio} placeholder="20.000" />
        </Field>
        <Field label="Cantidad de números">
          <Input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="100" />
          <p className="text-muted-foreground mt-1 text-xs">100 = del 00 al 99.</p>
        </Field>
        <Field label="Cifras del número">
          <Segmented
            value={String(formato)}
            onChange={(v) => setFormato(Number(v) as 2 | 3)}
            options={[
              { value: "2", label: "2 cifras (00–99)" },
              { value: "3", label: "3 cifras (000–999)" },
            ]}
          />
        </Field>
      </section>

      {tipo === "loteria" && (
        <section className="border-border grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <p className="text-muted-foreground sm:col-span-2 text-sm font-medium">Datos de la lotería</p>
          <Field label="Lotería">
            <Input value={loteria} onChange={(e) => setLoteria(e.target.value)} placeholder="Lotería de Manizales" />
          </Field>
          <Field label="Fecha de la lotería">
            <Input type="date" value={fechaLoteria ?? ""} onChange={(e) => setFechaLoteria(e.target.value)} />
          </Field>
          <Field label="Sitio oficial de resultados (opcional)" className="sm:col-span-2">
            <Input
              value={loteriaUrl}
              onChange={(e) => setLoteriaUrl(e.target.value)}
              placeholder="https://loteriademanizales.com/"
              inputMode="url"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Se muestra en tu panel y en la página pública para consultar y compartir el resultado.
            </p>
          </Field>
          <Field label="Se gana con…" className="sm:col-span-2">
            <Segmented
              value={modoCifras ?? "ultimas_dos"}
              onChange={(v) => setModoCifras(v as typeof modoCifras)}
              options={[
                { value: "ultimas_dos", label: "Últimas cifras" },
                { value: "primeras_dos", label: "Primeras cifras" },
                { value: "ambas", label: "Ambas" },
              ]}
            />
          </Field>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha del sorteo (opcional)">
          <Input type="date" value={fechaSorteo} onChange={(e) => setFechaSorteo(e.target.value)} />
        </Field>
        <Field label="¿Quién juega?">
          <Segmented
            value={soloPagadas ? "si" : "no"}
            onChange={(v) => setSoloPagadas(v === "si")}
            options={[
              { value: "si", label: "Solo pagadas" },
              { value: "no", label: "Todas las vendidas" },
            ]}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Recomendado: solo las boletas pagadas entran al sorteo.
          </p>
        </Field>
      </section>

      {/* Tema visual */}
      <section className="flex flex-col gap-2">
        <Label className="text-muted-foreground text-xs font-medium">
          Tema del enlace público y el flyer
        </Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMAS) as TemaRifa[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTema(k)}
              aria-pressed={tema === k}
              className={
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors " +
                (tema === k ? "border-primary ring-primary/30 ring-2" : "border-border hover:bg-muted")
              }
            >
              <span className="size-4 rounded-full" style={{ background: TEMAS[k].chip }} />
              {TEMAS[k].nombre}
            </button>
          ))}
        </div>

        <Label className="text-muted-foreground mt-3 text-xs font-medium">
          Decoración (temática)
        </Label>
        <div className="flex flex-wrap gap-2">
          {DECORACIONES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDecoracion(d.id)}
              aria-pressed={decoracion === d.id}
              title={d.pista}
              className={
                "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors " +
                (decoracion === d.id ? "border-primary ring-primary/30 ring-2" : "border-border hover:bg-muted")
              }
            >
              <span className="text-xs font-medium">{d.nombre}</span>
              <span className="text-muted-foreground text-[10px]">{d.pista}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Premios */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Premios</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setPremios((p) => [...p, premioVacio()])}>
            <Plus className="size-3.5" /> Agregar premio
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {premios.map((p, i) => (
            <div key={i} className="border-border grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
              <Field label={`Premio ${i + 1}`} className="sm:col-span-2">
                <Input
                  value={p.descripcion}
                  onChange={(e) => setPremio(i, { descripcion: e.target.value })}
                  placeholder="Un pollo, chorizos y papas / $1.000.000"
                />
              </Field>
              <Field label="Tipo">
                <Segmented
                  value={p.tipo}
                  onChange={(v) => setPremio(i, { tipo: v as "valor" | "producto" })}
                  options={[
                    { value: "valor", label: "Dinero" },
                    { value: "producto", label: "Producto" },
                  ]}
                />
              </Field>
              {p.tipo === "valor" ? (
                <Field label="Valor (COP)">
                  <InputMoneda value={p.valor} onChange={(v) => setPremio(i, { valor: v })} placeholder="1.000.000" />
                </Field>
              ) : (
                <Field label="Cantidad de ganadores">
                  <Input inputMode="numeric" value={p.cantidad_ganadores} onChange={(e) => setPremio(i, { cantidad_ganadores: e.target.value })} />
                </Field>
              )}
              {/* Con un solo premio se hereda "Se gana con…" de la rifa (no se repite).
                  Al haber varios, sí se elige por premio. */}
              {tipo === "loteria" && premios.length > 1 && (
                <Field label="Gana con" className="sm:col-span-2">
                  <Segmented
                    value={p.criterio || criterioPorDefecto}
                    onChange={(v) => setPremio(i, { criterio: v as CriterioPremio })}
                    options={[
                      { value: "ultimas_2", label: "Últimas 2 cifras" },
                      { value: "primeras_2", label: "Primeras 2 cifras" },
                    ]}
                  />
                </Field>
              )}
              {premios.length > 1 && (
                <div className="sm:col-span-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPremios((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-3.5" /> Quitar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          {esEdicion ? "Guardar cambios" : "Crear rifa"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-muted-foreground mb-1.5 block text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="border-border inline-flex flex-wrap gap-1 rounded-lg border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
            (value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
