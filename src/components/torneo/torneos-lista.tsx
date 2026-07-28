"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { EstadoTorneoBadge } from "@/components/torneo/estado-torneo-badge";
import { Segmentado } from "@/components/torneo/campos";
import { Input } from "@/components/ui/input";
import { formatFechaCO } from "@/lib/fecha-co";
import { formatCOP } from "@/lib/torneos";
import type { EstadoTorneo, Torneo } from "@/types";

type FiltroEstado = "todos" | EstadoTorneo;

/** Métricas rápidas por torneo, calculadas en el servidor. */
export interface ResumenListaTorneo {
  equipos: number;
  ingresosEsperados: number;
  utilidadProyectada: number;
}

/** Lista de torneos con buscador y filtro por estado. */
export function TorneosLista({
  torneos,
  resumenes,
}: {
  torneos: Torneo[];
  resumenes: Record<string, ResumenListaTorneo>;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return torneos.filter((t) => {
      if (estado !== "todos" && t.estado !== estado) return false;
      if (!q) return true;
      return (
        t.nombre.toLowerCase().includes(q) ||
        t.deporte.toLowerCase().includes(q) ||
        (t.ciudad ?? "").toLowerCase().includes(q)
      );
    });
  }, [torneos, texto, estado]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, deporte o ciudad"
            className="pl-8"
          />
        </div>
        <Segmentado
          value={estado}
          onChange={(v) => setEstado(v as FiltroEstado)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "borrador", label: "Borrador" },
            { value: "inscripciones", label: "Inscripciones" },
            { value: "en_curso", label: "En curso" },
            { value: "finalizado", label: "Finalizados" },
          ]}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Ningún torneo coincide con la búsqueda.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((t) => {
            const r = resumenes[t.id];
            const fecha = formatFechaCO(t.fecha_inicio, { conAnio: false });
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/torneos/${t.id}`}
                  className="tap-card border-border hover:border-primary/60 hover:bg-muted/40 flex flex-col gap-2 rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.nombre}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.deporte}
                        {t.modalidad ? ` · ${t.modalidad}` : ""}
                        {t.ciudad ? ` · ${t.ciudad}` : ""}
                        {fecha ? ` · desde el ${fecha}` : ""}
                      </p>
                    </div>
                    <EstadoTorneoBadge estado={t.estado} />
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <b className="text-foreground">
                        {r?.equipos ?? 0}/{t.cupo_equipos}
                      </b>{" "}
                      equipos
                    </span>
                    <span>
                      Ingresos esperados{" "}
                      <b className="text-foreground">
                        {formatCOP(r?.ingresosEsperados ?? 0)}
                      </b>
                    </span>
                    <span>
                      Utilidad proyectada{" "}
                      <b
                        className={
                          (r?.utilidadProyectada ?? 0) >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }
                      >
                        {formatCOP(r?.utilidadProyectada ?? 0)}
                      </b>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
