"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, Settings2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { crearTorneoDemo, type VarianteDemo } from "@/actions/torneos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OPCIONES: {
  id: VarianteDemo;
  titulo: string;
  detalle: string;
  icono: typeof Sparkles;
}[] = [
  {
    id: "configuracion",
    titulo: "Configuración",
    detalle:
      "El torneo en borrador con categorías, premios, reglas y reglamento. Para mostrar cómo se arma en 10 minutos.",
    icono: Settings2,
  },
  {
    id: "en_juego",
    titulo: "Torneo en juego",
    detalle:
      "30 equipos inscritos con jugadores y pagos, fase de grupos con tabla y partidos en vivo, y página pública activa.",
    icono: Radio,
  },
  {
    id: "finalizado",
    titulo: "Torneo finalizado",
    detalle: "Todos los partidos jugados: llaves, final, tercer puesto y podio de cada categoría.",
    icono: Trophy,
  },
];

/**
 * Abre las demos del Torneo Familia Fase 4. Cada una es un torneo aparte,
 * fijo en su etapa; crear de nuevo una opción reemplaza la anterior.
 */
export function DemoTorneoButton({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [creando, setCreando] = useState<VarianteDemo | null>(null);

  function crear(v: VarianteDemo) {
    setCreando(v);
    startTransition(async () => {
      const res = await crearTorneoDemo(v);
      setCreando(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Demo lista");
      setAbierto(false);
      router.push(`/admin/torneos/${res.data.id}`);
    });
  }

  return (
    <>
      <Button variant={variant} size="lg" onClick={() => setAbierto(true)}>
        <Sparkles className="size-4" /> Ver demos
      </Button>
      <Dialog open={abierto} onOpenChange={(o) => !pending && setAbierto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demos · Torneo Familia Fase 4</DialogTitle>
            <DialogDescription>
              Cada demo es un torneo aparte con datos de ejemplo. Volver a crear una
              reemplaza la anterior.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {OPCIONES.map((o) => {
              const Icono = o.icono;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => crear(o.id)}
                  disabled={pending}
                  className="border-border hover:border-primary/60 flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60"
                >
                  <Icono className="text-primary mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {creando === o.id ? "Creando…" : o.titulo}
                    </span>
                    <span className="text-muted-foreground block text-xs">{o.detalle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
