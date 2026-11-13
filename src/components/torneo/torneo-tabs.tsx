"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Circle,
  ListChecks,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

import { ConfigTorneoPanel } from "@/components/torneo/config-torneo-panel";
import { EquiposPanel } from "@/components/torneo/equipos-panel";
import { FixturePanel } from "@/components/torneo/fixture-panel";
import { GastosPanel } from "@/components/torneo/gastos-panel";
import { AlertasTorneo, CoberturaPremios, ResumenTorneo } from "@/components/torneo/resumen-torneo";
import { IngresosPanel } from "@/components/torneo/ingresos-panel";
import { PatrocinadoresPanel } from "@/components/torneo/patrocinadores-panel";
import { DatoInfo } from "@/components/torneo/dato-info";
import {
  calcularCifrasTorneo,
  calcularCoberturaTorneo,
  formatCOP,
  recaudoPorMetodo,
  textoDesglose,
  type CifrasTorneo,
} from "@/lib/torneos";
import type { PasoConfiguracion, ReglasTorneo } from "@/lib/torneo-reglas";
import { cn } from "@/lib/utils";
import type {
  AlertaTorneo,
  CategoriaTorneo,
  DashboardTorneo,
  Encuentro,
  JugadorTorneo,
  PagoEquipoTorneo,
  EquipoTorneo,
  GastoTorneo,
  IngresoTorneo,
  PatrocinadorTorneo,
  PremioTorneo,
  Torneo,
} from "@/types";

type Pestana = "resumen" | "equipos" | "reglas" | "fixture" | "finanzas" | "configuracion";

/** A qué pestaña (o ruta) lleva cada paso de la guía. */
const DESTINO_PASO: Record<string, Pestana | "editar" | null> = {
  datos: "editar",
  categorias: "reglas",
  reglas: "reglas",
  reglamento: "reglas",
  cobro: "configuracion",
  publicar: null,
};

