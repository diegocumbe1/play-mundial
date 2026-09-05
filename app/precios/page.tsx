import { Check } from "lucide-react";

import { getMembership } from "@/lib/auth";
import { getPlataformaConfig } from "@/lib/tenant-config";
import { formatCOP } from "@/lib/rifa";
import { porcentajeDelRecaudo, precioEscalon } from "@/lib/planes";
import { PlanActionButton } from "@/components/precios/plan-action-button";

export const dynamic = "force-dynamic";

export default async function PreciosPage() {
  const [c, membership] = await Promise.all([getPlataformaConfig(), getMembership()]);

  const porBoleta = c.cobro_rifa_modo !== "escalones";

  // Ejemplos reales con la regla vigente. El porcentaje NO es fijo: cobrar una
  // boleta equivale a 100/N del recaudo, así que se calcula y se muestra tal
  // cual para que el organizador sepa a qué se compromete.
  const ejemplos = [
    { numeros: 30, boleta: 15000 },
    { numeros: 100, boleta: 15000 },
    { numeros: 500, boleta: 10000 },
  ].map((e) => {
    const costo = precioEscalon(c, "rifas", e.numeros, e.boleta);
    const recaudo = e.numeros * e.boleta;
    return {
      ...e,
      recaudo,
      costo,
      pct: porcentajeDelRecaudo(costo, e.numeros, e.boleta),
    };
  });

  const planes = [
    {
      id: "gratis" as const,
      nombre: "Gratis",
      precio: "$0",
      destacado: false,
      bullets: [
        `${c.free_rifas_por_mes} rifa gratis al mes`,
        `Hasta ${c.free_rifas_total} rifas gratis en total`,
        `Máximo ${c.free_max_numeros} números`,
        "Enlace público en tiempo real",
        "Flyer con marca de agua",
      ],
    },
    porBoleta
      ? {
          id: "pago_rifa" as const,
          nombre: "Pago por rifa",
          precio: "1 boleta",
          sub: "lo que vale un puesto de tu rifa",
          destacado: true,
          bullets: [
            "Rifas ilimitadas (pagas cada una)",
            "Si el puesto vale $15.000, la rifa te cuesta $15.000",
            c.cobro_rifa_min > 0 ? `Mínimo ${formatCOP(c.cobro_rifa_min)}` : "",
            c.cobro_rifa_max > 0 ? `Máximo ${formatCOP(c.cobro_rifa_max)}` : "",
            "Sin marca de agua",
            "Pago por transferencia: se activa al confirmar",
          ].filter(Boolean),
        }
      : {
          id: "pago_rifa" as const,
          nombre: "Pago por rifa",
          precio: c.precio_rifa_100 > 0 ? formatCOP(c.precio_rifa_100) : "—",
          sub: "por rifa (hasta 100 números)",
          destacado: true,
          bullets: [
            "Rifas ilimitadas (pagas cada una)",
            `101–500 números: ${c.precio_rifa_500 > 0 ? formatCOP(c.precio_rifa_500) : "—"}`,
            `501–1000 números: ${c.precio_rifa_1000 > 0 ? formatCOP(c.precio_rifa_1000) : "—"}`,
            "Sin marca de agua",
            "Dashboard financiero completo",
            "Pago por transferencia: se activa al confirmar",
          ],
        },
    {
      id: "suscripcion" as const,
      nombre: "Suscripción",
      precio: c.precio_suscripcion_mes > 0 ? formatCOP(c.precio_suscripcion_mes) : "—",
      sub: "por mes",
      destacado: false,
      bullets: [
        "Rifas ilimitadas todo el mes",
        "Sin marca de agua",
        "Export de imagen en alta",
        "Soporte prioritario",
        "Pago mensual por transferencia",
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-balance">Organiza tu rifa y cobra tú</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-lg">
          Sin comisiones por venta. Empieza gratis y paga solo cuando crezcas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {planes.map((p) => (
          <div
            key={p.nombre}
            className={`flex flex-col rounded-2xl border p-5 ${
              p.destacado ? "border-primary ring-primary/30 ring-2" : "border-border"
            }`}
          >
            {p.destacado && (
              <span className="bg-primary text-primary-foreground mb-3 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Recomendado
              </span>
            )}
            <p className="text-sm font-semibold">{p.nombre}</p>
            <p className="mt-1 text-2xl font-bold">{p.precio}</p>
            {p.sub && <p className="text-muted-foreground text-xs">{p.sub}</p>}
            <ul className="mb-5 mt-4 flex flex-col gap-2">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <PlanActionButton
              plan={p.id}
              logueado={Boolean(membership)}
              montoSuscripcion={c.precio_suscripcion_mes}
            />
          </div>
        ))}
      </div>

      {/* Cuentas claras: el costo real y a qué porcentaje del recaudo equivale. */}
      {porBoleta && (
        <section className="border-border mt-8 rounded-2xl border p-5">
          <p className="text-sm font-semibold">Cuánto te cuesta, en plata</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Activar una rifa cuesta lo mismo que uno de sus puestos. Sobre el recaudo
            total eso es cerca del <b>1%</b> en una rifa de 100 números — y menos entre
            más grande sea. Aquí está el cálculo exacto:
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-muted-foreground text-xs uppercase tracking-wide">
                <tr className="border-border border-b">
                  <th className="py-2 text-left font-medium">Rifa</th>
                  <th className="py-2 text-right font-medium">Recaudas</th>
                  <th className="py-2 text-right font-medium">Te cuesta</th>
                  <th className="py-2 text-right font-medium">Equivale a</th>
                </tr>
              </thead>
              <tbody>
                {ejemplos.map((e) => (
                  <tr key={e.numeros} className="border-border/60 border-b last:border-0">
                    <td className="py-2">
                      {e.numeros} números a {formatCOP(e.boleta)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCOP(e.recaudo)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatCOP(e.costo)}
                    </td>
                    <td className="text-muted-foreground py-2 text-right tabular-nums">
                      {e.pct != null ? `${e.pct.toFixed(2)}% del recaudo` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Tus primeras {c.free_rifas_total} rifas (hasta {c.free_max_numeros} números) no
            pagan nada: la capa gratuita se aplica antes que cualquier cobro.
          </p>
        </section>
      )}

      <p className="text-muted-foreground mt-8 text-center text-xs">
        Precios en {c.moneda}. El pago es anticipado; el administrador confirma y activa tu rifa.
      </p>
    </div>
  );
}
