"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { registrarResultado } from "@/actions/partidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Partido } from "@/types";

interface FormValues {
  goles_local: number;
  goles_visitante: number;
}

export function ResultadoForm({ partido }: { partido: Partido }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      goles_local: partido.goles_local ?? 0,
      goles_visitante: partido.goles_visitante ?? 0,
    },
  });

  async function onSubmit(values: FormValues) {
    const result = await registrarResultado({
      partido_id: partido.id,
      goles_local: values.goles_local,
      goles_visitante: values.goles_visitante,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Resultado guardado");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        className="w-14 text-center"
        aria-label={`Goles ${partido.equipo_local}`}
        {...register("goles_local", { valueAsNumber: true, min: 0 })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="number"
        min={0}
        className="w-14 text-center"
        aria-label={`Goles ${partido.equipo_visitante}`}
        {...register("goles_visitante", { valueAsNumber: true, min: 0 })}
      />
      <Button
        type="submit"
        size="sm"
        disabled={isSubmitting}
        className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 font-semibold"
      >
        {isSubmitting ? "…" : "Guardar"}
      </Button>
    </form>
  );
}
