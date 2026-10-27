"use client";

import { useMemo, useState } from "react";
import { Clock, Copy, MessageCircle, Phone, Search, UserCheck, Users, X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { toast } from "sonner";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import { Input } from "@/components/ui/input";
import { anchoNumeros, formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { urlPublicaRifa } from "@/lib/site-url";
import { waLink } from "@/lib/whatsapp";
import type { Boleta, MetodoPago, Rifa } from "@/types";

export type Filtro = "todas" | "deben" | "pagadas";

/** Minúsculas y sin acentos, para buscar "Maria" y encontrar "María". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Orden = "deuda" | "recientes" | "antiguos";

/** Medio de una boleta pagada; las viejas sin medio cuentan como transferencia. */
function medioDe(b: Boleta): MetodoPago {
  return b.metodo_pago ?? "transferencia";
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Fecha y hora de registro en hora de Colombia (UTC−5, sin horario de verano):
 * "12 oct, 3:45 p. m.". Se arma a mano en vez de usar Intl porque Node y el
 * navegador difieren en los espacios que meten y eso rompe la hidratación.
 */
function fmtRegistro(ms: number): string {
  const d = new Date(ms - 5 * 60 * 60 * 1000);
  const h = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}, ${h % 12 || 12}:${min} ${h < 12 ? "a. m." : "p. m."}`;
}

/** "Efectivo", "Transf." o "Mixto" según cómo pagó sus números. */
function etiquetaMedio(boletas: Boleta[]): string {
  const medios = new Set(boletas.filter((b) => b.estado === "pagado").map(medioDe));
  if (medios.size > 1) return "Mixto";
  return medios.has("efectivo") ? "Efectivo" : "Transf.";
}

interface Persona {
  clave: string;
  nombre: string;
  telefono: string | null;
  boletas: Boleta[];
  pagadas: number;
  pendientes: number;
  debe: number;
  /** Primer y último registro (ms) entre sus boletas. */
  primerRegistro: number;
  ultimoRegistro: number;
}

/**
 * Fecha/hora de registro detrás de un ícono para no gastar espacio en la
 * tarjeta: en desktop se abre al pasar el mouse, en mobile con un toque.
 */
function RegistroInfo({ persona, ancho }: { persona: Persona; ancho: number }) {
  const porFecha = persona.boletas
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label="Ver fecha de registro"
        className="hover:text-foreground inline-flex size-5 items-center justify-center rounded-md transition-colors"
      >
        <Clock className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={6} className="z-50">
          <Popover.Popup className="bg-popover text-popover-foreground ring-foreground/10 max-w-64 rounded-lg p-2.5 text-xs shadow-md ring-1">
            <p className="mb-1 font-semibold">Registro</p>
            <ul className="flex flex-col gap-0.5">
              {porFecha.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 tabular-nums">
                  <span className="font-bold">#{String(b.numero).padStart(ancho, "0")}</span>
                  <span className="text-muted-foreground">{fmtRegistro(Date.parse(b.created_at))}</span>
                </li>
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
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
  const [orden, setOrden] = useState<Orden>("deuda");
  const [medioFiltro, setMedioFiltro] = useState<MetodoPago | "">("");
  // Ningún cambio de estado es de un solo toque: se abre el modal de la boleta.
  const [boletaSel, setBoletaSel] = useState<Boleta | null>(null);

  const ancho = anchoNumeros(rifa);

  // El recordatorio lleva el enlace público: ahí el comprador ve sus números,
  // cuánto vale y a dónde pagar, sin que el organizador tenga que explicarlo.
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
      // Las boletas se insertan al apartarse, así que created_at es el registro.
      const t = Date.parse(b.created_at);
      const actual =
        map.get(clave) ??
        {
          clave,
          nombre,
          telefono,
          boletas: [],
          pagadas: 0,
          pendientes: 0,
          debe: 0,
          primerRegistro: t,
          ultimoRegistro: t,
        };
      actual.boletas.push(b);
      if (b.estado === "pagado") actual.pagadas += 1;
      else actual.pendientes += 1;
      actual.debe = actual.pendientes * rifa.precio_boleta;
      actual.primerRegistro = Math.min(actual.primerRegistro, t);
      actual.ultimoRegistro = Math.max(actual.ultimoRegistro, t);
      map.set(clave, actual);
    }
    const lista = [...map.values()];
    switch (orden) {
      case "recientes":
        return lista.sort((a, b) => b.ultimoRegistro - a.ultimoRegistro);
      case "antiguos":
        return lista.sort((a, b) => a.primerRegistro - b.primerRegistro);
      default:
        return lista.sort((a, b) => b.pendientes - a.pendientes);
    }
  }, [boletasBase, rifa.precio_boleta, orden]);

  const q = normalizar(busqueda.trim());
  const visibles = personas
    .filter((p) =>
      filtro === "deben" ? p.pendientes > 0 : filtro === "pagadas" ? p.pendientes === 0 : true,
    )
    // Por medio: quien pagó al menos un número con ese medio.
    .filter(
      (p) =>
        !medioFiltro ||
        p.boletas.some((b) => b.estado === "pagado" && medioDe(b) === medioFiltro),
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
  // Cuántos números y cuánta plata entraron por cada medio (con el responsable aplicado).
  const porMedio = (m: MetodoPago) =>
    boletasBase.filter((b) => b.estado === "pagado" && medioDe(b) === m).length;
  const pagadasMedio = medioFiltro ? porMedio(medioFiltro) : 0;
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
          {medioFiltro && (
            <>
              {" "}· {pagadasMedio} número(s) en {medioFiltro}:{" "}
              <b className="text-foreground">{formatCOP(pagadasMedio * rifa.precio_boleta)}</b>
            </>
          )}
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

      {/* Barra de filtros: apilada en mobile, en una sola fila desde sm. Los
          selects se describen solos ("Todos los responsables", "Mayor deuda
          primero"), así que no llevan etiqueta visible y no gastan alto. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {responsables.length > 0 && (
          <select
            value={responsableFiltro}
            onChange={(e) => setResponsableFiltro(e.target.value)}
            aria-label="Responsable de venta"
            className="border-input bg-background h-9 rounded-lg border px-2 text-sm sm:w-52"
          >
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={normalizar(r.nombre)} value={normalizar(r.nombre)}>
                {r.nombre} ({r.boletas.length})
              </option>
            ))}
          </select>
        )}

        <select
          value={medioFiltro}
          onChange={(e) => setMedioFiltro(e.target.value as MetodoPago | "")}
          aria-label="Medio de pago"
          className="border-input bg-background h-9 rounded-lg border px-2 text-sm sm:w-48"
        >
          <option value="">Todos los medios</option>
          <option value="transferencia">Transferencia ({porMedio("transferencia")})</option>
          <option value="efectivo">Efectivo ({porMedio("efectivo")})</option>
        </select>

        <div className="relative flex-1">
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

        {/* Orden por fecha/hora de registro */}
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          aria-label="Ordenar participantes"
          className="border-input bg-background h-9 rounded-lg border px-2 text-sm sm:w-56"
        >
          <option value="deuda">Mayor deuda primero</option>
          <option value="antiguos">Registro más antiguo primero</option>
          <option value="recientes">Registro más reciente primero</option>
        </select>
      </div>

      {responsableActivo && (
        <div className="border-border bg-muted/20 rounded-xl border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              <UserCheck className="mr-1 inline size-3.5" />
              {responsableActivo.nombre}: {responsableActivo.boletas.length} número(s) ·{" "}
              {responsableActivo.pagadas} pagado(s) · {responsableActivo.pendientes} por cobrar
              {responsableActivo.porCobrar > 0 && (
                <> · <b className="text-foreground">{formatCOP(responsableActivo.porCobrar)}</b></>
              )}
            </p>
            <button
              type="button"
              onClick={() => setResponsableFiltro("")}
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
            >
              Ver todos
            </button>
          </div>
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

      {/* Personas */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibles.map((p) => {
          const urlPersona = urlPublicaRifa(
            rifa.slug_publico,
            p.boletas.map((b) => b.numero),
          );
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
                  "Aquí ves tus números y cómo pagar 👇",
                  urlPersona,
                  "¡Gracias! 🙌",
                ]
                  .filter(Boolean)
                  .join("\n")
              : [
                  `Hola ${p.nombre}, gracias por participar en la rifa "${rifa.nombre}" con el/los número(s) ${numerosTxt}.`,
                  fechaJuego ? `El sorteo es el ${fechaJuego}.` : "",
                  "Sigue la rifa aquí 👇",
                  urlPersona,
                  "¡Mucha suerte! 🍀",
                ]
                  .filter(Boolean)
                  .join("\n");

          return (
            <li key={p.clave} className="border-border flex flex-col rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold" title={p.nombre}>
                    {p.nombre}
                  </p>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {p.telefono ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" /> {p.telefono}
                      </span>
                    ) : (
                      <span>Sin teléfono</span>
                    )}
                    <RegistroInfo persona={p} ancho={ancho} />
                  </div>
                </div>
                {p.pendientes > 0 ? (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Debe {formatCOP(p.debe)}
                  </span>
                ) : (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Pagó · {etiquetaMedio(p.boletas)}
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
                    title={
                      b.estado === "pagado"
                        ? `Pagado en ${medioDe(b)} · ver / cambiar`
                        : "Ver / cambiar estado"
                    }
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

              {/* mt-auto: las acciones quedan alineadas al fondo en cada fila de tarjetas. */}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
                {p.telefono && (
                  <a
                    href={waLink(p.telefono, mensaje)}
                    target="_blank"
                    rel="noreferrer"
                    title={p.pendientes > 0 ? "Recordar el pago por WhatsApp" : "Escribir por WhatsApp"}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    <MessageCircle className="size-3.5" />
                    {p.pendientes > 0 ? "Recordar pago" : "WhatsApp"}
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
          rifa={rifa}
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
