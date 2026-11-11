import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

import { formatCOP, type CoberturaTorneo } from "@/lib/torneos";
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
              : `inscritos para cubrir premios y gastos (hoy ${dash.equiposRegistrados})`
          }
        />
      </section>
    </div>
  );
}

/**
 * ¿Los inscritos cubren la premiación? Por categoría (sus premios contra lo que
 * pagan sus equipos) y el total (premios + gastos del torneo).
 */
export function CoberturaPremios({ cobertura }: { cobertura: CoberturaTorneo }) {
  const { categorias, total } = cobertura;
  const variasCategorias = categorias.length > 1 || categorias[0]?.categoriaId !== null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="font-semibold">¿Alcanza para los premios?</p>
        <p className="text-muted-foreground text-xs">
          Con lo que deben pagar los inscritos (pagado o no). «Faltan» es cuántos equipos más
          hacen falta en esa categoría para cubrir su premio en dinero.
        </p>
      </div>

      {variasCategorias && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((c) => {
            const cubre = c.diferencia >= 0;
            return (
              <div
                key={c.categoriaId ?? "torneo"}
                className={cn(
                  "rounded-2xl border p-3",
                  c.premios === 0
                    ? "border-border"
                    : cubre
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatCOP(c.valorInscripcion)} c/u</span>
                </div>
                <p className="mt-1 text-sm">
                  <b>{c.inscritos}</b>/{c.cupo} inscritos
                  <span className="text-muted-foreground text-xs">
                    {" "}· {c.confirmados} confirmados · {c.pendientes} pendientes
                    {c.faltanParaCupo > 0 ? ` · ${c.faltanParaCupo} cupos libres` : " · cupo lleno"}
                  </span>
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">Inscripciones</dt>
                  <dd className="text-right">{formatCOP(c.ingresoInscritos)}</dd>
                  <dt className="text-muted-foreground">Recaudado</dt>
                  <dd className="text-right">{formatCOP(c.recaudado)}</dd>
                  <dt className="text-muted-foreground">Premios en dinero</dt>
                  <dd className="text-right">{formatCOP(c.premios)}</dd>
                </dl>
                <p
                  className={cn(
                    "mt-2 text-sm font-semibold",
                    c.premios === 0 ? "text-muted-foreground" : cubre ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}
                >
                  {c.premios === 0
                    ? "Sin premio en dinero"
                    : cubre
                      ? `Cubre el premio · sobran ${formatCOP(c.diferencia)}`
                      : `No cubre: faltan ${formatCOP(-c.diferencia)}` +
                        (c.equiposParaCubrir !== null ? ` (${c.equiposParaCubrir} equipo${c.equiposParaCubrir === 1 ? "" : "s"})` : "")}
                </p>
                {c.premios > 0 && !cubre && (
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {c.cubreConCupoLleno
                      ? `Con el cupo lleno sí alcanza (${formatCOP(c.ingresoCupoLleno)}).`
                      : `Ni con el cupo lleno alcanza (${formatCOP(c.ingresoCupoLleno)}).`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border p-3",
          total.diferencia >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5",
        )}
      >
        <p className="font-semibold">Total del torneo</p>
        <p className="mt-1 text-sm">
          <b>{total.inscritos}</b>/{total.cupo} inscritos
          <span className="text-muted-foreground text-xs">
            {" "}· {total.confirmados} confirmados · {total.pendientes} pendientes · {total.faltanParaCupo} cupos libres
          </span>
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs sm:max-w-md">
          <dt className="text-muted-foreground">Inscripciones de los inscritos</dt>
          <dd className="text-right">{formatCOP(total.ingresoInscritos)}</dd>
          {total.otrosIngresos > 0 && (
            <>
              <dt className="text-muted-foreground">Otros ingresos (arbitraje, patrocinios…)</dt>
              <dd className="text-right">{formatCOP(total.otrosIngresos)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Premios en dinero</dt>
          <dd className="text-right">
            {formatCOP(total.premios)}
            {total.premiosGenerales > 0 ? ` (${formatCOP(total.premiosGenerales)} generales)` : ""}
          </dd>
          <dt className="text-muted-foreground">Gastos presupuestados</dt>
          <dd className="text-right">{formatCOP(total.gastos)}</dd>
          <dt className="text-muted-foreground">Costo total (premios + gastos)</dt>
          <dd className="text-right font-semibold">{formatCOP(total.costoTotal)}</dd>
        </dl>
        <p
          className={cn(
            "mt-2 text-sm font-semibold",
            total.diferencia >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {total.diferencia >= 0
            ? `Gana: quedan ${formatCOP(total.diferencia)} con los inscritos de hoy`
            : `Pierde: faltan ${formatCOP(-total.diferencia)}` +
              (total.equiposParaEquilibrio !== null ? ` (≈ ${total.equiposParaEquilibrio} equipos más)` : "")}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          Con el cupo lleno entrarían {formatCOP(total.ingresoCupoLleno)}:{" "}
          {total.cubreConCupoLleno ? "alcanza." : "no alcanza ni llenando el cupo."} Los premios ya
          registrados como gasto de premiación no se cuentan dos veces.
        </p>
      </div>
    </section>
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
