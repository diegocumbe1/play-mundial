"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { actualizarRifa, crearRifa, guardarPremios } from "@/actions/rifas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { ImagenRifaInput } from "@/components/rifa/imagen-rifa-input";
import { SorteoDemo } from "@/components/rifa/sorteo-demo";
import { CalculadoraGanancias } from "@/components/precios/calculadora-ganancias";
import type { ConfigCobroRifa } from "@/lib/cobro-rifa";
import {
  DECORACIONES,
  TEMAS,
  type DecoracionRifa,
  type TemaRifa,
} from "@/lib/temas-rifa";
import {
  formatNumero,
  labelSorteoPropio,
  premiosPorFecha,
  reglasPagoTexto,
} from "@/lib/rifa";
import { TemaPreview } from "@/components/rifa/tema-preview";
import type { CriterioPremio, OrdenSorteo, Premio, Rifa, TipoRifa } from "@/types";

interface PremioDraft {
  tipo: "valor" | "producto";
  descripcion: string;
  valor: string;
  cantidad_ganadores: string;
  criterio: CriterioPremio | "";
  imagen_url: string;
  fecha_loteria: string;
  /** Rifas con abonos: se juega con la cuota mínima (si no, pago completo). */
  con_cuota: boolean;
}

function premioVacio(): PremioDraft {
  return {
    tipo: "valor",
    descripcion: "",
    valor: "",
    cantidad_ganadores: "1",
    criterio: "",
    imagen_url: "",
    fecha_loteria: "",
    con_cuota: false,
  };
}

