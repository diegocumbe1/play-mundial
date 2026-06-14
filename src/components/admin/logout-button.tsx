"use client";

import { LogOut } from "lucide-react";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut />
        Salir
      </Button>
    </form>
  );
}
