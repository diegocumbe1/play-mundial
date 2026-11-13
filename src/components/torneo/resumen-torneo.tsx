import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

import { DatoInfo } from "@/components/torneo/dato-info";
import { formatCOP, textoDesglose, type CifrasTorneo, type CoberturaTorneo } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type { AlertaTorneo, DashboardTorneo } from "@/types";

/**
 * Indicadores del torneo. El orden responde a lo que el organizador pregunta:
 * ¿cuántos equipos tengo?, ¿cuánto entró?, ¿cuánto me cuesta?, ¿gano o pierdo?
 * Las cifras de dinero son las mismas de Finanzas (equipos inscritos, no el cupo).
 */
export function ResumenTorneo({ dash, cifras: c }: { dash: DashboardTorneo; cifras: CifrasTorneo }) {
  const eq = c.equilibrio;
  const sinDefinir = eq.equiposTotal === null;
  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Equipos"
          value={`${dash.equiposRegistrados}/${dash.cupoTotal}`}
          sub={`${dash.equiposConfirmados} confirmados · ${dash.equiposPendientes} pendientes`}
          info="Equipos inscritos (pendientes + confirmados) sobre el cupo del torneo. No cuenta retirados ni rechazados."
        />
        <Stat
          label="Cupos disponibles"
          value={String(dash.cuposDisponibles)}
          sub={`${dash.pctOcupacion}% de ocupación`}
          info={`Cupo ${dash.cupoTotal} − ${dash.equiposRegistrados} inscritos = ${dash.cuposDisponibles} cupos libres.`}
        />
        <Stat
          label="Recaudado"
          value={formatCOP(c.ingresado)}
          sub={`de ${formatCOP(c.ingresosPrevistos)} previstos`}
          info={`${c.equiposQuePagaron} equipo${c.equiposQuePagaron === 1 ? "" : "s"} con algún abono (${formatCOP(c.abonos)})${c.otrosRecibidos > 0 ? ` + ${formatCOP(c.otrosRecibidos)} de otros ingresos` : ""}. Lo previsto es lo que deben los ${c.inscritos} inscritos, no el cupo.`}
        />
        <Stat
          label="Por cobrar"
          value={formatCOP(c.porCobrar)}
          sub={`${dash.pctRecaudado}% recaudado`}
          info="Lo que aún deben los equipos inscritos: su inscripción menos lo abonado."
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Gastos"
          value={formatCOP(c.gastosPrevistos)}
          sub={`${formatCOP(c.gastado)} pagados`}
          info={
            <>
              Gastos registrados (pagados y por pagar):{" "}
              {c.gastosIncluidos.length === 0
                ? "ninguno"
                : c.gastosIncluidos.map(textoDesglose).join(" · ")}
              .
              {c.gastosExcluidos.length > 0 &&
                ` No incluye ${c.gastosExcluidos.map(textoDesglose).join(" · ")}: esa categoría aún no tiene equipos inscritos.`}
            </>
          }
        />
        <Stat
          label="Utilidad prevista"
          value={formatCOP(c.utilidadPrevista)}
          sub={`con los ${c.inscritos} equipos inscritos`}
          tono={c.utilidadPrevista >= 0 ? "bueno" : "malo"}
          info={
            <>
              Ingresos previstos {formatCOP(c.ingresosPrevistos)} − Gastos {formatCOP(c.gastosPrevistos)} ={" "}
              <b>{formatCOP(c.utilidadPrevista)}</b>. Con el cupo lleno ({dash.cupoTotal} equipos) los ingresos
              serían {formatCOP(c.metaCupoLleno + c.otrosIngresos)}.
            </>
          }
        />
        <Stat
          label="Utilidad actual"
          value={formatCOP(c.utilidadReal)}
          sub="ingresado − gastado"
          tono={c.utilidadReal >= 0 ? "bueno" : "malo"}
          info={
            <>
              Ingresado {formatCOP(c.ingresado)} − Gastado {formatCOP(c.gastado)} ={" "}
              <b>{formatCOP(c.utilidadReal)}</b>. Solo dinero que ya entró y salió.
            </>
          }
        />
        <Stat
          label="Punto de equilibrio"
          value={sinDefinir ? "—" : `${eq.equiposTotal} equipos`}
          sub={sinDefinir ? "Define un valor de inscripción" : `para cubrir premios y gastos (hoy ${c.inscritos})`}
          info={
            <>
              Costos de las categorías con inscritos {formatCOP(eq.costoTotal)}
              {c.otrosIngresos > 0 ? ` − otros ingresos ${formatCOP(c.otrosIngresos)}` : ""}, dividido en el valor
              promedio de inscripción ({formatCOP(Math.round(eq.valorPromedio))}). El detalle por categoría está
              abajo.
            </>
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Punto de equilibrio por categoría</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eq.filas.map((f) => (
            <div
              key={f.categoriaId ?? "torneo"}
              className={cn(
                "rounded-2xl border p-3",
                f.faltan === 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-border",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold">{f.nombre}</p>
                <span className="text-muted-foreground shrink-0 text-xs">{formatCOP(f.valorInscripcion)} c/u</span>
              </div>
              <p className="mt-1 text-sm">
                <b>{f.inscritos}</b> inscritos · premiación {formatCOP(f.costo)}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  f.faltan === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {f.equipos === null
                  ? "Define un valor de inscripción"
                  : f.costo === 0
                    ? "Sin premiación registrada"
                    : f.faltan === 0
                      ? `Ya cubre su premiación (necesita ${f.equipos} equipo${f.equipos === 1 ? "" : "s"})`
                      : `Necesita ${f.equipos} equipos para cubrir su premiación: faltan ${f.faltan}`}
              </p>
            </div>
          ))}
          {eq.generales.costo > 0 && (
            <div className="border-border rounded-2xl border p-3">
              <p className="font-semibold">Gastos generales</p>
              <p className="mt-1 text-sm">{formatCOP(eq.generales.costo)} (arbitraje, cancha…)</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {eq.generales.equipos === null
                  ? "Define un valor de inscripción"
                  : `Los cubren entre todas las categorías: ≈ ${eq.generales.equipos} equipos en total`}
              </p>
            </div>
          )}
        </div>
        {eq.sinInscritos.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Aún sin equipos inscritos, no se consideran: {eq.sinInscritos.join(", ")}. Se suman cuando se inscriba el
            primero.
          </p>
        )}
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
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  tono?: "bueno" | "malo";
  info?: React.ReactNode;
}) {
  return <DatoInfo label={label} valor={value} sub={sub} tono={tono} info={info} grande />;
}
