"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Settings, Ticket, Trophy } from "lucide-react";

import { LogoutButton } from "@/components/admin/logout-button";
import { NuevoMenu } from "@/components/admin/nuevo-menu";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Panel", icon: LayoutGrid },
  { href: "/admin/rifas", label: "Rifas", icon: Ticket },
  { href: "/admin/torneos", label: "Torneos", icon: Trophy },
  { href: "/precios", label: "Planes", icon: Settings },
] as const;

/** Header desktop del backoffice. En mobile manda BottomNav. */
export function BackofficeHeader() {
  const pathname = usePathname();
  const esBackoffice =
    pathname.startsWith("/admin") || pathname.startsWith("/superadmin");

  if (!esBackoffice || pathname.startsWith("/admin/login")) return null;

  const links =
    pathname.startsWith("/superadmin")
      ? [
          ...LINKS,
          { href: "/superadmin", label: "Plataforma", icon: Settings },
        ]
      : LINKS;

  function activo(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/precios") return pathname === "/precios";
    // Crear vive en el menú "Nueva": las rutas de alta no marcan la sección.
    if (href === "/admin/rifas") {
      return (
        pathname === href ||
        (pathname.startsWith(`${href}/`) && !pathname.startsWith("/admin/rifas/nueva"))
      );
    }
    if (href === "/admin/torneos") {
      return (
        pathname === href ||
        (pathname.startsWith(`${href}/`) && !pathname.startsWith("/admin/torneos/nuevo"))
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 hidden border-b backdrop-blur-xl sm:block">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
            P
          </span>
          <span className="truncate text-sm font-bold">Play Mundial</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Menú del panel">
          <Link
            href="/"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-colors"
          >
            <Home className="size-3.5" /> Home
          </Link>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = activo(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {link.label}
              </Link>
            );
          })}
          <NuevoMenu />
        </nav>

        <LogoutButton />
      </div>
    </header>
  );
}