/** Navegación del detalle del torneo. */
export function TorneoTabs({
  torneo,
  equipos,
  gastos,
  ingresos,
  patrocinadores,
  patrociniosHabilitados = false,
  dashboard,
  alertas,
  categorias,
  premios,
  encuentros,
  pagos,
  jugadores,
  reglas,
  pasos,
  marcadorDisponible = false,
  configuracion,
  partidoInicial,
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  gastos: GastoTorneo[];
  ingresos: IngresoTorneo[];
  patrocinadores: PatrocinadorTorneo[];
  /** El superadmin habilitó los patrocinadores a este organizador. */
  patrociniosHabilitados?: boolean;
  dashboard: DashboardTorneo;
  alertas: AlertaTorneo[];
  categorias: CategoriaTorneo[];
  premios: PremioTorneo[];
  encuentros: Encuentro[];
  pagos: PagoEquipoTorneo[];
  jugadores: JugadorTorneo[];
  reglas: ReglasTorneo;
  /** dc-sport-score configurado: habilita el marcador del juez. */
  marcadorDisponible?: boolean;
  /** Guía de configuración (qué falta para publicar). */
  pasos: PasoConfiguracion[];
  /** Bloque de configuración renderizado en el servidor (datos de cobro, etc.). */
  configuracion: React.ReactNode;
  /** Partido que se abre al entrar (enlace de una notificación). */
  partidoInicial?: string;
}) {
  const [pestana, setPestana] = useState<Pestana>(partidoInicial ? "fixture" : "resumen");
  // Mismas cifras en Resumen y Finanzas.
  const cifras = calcularCifrasTorneo(torneo, categorias, equipos, gastos, premios, ingresos);

  // `corto`: lo que se lee en celular (las pestañas se desplazan de lado).
  const tabs: {
    id: Pestana;
    label: string;
    corto: string;
    icon: typeof BarChart3;
  }[] = [
    { id: "resumen", label: "Resumen", corto: "Resumen", icon: BarChart3 },
    { id: "equipos", label: "Equipos", corto: "Equipos", icon: Users },
    {
      id: "reglas",
      label: "Categorías y reglas",
      corto: "Reglas",
      icon: ListChecks,
    },
    {
      id: "fixture",
      label: "Partidos y resultados",
      corto: "Partidos",
      icon: CalendarRange,
    },
    { id: "finanzas", label: "Finanzas", corto: "Finanzas", icon: Wallet },
    {
      id: "configuracion",
      label: "Configuración",
      corto: "Ajustes",
      icon: Settings,
    },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label="Secciones del torneo"
        // Fijas arriba al hacer scroll: en celular se cambia de sección sin volver a subir.
        className="border-border bg-polla-dark/95 sticky top-0 z-20 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b px-4 pb-px backdrop-blur [scrollbar-width:none] sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const activo = pestana === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={activo}
              onClick={() => setPestana(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activo
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Icon className="size-3.5" />
              <span className="sm:hidden">{t.corto}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {pestana === "resumen" && (
        <div className="flex flex-col gap-5">
          {pasos.some((p) => !p.hecho) && (
            <GuiaConfiguracion
              torneoId={torneo.id}
              pasos={pasos}
              onIr={(destino) => setPestana(destino)}
            />
          )}
          <ResumenTorneo dash={dashboard} cifras={cifras} />
          <AlertasTorneo alertas={alertas} />
          <CoberturaPremios
            cobertura={calcularCoberturaTorneo(
              torneo,
              categorias,
              equipos,
              gastos,
              premios,
              ingresos,
            )}
          />
        </div>
      )}

      {pestana === "equipos" && (
        <EquiposPanel
          torneo={torneo}
          equipos={equipos}
          categorias={categorias}
          pagos={pagos}
          jugadores={jugadores}
          participacion={reglas.participacion}
          encuentros={encuentros}
          tablaReglas={reglas.tabla}
          nombresCanchas={reglas.juego.nombres_canchas}
        />
      )}

      {pestana === "fixture" && (
        <div className="flex flex-col gap-5">
          <FixturePanel
            torneo={torneo}
            categorias={categorias}
            equipos={equipos}
            encuentros={encuentros}
            reglas={reglas}
            marcadorDisponible={marcadorDisponible}
            partidoInicial={partidoInicial}
          />
        </div>
      )}

      {pestana === "reglas" && (
        <ConfigTorneoPanel
          torneo={torneo}
          categorias={categorias}
          premios={premios}
          reglasIniciales={reglas}
        />
      )}

      {pestana === "finanzas" && (
        <div className="flex flex-col gap-5">
          <ResumenFinanzas cifras={cifras} />
          <CajaTorneo pagos={pagos} equipos={equipos} porCobrar={dashboard.porCobrar} />
          <IngresosPanel
            torneo={torneo}
            ingresos={ingresos}
            equipos={equipos}
            patrocinadores={patrocinadores}
          />
          <GastosPanel
            torneoId={torneo.id}
            gastos={gastos}
            categorias={categorias}
            equipos={equipos}
          />
          {patrociniosHabilitados && (
            <PatrocinadoresPanel
              torneoId={torneo.id}
              slug={torneo.slug_publico}
              patrocinadores={patrocinadores}
              mostrar={torneo.mostrar_patrocinadores !== false}
            />
          )}
        </div>
      )}

      {pestana === "configuracion" && configuracion}
    </>
  );
}

/**
 * Lo real primero (ingresado, gastado y utilidad de eso) y debajo lo previsto con
 * los equipos inscritos. Cada tarjeta explica de dónde sale su cifra (ⓘ).
 */
function ResumenFinanzas({
  cifras: c,
}: {
  cifras: CifrasTorneo;
}) {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Hasta hoy (dinero real)</p>
        <div className="grid grid-cols-3 gap-3">
          <Dato
            label="Ingresado"
            valor={formatCOP(c.ingresado)}
            info={
              <>
                {plural(c.equiposQuePagaron, "equipo ha pagado", "equipos han pagado")} algo (
                {formatCOP(c.abonos)})
                {c.otrosRecibidos > 0 ? ` + ${formatCOP(c.otrosRecibidos)} de otros ingresos ya recibidos` : ""}.
                Solo cuenta lo que ya entró.
              </>
            }
          />
          <Dato
            label="Gastado"
            valor={formatCOP(c.gastado)}
            info={
              <>
                {plural(c.gastosPagadosN, "gasto marcado como pagado", "gastos marcados como pagados")}.
                {c.gastosPorPagarN > 0 ? ` Faltan ${plural(c.gastosPorPagarN, "gasto", "gastos")} por pagar.` : ""}
              </>
            }
          />
          <Dato
            label="Utilidad"
            valor={formatCOP(c.utilidadReal)}
            tono={c.utilidadReal >= 0 ? "bueno" : "malo"}
            info={
              <>
                Ingresado {formatCOP(c.ingresado)} − Gastado {formatCOP(c.gastado)} ={" "}
                <b>{formatCOP(c.utilidadReal)}</b>. Es lo que llevas hoy, sin contar lo pendiente.
              </>
            }
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
          Si se cobra y se paga todo lo de hoy ({plural(c.inscritos, "equipo inscrito", "equipos inscritos")}, no
          el cupo)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Dato
            label="Ingresos previstos"
            valor={formatCOP(c.ingresosPrevistos)}
            info={
              <>
                {plural(c.inscritos, "equipo inscrito paga", "equipos inscritos pagan")}{" "}
                {formatCOP(c.inscripcionesPrevistas)}
                {c.otrosIngresos > 0 ? ` + ${formatCOP(c.otrosIngresos)} de otros ingresos` : ""}. Ya pagaron{" "}
                {formatCOP(c.abonos)} y faltan {formatCOP(c.porCobrar)} por cobrar. Los cupos libres no se cuentan.
              </>
            }
          />
          <Dato
            label="Gastos previstos"
            valor={formatCOP(c.gastosPrevistos)}
            info={
              <>
                Todos los gastos registrados (pagados y por pagar):{" "}
                {c.gastosIncluidos.length === 0
                  ? "ninguno todavía"
                  : c.gastosIncluidos.map(textoDesglose).join(" · ")}
                .
                {c.gastosExcluidos.length > 0 &&
                  ` No incluye ${c.gastosExcluidos.map(textoDesglose).join(" · ")} porque esa categoría aún no tiene equipos inscritos.`}
              </>
            }
          />
          <Dato
            label="Utilidad prevista"
            valor={formatCOP(c.utilidadPrevista)}
            tono={c.utilidadPrevista >= 0 ? "bueno" : "malo"}
            info={
              <>
                Ingresos previstos {formatCOP(c.ingresosPrevistos)} − Gastos previstos {formatCOP(c.gastosPrevistos)} ={" "}
                <b>{formatCOP(c.utilidadPrevista)}</b>.{" "}
                {c.utilidadPrevista >= 0
                  ? "Si todos pagan y se pagan todos los gastos, el torneo deja utilidad."
                  : "Con los equipos de hoy no alcanza: faltan inscripciones o hay que bajar gastos."}
              </>
            }
          />
        </div>
      </div>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p>
          <b>Gastos previstos incluyen:</b>{" "}
          {c.gastosIncluidos.length === 0
            ? "nada todavía."
            : c.gastosIncluidos.map(textoDesglose).join(" · ")}
        </p>
        {c.gastosExcluidos.length > 0 && (
          <p>
            <b>No incluyen (aún sin equipos inscritos):</b>{" "}
            {c.gastosExcluidos.map(textoDesglose).join(" · ")}. Se suman cuando se
            inscriba el primer equipo de esa categoría.
          </p>
        )}
      </div>
    </section>
  );
}

function Dato({
  label,
  valor,
  tono,
  info,
}: {
  label: string;
  valor: string;
  tono?: "bueno" | "malo";
  info?: React.ReactNode;
}) {
  return <DatoInfo label={label} valor={valor} tono={tono} info={info} />;
}

/** Lista de pasos de los primeros 10 minutos: qué falta y a dónde ir. */
function GuiaConfiguracion({
  torneoId,
  pasos,
  onIr,
}: {
  torneoId: string;
  pasos: PasoConfiguracion[];
  onIr: (destino: Pestana) => void;
}) {
  const hechos = pasos.filter((p) => p.hecho).length;
  return (
    <section className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Configura tu torneo en 10 minutos</p>
        <span className="text-muted-foreground text-xs">
          {hechos} de {pasos.length}
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {pasos.map((paso) => {
          const destino = DESTINO_PASO[paso.id];
          const contenido = (
            <>
              {paso.hecho ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}
              <span className="min-w-0 text-left">
                <span
                  className={cn(
                    "block text-sm",
                    paso.hecho && "text-muted-foreground line-through",
                  )}
                >
                  {paso.titulo}
                </span>
                {!paso.hecho && (
                  <span className="text-muted-foreground block text-xs">{paso.ayuda}</span>
                )}
              </span>
            </>
          );
          const clase = "hover:bg-muted/50 flex w-full items-start gap-2 rounded-lg px-2 py-1.5";
          if (paso.hecho || destino == null) {
            return (
              <li key={paso.id} className="flex items-start gap-2 px-2 py-1.5">
                {contenido}
              </li>
            );
          }
          return (
            <li key={paso.id}>
              {destino === "editar" ? (
                <Link href={`/admin/torneos/${torneoId}/editar`} className={clase}>
                  {contenido}
                </Link>
              ) : (
                <button type="button" onClick={() => onIr(destino)} className={clase}>
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const FECHA_CAJA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Cuadre de caja: cuánto entró en efectivo y cuánto por transferencia, y la
 * lista de abonos para comparar con el cajón y con el extracto del banco.
 */
function CajaTorneo({
  pagos,
  equipos,
  porCobrar,
}: {
  pagos: PagoEquipoTorneo[];
  equipos: EquipoTorneo[];
  porCobrar: number;
}) {
  const [filtro, setFiltro] = useState<"todos" | "efectivo" | "transferencia">("todos");
  const caja = recaudoPorMetodo(pagos, equipos);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const lista = pagos.filter((p) => filtro === "todos" || p.metodo === filtro);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Dato label="En efectivo" valor={formatCOP(caja.efectivo)} info="Abonos recibidos en efectivo: lo que debe haber en el cajón." />
        <Dato label="Por transferencia" valor={formatCOP(caja.transferencia)} info="Abonos recibidos por transferencia: compáralo con el extracto del banco." />
        <Dato
          label="Por cobrar"
          info="Lo que aún deben los equipos inscritos: lo que les corresponde pagar menos lo que ya abonaron."
          valor={formatCOP(porCobrar)}
          tono={porCobrar > 0 ? "malo" : "bueno"}
        />
      </div>

      <div className="border-border rounded-2xl border p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Abonos <span className="text-muted-foreground font-normal">({lista.length})</span>
          </p>
          <div className="flex gap-1">
            {(["todos", "efectivo", "transferencia"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                  filtro === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Sin abonos registrados.</p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {lista.map((p) => (
              <li
                key={p.id}
                className="border-border flex items-center justify-between gap-2 border-t py-2 text-sm first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{nombre.get(p.equipo_id) ?? "Equipo"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {FECHA_CAJA.format(new Date(p.fecha))} ·{" "}
                    {p.metodo === "efectivo" ? "Efectivo" : "Transferencia"}
                    {p.nota ? ` · ${p.nota}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatCOP(p.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
