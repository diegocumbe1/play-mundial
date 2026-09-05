"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { login, registrarOrganizador } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormValues {
  nombre: string;
  telefono: string;
  email: string;
  password: string;
}

export function LoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: { nombre: "", telefono: "", email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    const result =
      modo === "login"
        ? await login(values)
        : await registrarOrganizador({
            nombre: values.nombre,
            telefono: values.telefono,
            email: values.email,
            password: values.password,
          });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      modo === "login"
        ? "Sesión iniciada"
        : "Cuenta creada. Ya puedes preparar tu rifa; para publicarla la revisamos primero.",
    );
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="border-polla-line grid grid-cols-2 gap-1 rounded-xl border p-1">
        {([
          { id: "login", label: "Ya tengo cuenta" },
          { id: "registro", label: "Usuario nuevo" },
        ] as const).map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            onClick={() => {
              setModo(opcion.id);
              reset({ nombre: "", telefono: "", email: "", password: "" });
            }}
            aria-pressed={modo === opcion.id}
            className={
              "rounded-lg px-2 py-2 text-xs font-semibold transition-colors " +
              (modo === opcion.id
                ? "bg-polla-gold text-polla-dark"
                : "text-polla-muted hover:bg-polla-line/40")
            }
          >
            {opcion.label}
          </button>
        ))}
      </div>

      {modo === "registro" && (
        <div className="grid gap-2">
          <Label htmlFor="nombre" className="text-polla-muted">
            Nombre del organizador
          </Label>
          <Input
            id="nombre"
            autoComplete="organization"
            className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
            placeholder="Tu nombre o negocio"
            {...register("nombre", { required: modo === "registro" })}
          />
        </div>
      )}

      {modo === "registro" && (
        <div className="grid gap-2">
          <Label htmlFor="telefono" className="text-polla-muted">
            WhatsApp
          </Label>
          <Input
            id="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
            placeholder="300 000 0000"
            {...register("telefono", { required: modo === "registro" })}
          />
          <p className="text-polla-muted text-xs">
            Por aquí te contactamos para activar la cuenta. Un WhatsApp, una cuenta.
          </p>
        </div>
      )}

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
        {isSubmitting
          ? modo === "login" ? "Entrando…" : "Creando cuenta…"
          : modo === "login" ? "Iniciar sesión" : "Crear cuenta y continuar"}
      </Button>

      <p className="text-polla-muted text-center text-xs">
        {modo === "login"
          ? "Si aún no tienes cuenta, elige Usuario nuevo."
          : "Entras de una a preparar tu rifa. Para publicarla revisamos la cuenta primero."}
      </p>
    </form>
  );
}
