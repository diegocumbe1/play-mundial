"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone, Search, Users, X } from "lucide-react";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/rifa";
import { waLink } from "@/lib/whatsapp";
import type { Boleta, Rifa } from "@/types";

export type Filtro = "todas" | "deben" | "pagadas";

/** Minúsculas y sin acentos, para buscar "Maria" y encontrar "María". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface Persona {
  clave: string;
  nombre: string;
  telefono: string | null;
  boletas: Boleta[];
  pagadas: number;
  pendientes: number;
  debe: number;
}

/** Listado de participantes: quién compró, cuánto debe y contacto por WhatsApp. */
export function ParticipantesLista({
  rifa,
  boletas,
  filtro: filtroProp,
  onFiltro,
}: {
  rifa: Rifa;
  boletas: Boleta[];
  /** Filtro controlado desde afuera (ej. al tocar un indicador del dashboard). */
  filtro?: Filtro;
  onFiltro?: (f: Filtro) => void;
}) {
  const [filtroLocal, setFiltroLocal] = useState<Filtro>("todas");
  const filtro = filtroProp ?? filtroLocal;
  const setFiltro = onFiltro ?? setFiltroLocal;
  const [busqueda, setBusqueda] = useState("");
  // Ningún cambio de estado es de un solo toque: se abre el modal de la boleta.
  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);

  const ancho = String(rifa.cantidad_numeros - 1).length;

  const personas = useMemo<Persona[]>(() => {
    const map = new Map<string, Persona>();
    for (const b of boletas) {
      if (b.estado === "libre") continue;
      const nombre = b.comprador_nombre?.trim() || "Sin nombre";
      const telefono = b.comprador_telefono?.trim() || null;
      const clave = `${telefono ?? "sin-tel"}|${nombre.toLowerCase()}`;
      const actual =
        map.get(clave) ??
        { clave, nombre, telefono, boletas: [], pagadas: 0, pendientes: 0, debe: 0 };
      actual.boletas.push(b);
      if (b.estado === "pagado") actual.pagadas += 1;
      else actual.pendientes += 1;
      actual.debe = actual.pendientes * rifa.precio_boleta;
      map.set(clave, actual);
    }
    return [...map.values()].sort((a, b) => b.pendientes - a.pendientes);
  }, [boletas, rifa.precio_boleta]);

  const q = normalizar(busqueda.trim());
  const visibles = personas
    .filter((p) =>
      filtro === "deben" ? p.pendientes > 0 : filtro === "pagadas" ? p.pendientes === 0 : true,
    )
    .filter((p) => {
      if (!q) return true;
      // Busca por nombre, teléfono o cualquiera de sus números.
      const qDigitos = q.replace(/\D/g, "");
      const numeros = p.boletas.map((b) => String(b.numero).padStart(ancho, "0")).join(" ");
      if (normalizar(p.nombre).includes(q)) return true;
      if (qDigitos && (p.telefono ?? "").replace(/\D/g, "").includes(qDigitos)) return true;
      if (qDigitos && numeros.split(" ").some((n) => n.includes(qDigitos))) return true;
      return false;
    });

  const totalDeben = personas.reduce((s, p) => s + p.debe, 0);
  const conDeuda = personas.filter((p) => p.pendientes > 0).length;

  if (personas.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Aún no hay participantes. Comparte el enlace público para empezar a vender.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          <Users className="mr-1 inline size-3.5" />
          {personas.length} persona(s) · {conDeuda} con pago pendiente
          {totalDeben > 0 && <> · faltan <b className="text-foreground">{formatCOP(totalDeben)}</b></>}
        </p>
        <div className="border-border inline-flex gap-1 rounded-lg border p-1">
          {([
            { id: "todas", label: "Todas" },
            { id: "deben", label: "Por cobrar" },
            { id: "pagadas", label: "Pagadas" },
          ] as const).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                (filtro === f.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono o número…"
          className="pl-8 pr-8"
          aria-label="Buscar participante"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            aria-label="Limpiar búsqueda"
            className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Personas */}
      <ul className="flex flex-col gap-2">
        {visibles.map((p) => {
          const numerosTxt = p.boletas
            .map((b) => String(b.numero).padStart(ancho, "0"))
            .join(", ");
          const mensaje =
            p.pendientes > 0
              ? `Hola ${p.nombre}, te escribo por la rifa "${rifa.nombre}". Tienes apartado(s) el/los número(s) ${numerosTxt}. El valor pendiente es ${formatCOP(p.debe)}. ¿Me confirmas el pago? ¡Gracias!`
              : `Hola ${p.nombre}, gracias por participar en la rifa "${rifa.nombre}" con el/los número(s) ${numerosTxt}. ¡Mucha suerte! 🍀`;

          return (
            <li key={p.clave} className="border-border rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nombre}</p>
                  {p.telefono ? (
                    <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Phone className="size-3" /> {p.telefono}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">Sin teléfono</p>
                  )}
                </div>
                {p.pendientes > 0 ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Debe {formatCOP(p.debe)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Pagó
                  </span>
                )}
              </div>

              {/* Números de la persona — tocar uno abre el modal de gestión */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.boletas.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBoletaSel(b)}
                    title="Ver / cambiar estado"
                    className={
                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums transition-opacity hover:opacity-80 " +
                      (b.estado === "pagado"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300")
                    }
                  >
                    {String(b.numero).padStart(ancho, "0")}
                  </button>
                ))}
              </div>

              {p.telefono && (
                <a
                  href={waLink(p.telefono, mensaje)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <MessageCircle className="size-3.5" />
                  {p.pendientes > 0 ? "Cobrar por WhatsApp" : "Escribir por WhatsApp"}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {visibles.length === 0 && (
        <p className="text-muted-foreground py-2 text-center text-sm">
          No hay personas en este filtro.
        </p>
      )}

      {/* Mismo modal que la grilla: todo cambio de estado se confirma aquí. */}
      <BoletaModal
        rifaId={rifa.id}
        numero={boletaSel?.numero ?? null}
        boleta={boletaSel ?? undefined}
        ancho={ancho}
        open={boletaSel !== null}
        onClose={() => setBoletaSel(null)}
      />
    </div>
  );
}