/** Formulario de creación/edición de una rifa (con editor de premios). */
export function RifaForm({
  rifa,
  premiosIniciales,
  esSuperadmin = false,
  tenants = [],
  cobro,
}: {
  rifa?: Rifa;
  premiosIniciales?: Premio[];
  /** Si el usuario es superadmin, puede delegar la rifa a otro organizador. */
  esSuperadmin?: boolean;
  tenants?: { id: string; nombre: string }[];
  /** Regla de cobro vigente, para la calculadora de ganancias. */
  cobro?: ConfigCobroRifa;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const esEdicion = !!rifa;

  const [nombre, setNombre] = useState(rifa?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rifa?.descripcion ?? "");
  const [tipo, setTipo] = useState<TipoRifa>(rifa?.tipo ?? "loteria");
  const [precio, setPrecio] = useState(String(rifa?.precio_boleta ?? ""));
  const [cantidad, setCantidad] = useState(String(rifa?.cantidad_numeros ?? "100"));
  const [numeroInicial, setNumeroInicial] = useState<0 | 1>(rifa?.numero_inicial === 1 ? 1 : 0);
  const [formato, setFormato] = useState<2 | 3 | 4>(rifa?.formato_cifras ?? 2);
  const [minCompra, setMinCompra] = useState(String(rifa?.min_numeros_compra ?? 1));
  const [calculadora, setCalculadora] = useState(false);
  const [soloPagadas, setSoloPagadas] = useState(rifa?.solo_pagadas_juegan ?? true);
  // Pago por cuotas (opcional).
  const [permiteAbonos, setPermiteAbonos] = useState(rifa?.permite_abonos ?? false);
  const [abonoMinimo, setAbonoMinimo] = useState(
    rifa?.abono_minimo != null ? String(rifa.abono_minimo) : "",
  );
  const [diasLimite, setDiasLimite] = useState(
    rifa?.dias_limite_pago != null ? String(rifa.dias_limite_pago) : "",
  );
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
  const [imagenUrl, setImagenUrl] = useState(rifa?.imagen_url ?? "");
  const [imagenFondoUrl, setImagenFondoUrl] = useState(rifa?.imagen_fondo_url ?? "");
  const [sorteoBolas, setSorteoBolas] = useState(String(rifa?.sorteo_bolas ?? 1));
  const [sorteoGanadores, setSorteoGanadores] = useState(
    String(rifa?.sorteo_ganadores ?? 1),
  );
  const [sorteoOrden, setSorteoOrden] = useState<OrdenSorteo>(
    rifa?.sorteo_orden ?? "ultimo_mayor",
  );
  const [mostrarSimulacion, setMostrarSimulacion] = useState(
    rifa?.mostrar_simulacion ?? true,
  );
  const [tenantId, setTenantId] = useState<string>("");

  // Cuántas balotas salen en cada ronda (la final no puede pedir más de las que
  // clasificaron).
  const bolasNum = Math.min(10, Math.max(1, Number(sorteoBolas) || 1));
  const ganadorasNum = Math.min(bolasNum, Math.max(1, Number(sorteoGanadores) || 1));

  // Rango resultante, para que el owner vea de una qué números tendrá la rifa.
  const cantidadNum = Number(cantidad) || 0;
  const inicio = tipo === "loteria" ? 0 : numeroInicial;
  const ultimo = Math.max(inicio, inicio + cantidadNum - 1);
  const anchoRango = String(ultimo).length;
  const rangoTxt = `${formatNumero(inicio, anchoRango)}–${formatNumero(ultimo, anchoRango)}`;

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
          imagen_url: p.imagen_url ?? "",
          fecha_loteria: p.fecha_loteria ?? "",
          con_cuota: p.minimo_para_jugar != null,
        }))
      : [premioVacio()],
  );
  // Opcional: cada premio se juega con la lotería de su propia fecha.
  const [porFecha, setPorFecha] = useState(premiosPorFecha(premiosIniciales ?? []));
  const sorteoPorFecha = tipo === "loteria" && premios.length > 1 && porFecha;

  function setPremio(i: number, patch: Partial<PremioDraft>) {
    setPremios((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  // Cómo se verán las reglas de pago en el enlace público, con lo que hay ahora.
  const cuotaNum = Number(abonoMinimo) || null;
  const reglasPreview = reglasPagoTexto(
    {
      precio_boleta: Number(precio) || 0,
      solo_pagadas_juegan: soloPagadas,
      permite_abonos: permiteAbonos,
      abono_minimo: cuotaNum,
      dias_limite_pago: diasLimite.trim() !== "" ? Number(diasLimite) || 0 : null,
      fecha_loteria: fechaLoteria || null,
    },
    premios
      .filter((p) => p.descripcion.trim())
      .map((p, i) => ({
        orden: i + 1,
        fecha_loteria: sorteoPorFecha ? p.fecha_loteria || null : null,
        minimo_para_jugar: permiteAbonos && p.con_cuota ? cuotaNum : null,
      })),
  );

  /**
   * Al activar las cuotas: los premios anticipados se juegan con la cuota
   * mínima y el último (el mayor) exige el pago completo. Es el caso típico
   * ("con los $50.000 ya participas en los de $500.000"); se puede cambiar.
   */
  function activarAbonos(si: boolean) {
    setPermiteAbonos(si);
    if (!si || premios.some((p) => p.con_cuota)) return;
    const porFechaOrden = premios
      .map((p, i) => ({ i, f: p.fecha_loteria || "" }))
      .sort((a, b) => a.f.localeCompare(b.f) || a.i - b.i);
    const ultimo = porFechaOrden.at(-1)?.i;
    setPremios((prev) => prev.map((p, i) => ({ ...p, con_cuota: prev.length > 1 && i !== ultimo })));
  }

  function submit() {
    if (soloPagadas && permiteAbonos && !(Number(abonoMinimo) > 0)) {
      toast.error("Indica la cuota mínima para separar con abono");
      return;
    }
    if (sorteoPorFecha && premios.some((p) => p.descripcion.trim() && !p.fecha_loteria)) {
      toast.error("Indica la fecha de lotería de cada premio");
      return;
    }
    // La fecha de la rifa es la del último sorteo (el que la cierra).
    const fechasPremios = premios.map((p) => p.fecha_loteria).filter(Boolean).sort();
    const fechaRifa = sorteoPorFecha ? (fechasPremios.at(-1) ?? null) : fechaLoteria || null;

    const input = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      tipo,
      precio_boleta: Number(precio) || 0,
      cantidad_numeros: Number(cantidad) || 0,
      numero_inicial: tipo === "loteria" ? (0 as const) : numeroInicial,
      formato_cifras: formato,
      min_numeros_compra: Math.min(100, Math.max(1, Number(minCompra) || 1)),
      solo_pagadas_juegan: soloPagadas,
      tema,
      decoracion,
      imagen_url: imagenUrl || null,
      imagen_fondo_url: imagenFondoUrl || null,
      sorteo_bolas: bolasNum,
      sorteo_ganadores: ganadorasNum,
      sorteo_orden: sorteoOrden,
      mostrar_simulacion: mostrarSimulacion,
      loteria: tipo === "loteria" ? loteria.trim() || null : null,
      loteria_url: tipo === "loteria" ? loteriaUrl.trim() || null : null,
      fecha_loteria: tipo === "loteria" ? fechaRifa : null,
      modo_cifras: tipo === "loteria" ? modoCifras : null,
      fecha_sorteo: fechaSorteo || null,
      permite_abonos: soloPagadas && permiteAbonos,
      abono_minimo: soloPagadas && permiteAbonos ? Number(abonoMinimo) || null : null,
      dias_limite_pago:
        soloPagadas && diasLimite.trim() !== ""
          ? Math.min(30, Math.max(0, Number(diasLimite) || 0))
          : null,
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
            ? ((premios.length > 1 && formato !== 4 ? p.criterio : "") || criterioPorDefecto)
            : null,
        orden: i + 1,
        // Solo los productos llevan foto; al pasar a "Dinero" se descarta.
        imagen_url: p.tipo === "producto" ? p.imagen_url || null : null,
        fecha_loteria: sorteoPorFecha ? p.fecha_loteria || null : null,
        minimo_para_jugar:
          soloPagadas && permiteAbonos && p.con_cuota ? Number(abonoMinimo) || null : null,
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
          <p className="text-muted-foreground mt-1 text-xs">
            Hasta 10.000 números. Esta rifa quedaría <b>{rangoTxt}</b>.
          </p>
        </Field>
        <Field label="Mínimo de números por compra">
          <Input inputMode="numeric" value={minCompra} onChange={(e) => setMinCompra(e.target.value.replace(/\D/g, ""))} placeholder="1" />
          <p className="text-muted-foreground mt-1 text-xs">
            1 = sin mínimo. Con números baratos (p. ej. $1.500) pide 10: el comprador los
            elige al azar, seguidos o a mano.
          </p>
        </Field>

        {cobro && (
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCalculadora((v) => !v)}>
              <Calculator className="size-3.5" />
              {calculadora ? "Ocultar calculadora de ganancias" : "Calcular ganancias"}
            </Button>
            {calculadora && (
              <div className="border-border mt-3 rounded-xl border p-4">
                <CalculadoraGanancias
                  config={cobro}
                  cantidadInicial={cantidadNum || 100}
                  preciosIniciales={Number(precio) > 0 ? [Number(precio)] : [1500, 1800]}
                  onUsar={(n, p) => {
                    setCantidad(String(n));
                    setPrecio(String(p));
                    toast.success(`Listo: ${n.toLocaleString("es-CO")} números a $${p.toLocaleString("es-CO")}`);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {tipo === "interna" ? (
          <Field label="¿Desde qué número empieza?">
            <Segmented
              value={String(numeroInicial)}
              onChange={(v) => setNumeroInicial(Number(v) as 0 | 1)}
              options={[
                { value: "0", label: `Desde 0 (${formatNumero(0, anchoRango)}–${formatNumero(Math.max(0, cantidadNum - 1), anchoRango)})` },
                { value: "1", label: `Desde 1 (${formatNumero(1, anchoRango)}–${formatNumero(Math.max(1, cantidadNum), anchoRango)})` },
              ]}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Los talonarios impresos suelen ir del 1 al 30. Puedes cambiarlo después,
              siempre que ningún número ya vendido quede fuera del rango.
            </p>
          </Field>
        ) : (
          <Field label="Cifras del número">
            <Segmented
              value={String(formato)}
              onChange={(v) => {
                const f = Number(v) as 2 | 3 | 4;
                setFormato(f);
                // Con 4 cifras las primeras y las últimas son el mismo número.
                if (f === 4 && modoCifras !== "ultimas_dos") setModoCifras("ultimas_dos");
              }}
              options={[
                { value: "2", label: "2 cifras (00–99)" },
                { value: "3", label: "3 cifras (000–999)" },
                { value: "4", label: "4 cifras (0000–9999)" },
              ]}
            />
            {cantidadNum > 10 ** formato && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Con {formato} cifras solo existen {(10 ** formato).toLocaleString("es-CO")} números
                posibles: sube las cifras o baja la cantidad.
              </p>
            )}
          </Field>
        )}
      </section>

      {/* Cómo se juega (sorteo propio) */}
      {tipo === "interna" && (
        <section className="border-border grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <p className="text-muted-foreground text-sm font-medium sm:col-span-2">Cómo se juega</p>
          <Field label="Balotas finalistas (1ª ronda)">
            <Input
              inputMode="numeric"
              value={sorteoBolas}
              onChange={(e) => setSorteoBolas(e.target.value)}
              placeholder="5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              De 1 a 10. Se sacan de entre todas las boletas que juegan.
            </p>
          </Field>
          <Field label="Ganadoras que salen de esas (2ª ronda)">
            <Input
              inputMode="numeric"
              value={sorteoGanadores}
              onChange={(e) => setSorteoGanadores(e.target.value)}
              placeholder="1"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Opcional: por defecto 1. Se revuelven solo las finalistas y de ahí sale la
              ganadora. Si pones el mismo número que finalistas, no hay segunda ronda y
              cada balota que sale ya lleva su premio.
            </p>
          </Field>
          {ganadorasNum > 1 && (
            <Field label="El premio mayor lo gana…" className="sm:col-span-2">
              <Segmented
                value={sorteoOrden}
                onChange={(v) => setSorteoOrden(v as OrdenSorteo)}
                options={[
                  { value: "ultimo_mayor", label: "La última balota" },
                  { value: "primero_mayor", label: "La primera" },
                ]}
              />
            </Field>
          )}
          <p className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-xs sm:col-span-2">
            🎱 {labelSorteoPropio(bolasNum, ganadorasNum, sorteoOrden)}{" "}
            Se sortea en vivo con una animación tipo baloto que queda guardada para que
            todos vean cómo salió.
          </p>

          <Field label="¿Mostrar la simulación en el enlace público?" className="sm:col-span-2">
            <Segmented
              value={mostrarSimulacion ? "si" : "no"}
              onChange={(v) => setMostrarSimulacion(v === "si")}
              options={[
                { value: "si", label: "Sí, que la vean" },
                { value: "no", label: "No mostrarla" },
              ]}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Explica la mecánica, pero en algunas rifas el comprador cree que ese sorteo
              es el de verdad. Aquí en el panel la tienes siempre.
            </p>
          </Field>

          {/* Preview: así se va a ver el día del sorteo */}
          <div className="sm:col-span-2">
            <SorteoDemo
              bolas={bolasNum}
              ganadores={ganadorasNum}
              orden={sorteoOrden}
              premios={premios.map((p) =>
                p.descripcion.trim() ||
                (p.tipo === "valor" && p.valor ? `$${p.valor}` : ""),
              )}
              min={inicio}
              max={ultimo}
              ancho={anchoRango}
            />
          </div>
        </section>
      )}

      {tipo === "loteria" && (
        <section className="border-border grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <p className="text-muted-foreground sm:col-span-2 text-sm font-medium">Datos de la lotería</p>
          <Field label="Lotería">
            <Input value={loteria} onChange={(e) => setLoteria(e.target.value)} placeholder="Lotería de ..." />
          </Field>
          <Field label="Fecha de la lotería">
            {sorteoPorFecha ? (
              <p className="text-muted-foreground pt-2 text-xs">
                Cada premio juega en su propia fecha (abajo, en Premios).
              </p>
            ) : (
              <Input type="date" value={fechaLoteria ?? ""} onChange={(e) => setFechaLoteria(e.target.value)} />
            )}
          </Field>
          <Field label="Sitio oficial de resultados (opcional)" className="sm:col-span-2">
            <Input
              value={loteriaUrl}
              onChange={(e) => setLoteriaUrl(e.target.value)}
              placeholder="https://loteriade...com/"
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
              options={
                formato === 4
                  ? [{ value: "ultimas_dos", label: "Las 4 cifras del premio mayor" }]
                  : [
                      { value: "ultimas_dos", label: "Últimas cifras" },
                      { value: "primeras_dos", label: "Primeras cifras" },
                      { value: "ambas", label: "Ambas" },
                    ]
              }
            />
            {formato === 4 && (
              <p className="text-muted-foreground mt-1 text-xs">
                Con 4 cifras el número ganador es el resultado completo de la lotería (ej.
                4521), así que no hay primeras y últimas por separado. Escribe en la
                descripción qué pasa si ese número no se vendió.
              </p>
            )}
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

      {/* Reglas de pago (opcionales): cuotas y fecha límite. Se muestran en el
          enlace público tal como aparecen en la vista previa de abajo. */}
      {soloPagadas && (
        <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
          <p className="text-muted-foreground text-sm font-medium">Reglas de pago (opcional)</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={permiteAbonos}
              onChange={(e) => activarAbonos(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Permitir separar con abono y pagar por cuotas</span>
              <span className="text-muted-foreground block text-xs">
                El comprador separa su número con una cuota y abona el resto.
              </span>
            </span>
          </label>
          {permiteAbonos && (
            <div className="flex flex-col gap-3">
              <Field label="Cuota mínima (COP)">
                <InputMoneda value={abonoMinimo} onChange={setAbonoMinimo} placeholder="50.000" />
              </Field>
              {/* Qué exige cada premio para jugarlo */}
              {premios.some((p) => p.descripcion.trim()) && (
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground text-xs font-medium">
                    ¿Con qué juega cada premio?
                  </Label>
                  {premios.map((p, i) =>
                    p.descripcion.trim() ? (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                          {i + 1}° {p.descripcion}
                          {sorteoPorFecha && p.fecha_loteria && (
                            <span className="text-muted-foreground text-xs"> · {p.fecha_loteria.split("-").reverse().join("/")}</span>
                          )}
                        </span>
                        <Segmented
                          value={p.con_cuota ? "cuota" : "completo"}
                          onChange={(v) => setPremio(i, { con_cuota: v === "cuota" })}
                          options={[
                            {
                              value: "cuota",
                              label: cuotaNum ? `Con ${cuotaNum.toLocaleString("es-CO")}` : "Con la cuota",
                            },
                            { value: "completo", label: "Pago completo" },
                          ]}
                        />
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          )}
          <Field label="Fecha límite de pago (opcional)">
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={diasLimite}
                onChange={(e) => setDiasLimite(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="—"
                className="w-20"
              />
              <span className="text-muted-foreground text-xs">
                día(s) antes de cada sorteo (0 = el mismo día; vacío = sin límite)
              </span>
            </div>
          </Field>
          {reglasPreview.length > 0 && (
            <div className="bg-muted/40 rounded-lg p-3 text-xs">
              <p className="text-muted-foreground mb-1 font-medium">Así se verá en el enlace:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {reglasPreview.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Imágenes de la publicación */}
      <section className="border-border grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <p className="text-muted-foreground text-sm font-medium sm:col-span-2">
          Imágenes de la publicación
        </p>
        <ImagenRifaInput
          label="Foto del premio"
          ayuda="Se muestra arriba en la página pública, en el flyer y en la vista previa del enlace."
          valor={imagenUrl}
          onChange={setImagenUrl}
        />
        <ImagenRifaInput
          label="Imagen de fondo"
          ayuda="Va detrás de todo, oscurecida para que el texto se siga leyendo."
          valor={imagenFondoUrl}
          onChange={setImagenFondoUrl}
          aspecto="ancho"
        />
      </section>

      {/* Tema visual + vista previa en vivo */}
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
      <div className="flex flex-col gap-2">
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
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs font-medium">Vista previa</Label>
        <TemaPreview
          tema={tema}
          decoracion={decoracion}
          nombre={nombre}
          imagenFondoUrl={imagenFondoUrl || undefined}
        />
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
        {tipo === "loteria" && premios.length > 1 && (
          <label className="border-border flex items-start gap-2 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              checked={porFecha}
              onChange={(e) => setPorFecha(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Los premios se sortean en fechas distintas</span>
              <span className="text-muted-foreground block text-xs">
                Ej. 1° premio el 19 de noviembre, 2° el 10 de diciembre y el mayor el 24 de
                diciembre. Cada premio se resuelve con el resultado de la lotería de su fecha.
              </span>
            </span>
          </label>
        )}
        <div className="flex flex-col gap-3">
          {premios.map((p, i) => (
            <div key={i} className="border-border grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
              <Field label={`Premio ${i + 1}`} className="sm:col-span-2">
                <Input
                  value={p.descripcion}
                  onChange={(e) => setPremio(i, { descripcion: e.target.value })}
                  placeholder=""
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
                  <InputMoneda value={p.valor} onChange={(v) => setPremio(i, { valor: v })} placeholder="000.000" />
                </Field>
              ) : (
                <Field label="Cantidad de ganadores">
                  <Input inputMode="numeric" value={p.cantidad_ganadores} onChange={(e) => setPremio(i, { cantidad_ganadores: e.target.value })} />
                </Field>
              )}
              {/* Con un solo premio se hereda "Se gana con…" de la rifa (no se repite).
                  Al haber varios, sí se elige por premio. */}
              {tipo === "loteria" && premios.length > 1 && formato !== 4 && (
                <Field label="Gana con" className="sm:col-span-2">
                  <Segmented
                    value={p.criterio || criterioPorDefecto}
                    onChange={(v) => setPremio(i, { criterio: v as CriterioPremio })}
                    options={[
                      { value: "ultimas_2", label: `Últimas ${formato} cifras` },
                      { value: "primeras_2", label: `Primeras ${formato} cifras` },
                    ]}
                  />
                </Field>
              )}
              {sorteoPorFecha && (
                <Field label="Fecha de la lotería de este premio">
                  <Input
                    type="date"
                    value={p.fecha_loteria}
                    onChange={(e) => setPremio(i, { fecha_loteria: e.target.value })}
                  />
                </Field>
              )}
              {p.tipo === "producto" && (
                <div className="sm:col-span-2">
                  <ImagenRifaInput
                    label="Foto del producto"
                    ayuda={
                      premios.length > 1
                        ? "Sale en la tarjeta de este premio en el flyer y en el enlace público."
                        : "Si la rifa no tiene foto de portada, se usa esta."
                    }
                    valor={p.imagen_url}
                    onChange={(url) => setPremio(i, { imagen_url: url })}
                  />
                </div>
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
