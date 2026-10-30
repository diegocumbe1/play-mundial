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
import { AlertasTorneo, ResumenTorneo } from "@/components/torneo/resumen-torneo";
import { formatCOP, recaudoPorMetodo } from "@/lib/torneos";
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
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  gastos: GastoTorneo[];
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
}) {
  const [pestana, setPestana] = useState<Pestana>("resumen");

  const tabs: { id: Pestana; label: string; icon: typeof BarChart3 }[] = [
    { id: "resumen", label: "Resumen", icon: BarChart3 },
    { id: "equipos", label: "Equipos", icon: Users },
    { id: "reglas", label: "Categorías y reglas", icon: ListChecks },
    { id: "fixture", label: "Fixture y resultados", icon: CalendarRange },
    { id: "finanzas", label: "Finanzas", icon: Wallet },
    { id: "configuracion", label: "Configuración", icon: Settings },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label="Secciones del torneo"
        className="border-border mb-5 flex gap-1 overflow-x-auto border-b pb-px"
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
              {t.label}
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
          <ResumenTorneo dash={dashboard} />
          <AlertasTorneo alertas={alertas} />
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
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato label="Ingresos proyectados" valor={formatCOP(dashboard.ingresosProyectados)} />
            <Dato label="Recaudado" valor={formatCOP(dashboard.ingresosRecaudados)} />
            <Dato label="Gastos presupuestados" valor={formatCOP(dashboard.gastosProyectados)} />
            <Dato
              label="Utilidad proyectada"
              valor={formatCOP(dashboard.utilidadProyectada)}
              tono={dashboard.utilidadProyectada >= 0 ? "bueno" : "malo"}
            />
          </section>
          <CajaTorneo pagos={pagos} equipos={equipos} porCobrar={dashboard.porCobrar} />
          <GastosPanel torneoId={torneo.id} gastos={gastos} />
        </div>
      )}

      {pestana === "configuracion" && configuracion}
    </>
  );
}

function Dato({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono?: "bueno" | "malo";
}) {
  return (
    <div className="border-border rounded-2xl border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-base font-bold",
          tono === "bueno" && "text-emerald-600 dark:text-emerald-400",
          tono === "malo" && "text-destructive",
        )}
      >
        {valor}
      </p>
    </div>
  );
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
                <span className={cn("block text-sm", paso.hecho && "text-muted-foreground line-through")}>
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
        <Dato label="En efectivo" valor={formatCOP(caja.efectivo)} />
        <Dato label="Por transferencia" valor={formatCOP(caja.transferencia)} />
        <Dato
          label="Por cobrar"
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
                  filtro === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
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
