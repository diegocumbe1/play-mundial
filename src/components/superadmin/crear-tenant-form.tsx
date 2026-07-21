"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { crearTenantConOwner } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Alta de un organizador (tenant) + su usuario owner. Solo superadmin. */
export function CrearTenantForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function crear() {
    startTransition(async () => {
      const r = await crearTenantConOwner({ nombre: nombre.trim(), email: email.trim(), password });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Organizador creado");
      setNombre("");
      setEmail("");
      setPassword("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Organizador</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre / grupo" />
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Email de acceso</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@correo.com" type="email" />
      </div>
      <div>
        <Label className="text-muted-foreground mb-1.5 block text-xs">Contraseña</Label>
        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" type="password" />
      </div>
      <div className="sm:col-span-3">
        <Button onClick={crear} disabled={pending || !nombre.trim() || !email.trim() || password.length < 6}>
          <UserPlus className="size-4" /> Crear organizador
        </Button>
      </div>
    </div>
  );
}
