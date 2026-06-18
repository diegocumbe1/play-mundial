"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/format";

export type FilaDetalle = {
  /** Texto buscable: "Local vs Visitante". */
  label: string;
  sub?: string;
  /** Monto numérico para sumar el total filtrado. */
  monto: number;
};

/**
 * Tarjeta de métrica que abre un modal con el desglose por partido y un filtro
 * por país/equipo. En modal (no inline) para no romper el grid cuando hay
 * muchos partidos.
 */
export function StatDetalleModal({
  icon,
  valor,
  label,
  titulo,
  filas,
  filtroPlaceholder = "Filtrar por país o equipo…",
  itemLabel = "partido(s)",
}: {
  icon: React.ReactNode;
  valor: React.ReactNode;
  label: string;
  titulo: string;
  filas: FilaDetalle[];
  filtroPlaceholder?: string;
  itemLabel?: string;
}) {
  const [q, setQ] = useState("");

  const consulta = q.trim().toLowerCase();
  const filtradas = consulta
    ? filas.filter(
        (f) =>
          f.label.toLowerCase().includes(consulta) ||
          (f.sub ?? "").toLowerCase().includes(consulta),
      )
    : filas;
  const totalFiltrado = filtradas.reduce((acc, f) => acc + f.monto, 0);

  return (
    <Dialog>
      <DialogTrigger className="bg-polla-surface ring-polla-line hover:ring-polla-gold/50 block w-full rounded-2xl p-5 text-left ring-1 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-polla-elevated text-polla-gold flex size-11 shrink-0 items-center justify-center rounded-xl">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading truncate text-2xl leading-none text-white tabular-nums">
              {valor}
            </div>
            <div className="text-polla-muted mt-1 text-xs font-medium tracking-wide uppercase">
              {label}
            </div>
          </div>
          <span className="text-polla-muted shrink-0 text-[11px] font-medium tracking-wide uppercase">
            Ver
          </span>
        </div>
      </DialogTrigger>

      <DialogContent className="bg-polla-surface ring-polla-line/80 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="text-polla-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={filtroPlaceholder}
            className="pl-9"
          />
        </div>

        <ul className="divide-polla-line/40 max-h-[55vh] divide-y overflow-y-auto">
          {filtradas.length === 0 ? (
            <li className="text-polla-muted py-6 text-center text-sm">
              Sin resultados.
            </li>
          ) : (
            filtradas.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">{f.label}</div>
                  {f.sub && (
                    <div className="text-polla-muted text-xs">{f.sub}</div>
                  )}
                </div>
                <span className="font-heading text-polla-gold shrink-0 tabular-nums">
                  {formatCOP(f.monto)}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="border-polla-line/60 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-polla-muted">
            {filtradas.length} {itemLabel}
          </span>
          <span className="font-heading text-white tabular-nums">
            {formatCOP(totalFiltrado)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
