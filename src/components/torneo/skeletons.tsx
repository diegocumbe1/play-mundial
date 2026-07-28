import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueletos de carga de la vertical de torneos (vía `loading.tsx`). Mismo
 * criterio que en rifas: la pantalla nunca se queda en blanco.
 */

/** Lista de torneos del backoffice. */
export function TorneosListaSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <Skeleton className="mb-4 h-8 w-full rounded-lg" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="border-border flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detalle de un torneo: cabecera, pestañas e indicadores. */
export function TorneoDetalleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <Skeleton className="mb-5 h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Formulario de torneo (alta y edición). */
export function TorneoFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-6 h-8 w-52" />
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }, (_, s) => (
          <div key={s} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Página pública del torneo. */
export function TorneoPublicoSkeleton() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Skeleton className="mb-3 h-9 w-4/5" />
      <Skeleton className="mb-6 h-4 w-3/5" />
      <Skeleton className="mb-4 h-28 w-full rounded-2xl" />
      <Skeleton className="mb-3 h-11 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
