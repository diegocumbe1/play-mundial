import { Check } from "lucide-react";

import { getPlataformaConfig } from "@/lib/tenant-config";
import { formatCOP } from "@/lib/rifa";

export const dynamic = "force-dynamic";

export default async function PreciosPage() {
  const c = await getPlataformaConfig();

  const planes = [
    {
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
    {
      nombre: "Pago por rifa",
      precio: c.precio_rifa_100 > 0 ? formatCOP(c.precio_rifa_100) : "—",
      sub: "por rifa (hasta 100 números)",
      destacado: true,
      bullets: [
        "Rifas ilimitadas (pagas cada una)",
        `Rifas grandes: ${c.precio_rifa_500 > 0 ? formatCOP(c.precio_rifa_500) : "—"} (hasta 500)`,
        "Sin marca de agua",
        "Dashboard financiero completo",
        "Prepago: se activa al confirmar",
      ],
    },
    {
      nombre: "Suscripción",
      precio: c.precio_suscripcion_mes > 0 ? formatCOP(c.precio_suscripcion_mes) : "—",
      sub: "por mes",
      destacado: false,
      bullets: [
        "Rifas ilimitadas todo el mes",
        "Sin marca de agua",
        "Export de imagen en alta",
        "Soporte prioritario",
        "Siempre prepago",
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
            <ul className="mt-4 flex flex-col gap-2">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-8 text-center text-xs">
        Precios en {c.moneda}. El pago es anticipado; el administrador confirma y activa tu rifa.
      </p>
    </div>
  );
}
