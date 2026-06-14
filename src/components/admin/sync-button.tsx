"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { sincronizarAhora } from "@/actions/partidos";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sincronizarAhora();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sincronizados ${result.data.count} partidos`);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} variant="outline">
      <RefreshCw className={isPending ? "animate-spin" : ""} />
      {isPending ? "Sincronizando…" : "Sincronizar partidos"}
    </Button>
  );
}
