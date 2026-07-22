import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueletos de carga de la vertical de rifas. Se muestran al instante al
 * navegar (vía `loading.tsx`) para que nunca parezca que la app se quedó
 * congelada — sobre todo en móvil con red lenta.
 */

/** Grilla de números (10 columnas, como el talonario real). */
export function GrillaSkeleton({ celdas = 100 }: { celdas?: number }) {
  return (
    <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
      {Array.from({ length: celdas }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-md" />
      ))}
    </div>
  );
}

/** Lista de rifas del backoffice. */
export function RifasListaSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border-border flex items-center justify-between gap-3 rounded-xl border p-4">
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detalle de una rifa: cabecera, indicadores y grilla. */
export function RifaDetalleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-24" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="border-border mb-6 rounded-2xl border p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-56 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-border flex flex-col gap-2 rounded-xl border p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="border-border rounded-2xl border p-4">
        <Skeleton className="mb-3 h-4 w-20" />
        <GrillaSkeleton />
      </div>
    </div>
  );
}

/** Página pública de una rifa. */
export function RifaPublicaSkeleton() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex flex-col items-center gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="mb-4 h-11 w-full rounded-xl" />
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <GrillaSkeleton />
      <Skeleton className="mt-6 h-28 w-full rounded-xl" />
    </div>
  );
}

/** Hub del panel (tarjetas de módulos). */
export function HubSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-border flex flex-col gap-2 rounded-2xl border p-5">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formulario (crear/editar rifa, ajustes). */
export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={i < 2 ? "sm:col-span-2" : ""}>
            <Skeleton className="mb-1.5 h-3 w-28" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-9 w-36 rounded-lg" />
    </div>
  );
}
