"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageRefreshButton({
  className,
}: {
  className?: string;
}) {
  const [refreshing, setRefreshing] = useState(false);

  function recargarPagina() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={recargarPagina}
      disabled={refreshing}
      aria-label="Actualizar página"
      title="Actualizar página"
      className={cn(
        "text-polla-muted hover:text-polla-gold disabled:text-polla-muted/50 inline-flex size-9 items-center justify-center rounded-lg transition-colors",
        className,
      )}
    >
      <RefreshCw className={cn("size-5", refreshing && "animate-spin")} />
    </button>
  );
}
