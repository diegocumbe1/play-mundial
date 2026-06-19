"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { DeleteApuestaButton } from "@/components/admin/delete-apuesta-button";
import { PagoToggle } from "@/components/admin/pago-toggle";
import { Input } from "@/components/ui/input";
import { formatFecha } from "@/lib/format";
import type { MetodoPago } from "@/types";

export type ApuestaBusqueda = {
  id: string;
  nombre: string;
  telefono: string | null;
  pagado: boolean;
  metodoPago: MetodoPago | null;
  notaPago: string | null;
  noPago: boolean;
  creada: string;
  marcador: string;
  partido: string;
};

/**
 * Busca apuestas por nombre o teléfono a través de TODOS los partidos, para
 * ver de un vistazo qué apostó cada persona (Diego, Nico, Juan…). Solo muestra
 * resultados cuando hay texto; vacío no estorba a las pestañas de abajo.
 */
export function BuscadorPersonas({
  apuestas,
}: {
  apuestas: ApuestaBusqueda[];
}) {
  const [q, setQ] = useState("");

  const consulta = q.trim().toLowerCase();
  const resultados = consulta
    ? apuestas.filter(
        (a) =>
          a.nombre.toLowerCase().includes(consulta) ||
          (a.telefono ?? "").toLowerCase().includes(consulta),
      )
    : [];

  return (
    <div className="bg-polla-surface ring-polla-line mb-4 rounded-2xl p-4 ring-1">
      <div className="relative">
        <Search className="text-polla-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar persona por nombre o teléfono…"
          className="pl-9"
        />
      </div>

      {consulta && (
        <div className="mt-3">
          {resultados.length === 0 ? (
            <p className="text-polla-muted py-2 text-sm">
              Sin apuestas para “{q}”.
            </p>
          ) : (
            <ul className="divide-polla-line/40 max-h-96 divide-y overflow-y-auto">
              {resultados.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {a.nombre}
                      {a.telefono && (
                        <span className="text-polla-muted font-normal">
                          {" "}
                          · {a.telefono}
                        </span>
                      )}
                    </div>
                    <div className="text-polla-muted truncate text-xs">
                      {a.partido} · {a.marcador} · Creada {formatFecha(a.creada)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PagoToggle
                      id={a.id}
                      pagado={a.pagado}
                      metodoPago={a.metodoPago}
                      notaPago={a.notaPago}
                      noPago={a.noPago}
                    />
                    <DeleteApuestaButton id={a.id} nombre={a.nombre} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
