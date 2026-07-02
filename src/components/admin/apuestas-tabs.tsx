"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabId = "enCurso" | "pendientes" | "finalizados";

/**
 * Pestañas para filtrar las apuestas por estado del partido. Las tarjetas se
 * renderizan en el servidor (incluyen los toggles cliente) y se pasan como
 * props; aquí solo alternamos cuál grupo se muestra.
 */
export function ApuestasTabs({
  enCurso,
  pendientes,
  finalizados,
  counts,
  initialTab,
}: {
  enCurso: React.ReactNode;
  pendientes: React.ReactNode;
  finalizados: React.ReactNode;
  counts: Record<TabId, number>;
  initialTab?: TabId;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(
    () =>
      initialTab ??
      (counts.enCurso > 0
        ? "enCurso"
        : counts.pendientes > 0
          ? "pendientes"
          : "finalizados"),
  );

  useEffect(() => {
    if (searchParams.get("focus") !== "apuestas") return;
    document
      .getElementById("apuestas")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [searchParams]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "enCurso", label: "En curso" },
    { id: "pendientes", label: "Pendientes" },
    { id: "finalizados", label: "Finalizados" },
  ];

  const contenido: Record<TabId, React.ReactNode> = {
    enCurso,
    pendientes,
    finalizados,
  };

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.id
                ? "bg-polla-gold text-polla-dark"
                : "bg-polla-surface text-polla-muted ring-polla-line hover:text-white ring-1",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab === t.id ? "bg-black/20" : "bg-white/10",
              )}
            >
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {counts[tab] === 0 ? (
        <div className="bg-polla-surface ring-polla-line rounded-2xl px-6 py-12 text-center ring-1">
          <p className="text-polla-muted">No hay partidos en esta categoría.</p>
        </div>
      ) : (
        <div className="grid gap-3">{contenido[tab]}</div>
      )}
    </>
  );
}
