"use client";

import { useState } from "react";
import { BarChart3, CalendarRange, Settings, Users, Wallet } from "lucide-react";

import { EquiposPanel } from "@/components/torneo/equipos-panel";
import { GastosPanel } from "@/components/torneo/gastos-panel";
import { AlertasTorneo, ResumenTorneo } from "@/components/torneo/resumen-torneo";
import { formatCOP } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type {
  AlertaTorneo,
  DashboardTorneo,
  EquipoTorneo,
  GastoTorneo,
  Torneo,
} from "@/types";

type Pestana = "resumen" | "equipos" | "finanzas" | "configuracion";

/**
 * Navegación del detalle del torneo. El fixture es la siguiente fase: la
 * pestaña ya existe, visible y deshabilitada, para que se entienda el roadmap.
 */
export function TorneoTabs({
  torneo,
  equipos,
  gastos,
  dashboard,
  alertas,
  configuracion,
}: {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  gastos: GastoTorneo[];
  dashboard: DashboardTorneo;
  alertas: AlertaTorneo[];
  /** Bloque de configuración renderizado en el servidor (datos de cobro, etc.). */
  configuracion: React.ReactNode;
}) {
  const [pestana, setPestana] = useState<Pestana>("resumen");

  const tabs: { id: Pestana; label: string; icon: typeof BarChart3 }[] = [
    { id: "resumen", label: "Resumen", icon: BarChart3 },
    { id: "equipos", label: "Equipos", icon: Users },
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
        <span
          title="Disponible en la próxima fase"
          aria-disabled
          className="text-muted-foreground/60 inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
        >
          <CalendarRange className="size-3.5" />
          Fixture y resultados
          <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
            Próximamente
          </span>
        </span>
      </div>

      {pestana === "resumen" && (
        <div className="flex flex-col gap-5">
          <ResumenTorneo dash={dashboard} />
          <AlertasTorneo alertas={alertas} />
        </div>
      )}

      {pestana === "equipos" && <EquiposPanel torneo={torneo} equipos={equipos} />}

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
