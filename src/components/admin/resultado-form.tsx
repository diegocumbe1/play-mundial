"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { registrarResultado } from "@/actions/partidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Partido } from "@/types";

interface FormValues {
  goles_local?: number;
  goles_visitante?: number;
}

export function ResultadoForm({
  partido,
  compacto = false,
}: {
  partido: Partido;
  compacto?: boolean;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      goles_local: partido.goles_reglamentario_local ?? undefined,
      goles_visitante: partido.goles_reglamentario_visitante ?? undefined,
    },
  });

  async function onSubmit(values: FormValues) {
    if (
      typeof values.goles_local !== "number" ||
      Number.isNaN(values.goles_local) ||
      typeof values.goles_visitante !== "number" ||
      Number.isNaN(values.goles_visitante)
    ) {
      toast.error("Define el marcador reglamentario antes de guardar.");
      return;
    }

    const result = await registrarResultado({
      partido_id: partido.id,
      goles_local: values.goles_local,
      goles_visitante: values.goles_visitante,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Marcador reglamentario guardado");
    router.refresh();
  }

  return (
    <div className="grid gap-1.5">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          type="number"
          min={0}
          className="w-14 text-center"
          aria-label={`Goles ${partido.equipo_local} en tiempo reglamentario`}
          {...register("goles_local", { valueAsNumber: true, min: 0 })}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          min={0}
          className="w-14 text-center"
          aria-label={`Goles ${partido.equipo_visitante} en tiempo reglamentario`}
          {...register("goles_visitante", { valueAsNumber: true, min: 0 })}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 font-semibold whitespace-nowrap"
        >
          {isSubmitting
            ? "…"
            : compacto
              ? "Actualizar reglamentario"
              : "Guardar reglamentario"}
        </Button>
      </form>
      {!compacto && (
        <p className="text-polla-muted text-xs">
          Registrar solo 90&apos; + reposición; no prórroga ni penales.
          {partido.resultado_manual ? " Verificado manualmente." : ""}
        </p>
      )}
      {compacto && partido.resultado_manual && (
        <p className="text-polla-gold text-xs font-semibold">
          Verificado manualmente.
        </p>
      )}
    </div>
  );
}
