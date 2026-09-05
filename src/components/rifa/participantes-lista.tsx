"use client";

import { useMemo, useState } from "react";
import { Copy, MessageCircle, Phone, Search, UserCheck, Users, X } from "lucide-react";
import { toast } from "sonner";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import { Input } from "@/components/ui/input";
import { anchoNumeros, formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
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

interface ResponsableResumen {
  nombre: string;
  boletas: Boleta[];
  pagadas: number;
  pendientes: number;
  porCobrar: number;
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
  const [responsableFiltro, setResponsableFiltro] = useState("");
  // Ningún cambio de estado es de un solo toque: se abre el modal de la boleta.
  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);

  const ancho = anchoNumeros(rifa);

  // El recordatorio lleva el enlace público: ahí el comprador ve sus números,
  // cuánto vale y a dónde pagar, sin que el organizador tenga que explicarlo.
  const urlPublica =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${rifa.slug_publico}`
      : `/r/${rifa.slug_publico}`;
  const fechaJuego = formatFechaCO(
    rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo,
    { conAnio: false },
  );

  const responsables = useMemo<ResponsableResumen[]>(() => {
    const map = new Map<string, ResponsableResumen>();
    for (const b of boletas) {
      if (b.estado === "libre") continue;
      const nombre = b.responsable_venta?.trim();
      if (!nombre) continue;
      const clave = normalizar(nombre);
      const actual =
        map.get(clave) ??
        { nombre, boletas: [], pagadas: 0, pendientes: 0, porCobrar: 0 };
      actual.boletas.push(b);
      if (b.estado === "pagado") actual.pagadas += 1;
      else actual.pendientes += 1;
      actual.porCobrar = actual.pendientes * rifa.precio_boleta;
      map.set(clave, actual);
    }
    return [...map.values()].sort((a, b) => b.boletas.length - a.boletas.length);
  }, [boletas, rifa.precio_boleta]);

  const responsableActivo = responsables.find((r) => normalizar(r.nombre) === responsableFiltro);
  const boletasBase = useMemo(
    () =>
      responsableFiltro
        ? boletas.filter((b) => normalizar(b.responsable_venta?.trim() ?? "") === responsableFiltro)
        : boletas,
    [boletas, responsableFiltro],
  );

  const personas = useMemo<Persona[]>(() => {
    const map = new Map<string, Persona>();
    for (const b of boletasBase) {
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
  }, [boletasBase, rifa.precio_boleta]);

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
      const responsables = p.boletas.map((b) => b.responsable_venta ?? "").join(" ");
      if (normalizar(p.nombre).includes(q)) return true;
      if (normalizar(responsables).includes(q)) return true;
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
      {responsables.length > 0 && (
        <div className="border-border bg-muted/20 rounded-xl border p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                Responsable de venta
              </label>
              <select
                value={responsableFiltro}
                onChange={(e) => setResponsableFiltro(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
              >
                <option value="">Todos los responsables</option>
                {responsables.map((r) => (
                  <option key={normalizar(r.nombre)} value={normalizar(r.nombre)}>
                    {r.nombre} ({r.boletas.length})
                  </option>
                ))}
              </select>
            </div>
            {responsableFiltro && (
              <button
                type="button"
                onClick={() => setResponsableFiltro("")}
                className="text-muted-foreground hover:text-foreground h-9 rounded-lg px-2 text-xs"
              >
                Ver todos
              </button>
            )}
          </div>

          {responsableActivo && (
            <div className="mt-3">
              <p className="text-muted-foreground text-xs">
                <UserCheck className="mr-1 inline size-3.5" />
                {responsableActivo.nombre}: {responsableActivo.boletas.length} número(s) ·{" "}
                {responsableActivo.pagadas} pagado(s) · {responsableActivo.pendientes} por cobrar
                {responsableActivo.porCobrar > 0 && (
                  <> · <b className="text-foreground">{formatCOP(responsableActivo.porCobrar)}</b></>
                )}
              </p>
              <div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-auto">
                {responsableActivo.boletas
                  .slice()
                  .sort((a, b) => a.numero - b.numero)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBoletaSel(b)}
                      title={`${b.comprador_nombre ?? "Sin comprador"} · ${b.estado}`}
                      className={
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums " +
                        (b.estado === "pagado"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300")
                      }
                    >
                      {String(b.numero).padStart(ancho, "0")}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono, número o responsable…"
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
          // Recordatorio de cobro (o agradecimiento si ya pagó). Siempre cierra
          // con el enlace público, que es donde están los datos de pago.
          const mensaje =
            p.pendientes > 0
              ? [
                  `Hola ${p.nombre}, te escribo por la rifa "${rifa.nombre}".`,
                  `Tienes apartado(s) el/los número(s) ${numerosTxt}.`,
                  `Queda(n) pendiente(s) ${formatCOP(p.debe)}.`,
                  fechaJuego
                    ? `El sorteo es el ${fechaJuego} y ${rifa.solo_pagadas_juegan ? "solo juegan las boletas pagadas" : "las boletas vendidas entran al sorteo"}.`
                    : rifa.solo_pagadas_juegan
                      ? "Recuerda que solo juegan las boletas pagadas."
                      : "",
                  `Aquí puedes ver la rifa y cómo pagar: ${urlPublica}`,
                  "¡Gracias! 🙌",
                ]
                  .filter(Boolean)
                  .join("\n")
              : [
                  `Hola ${p.nombre}, gracias por participar en la rifa "${rifa.nombre}" con el/los número(s) ${numerosTxt}.`,
                  fechaJuego ? `El sorteo es el ${fechaJuego}.` : "",
                  `Sigue la rifa aquí: ${urlPublica}`,
                  "¡Mucha suerte! 🍀",
                ]
                  .filter(Boolean)
                  .join("\n");

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
                      "tap-scale inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums transition-opacity hover:opacity-80 " +
                      (b.estado === "pagado"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300")
                    }
                  >
                    {String(b.numero).padStart(ancho, "0")}
                  </button>
                ))}
              </div>
              {p.boletas.some((b) => b.responsable_venta) && (
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {p.boletas
                    .filter((b) => b.responsable_venta)
                    .map((b) => (
                      <span key={`${b.id}-responsable`} className="bg-muted rounded-md px-2 py-0.5">
                        #{String(b.numero).padStart(ancho, "0")}: {b.responsable_venta}
                      </span>
                    ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {p.telefono && (
                  <a
                    href={waLink(p.telefono, mensaje)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    <MessageCircle className="size-3.5" />
                    {p.pendientes > 0 ? "Recordar el pago por WhatsApp" : "Escribir por WhatsApp"}
                  </a>
                )}
                {/* Sin teléfono guardado el recordatorio igual sirve: se copia
                    y se pega en el chat que ya se tenga abierto. */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(mensaje);
                      toast.success("Mensaje copiado");
                    } catch {
                      toast.error("No se pudo copiar");
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
                >
                  <Copy className="size-3.5" /> Copiar mensaje
                </button>
              </div>
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
      {boletaSel && (
        <BoletaModal
          rifaId={rifa.id}
          numero={boletaSel.numero}
          boleta={boletaSel}
          ancho={ancho}
          open
          onClose={() => setBoletaSel(null)}
        />
      )}
    </div>
  );
}
