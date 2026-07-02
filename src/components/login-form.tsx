"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormValues {
  email: string;
  password: string;
}

export function LoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    const result = await login(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email" className="text-polla-muted">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
          {...register("email", { required: true })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="text-polla-muted">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
          {...register("password", { required: true })}
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="shimmer bg-polla-gold text-polla-dark hover:bg-polla-gold/90 mt-2 h-11 w-full rounded-xl font-bold"
      >
        {isSubmitting ? "Entrando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
