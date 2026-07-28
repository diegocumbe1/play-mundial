import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

import { formatCOP } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type { AlertaTorneo, DashboardTorneo } from "@/types";

/**
 * Indicadores del torneo. El orden responde a lo que el organizador pregunta:
 * ¿cuántos equipos tengo?, ¿cuánto entró?, ¿cuánto me cuesta?, ¿gano o pierdo?
 */
export function ResumenTorneo({ dash }: { dash: DashboardTorneo }) {
  const utilidadOk = dash.utilidadProyectada >= 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Equipos"
          value={`${dash.equiposRegistrados}/${dash.cupoTotal}`}
          sub={`${dash.equiposConfirmados} confirmados · ${dash.equiposPendientes} pendientes`}
        />
        <Stat
          label="Cupos disponibles"
          value={String(dash.cuposDisponibles)}
          sub={`${dash.pctOcupacion}% de ocupación`}
        />
        <Stat
          label="Recaudado"
          value={formatCOP(dash.ingresosRecaudados)}
          sub={`de ${formatCOP(dash.ingresosProyectados)} proyectados`}
        />
        <Stat
          label="Por cobrar"
          value={formatCOP(dash.porCobrar)}
          sub={`${dash.pctRecaudado}% recaudado`}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Gastos"
          value={formatCOP(dash.gastosProyectados)}
          sub={`${formatCOP(dash.gastosPagados)} pagados`}
        />
        <Stat
          label="Utilidad proyectada"
          value={formatCOP(dash.utilidadProyectada)}
          sub="con el cupo lleno"
          tono={utilidadOk ? "bueno" : "malo"}
        />
        <Stat
          label="Utilidad actual"
          value={formatCOP(dash.utilidadActual)}
          sub="recaudado − pagado"
          tono={dash.utilidadActual >= 0 ? "bueno" : "malo"}
        />
        <Stat
          label="Punto de equilibrio"
          value={
            dash.puntoEquilibrioEquipos === null
              ? "—"
              : `${dash.puntoEquilibrioEquipos} equipos`
          }
          sub={
            dash.puntoEquilibrioEquipos === null
              ? "Define un valor de inscripción"
              : `${formatCOP(dash.utilidadPorEquipoConfirmado)} por equipo confirmado`
          }
        />
      </section>
    </div>
  );
}

/** Alertas de viabilidad en lenguaje del organizador. */
export function AlertasTorneo({ alertas }: { alertas: AlertaTorneo[] }) {
  if (alertas.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {alertas.map((a, i) => {
        const Icon =
          a.nivel === "error" ? TriangleAlert : a.nivel === "alerta" ? AlertTriangle : Info;
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 text-sm",
              a.nivel === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
              a.nivel === "alerta" &&
                "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              a.nivel === "info" && "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span>{a.mensaje}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label,
  value,
  sub,
  tono,
}: {
  label: string;
  value: string;
  sub?: string;
  tono?: "bueno" | "malo";
}) {
  return (
    <div className="border-border rounded-2xl border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-lg font-bold",
          tono === "bueno" && "text-emerald-600 dark:text-emerald-400",
          tono === "malo" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>}
    </div>
  );
}
