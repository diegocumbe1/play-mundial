"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Download,
  ExternalLink,
  Info,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  Search,
  Ticket,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { crearApuestas } from "@/actions/apuestas";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrCreateClienteId } from "@/lib/cliente-id";
import { lanzarConfetti } from "@/lib/confetti";
import { formatFechaCorta } from "@/lib/format";
import { traducirEquipo, traducirLiga, type Idioma } from "@/lib/idioma";
import { formatCOP, POLLA } from "@/lib/polla";
import { cn } from "@/lib/utils";
import type { Partido } from "@/types";

interface DatosValues {
  nombre: string;
  telefono: string;
}

/** No-op para useSyncExternalStore: localStorage no cambia durante la sesión. */
const emptySubscribe = () => () => {};

interface CartItem {
  key: string;
  partido_id: string;
  goles_local: number;
  goles_visitante: number;
}

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={`Menos ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="text-polla-muted hover:text-white hover:border-polla-gold/60 border-polla-line flex size-8 items-center justify-center rounded-lg border transition-colors sm:size-9"
      >
        <Minus className="size-4" />
      </button>
      <span className="font-heading w-8 text-center text-2xl text-white tabular-nums sm:w-9 sm:text-3xl">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Más ${label}`}
        onClick={() => onChange(value + 1)}
        className="text-polla-muted hover:text-white hover:border-polla-gold/60 border-polla-line flex size-8 items-center justify-center rounded-lg border transition-colors sm:size-9"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function MiniEquipo({ nombre, logo }: { nombre: string; logo: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="bg-polla-elevated ring-polla-line flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
        {logo ? (
          <Image src={logo} alt={nombre} width={26} height={26} className="size-6 object-contain" />
        ) : (
          <span className="text-xs">⚽</span>
        )}
      </div>
      <span className="truncate text-sm font-bold tracking-wide text-white uppercase">
        {nombre}
      </span>
    </div>
  );
}

function EquipoPronostico({
  nombre,
  logo,
  goles,
  onGolesChange,
}: {
  nombre: string;
  logo: string | null;
  goles: number;
  onGolesChange: (v: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <MiniEquipo nombre={nombre} logo={logo} />
      <Stepper value={goles} onChange={onGolesChange} label={`goles ${nombre}`} />
    </div>
  );
}

export function PronosticoForm({
  partidos,
  idioma = "es",
  partidoInicialId = "",
  busquedaInicial = "",
}: {
  partidos: Partido[];
  idioma?: Idioma;
  partidoInicialId?: string;
  busquedaInicial?: string;
}) {
  const router = useRouter();
  // Valores que se están editando por partido (antes de "Agregar").
  const [editing, setEditing] = useState<
    Record<string, { local: number; visitante: number }>
  >(() => Object.fromEntries(partidos.map((p) => [p.id, { local: 0, visitante: 0 }])));
  // Carrito: cada item es una apuesta (un cobro).
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [apuestaRegistrada, setApuestaRegistrada] = useState(false);
  const [pagoComunicado, setPagoComunicado] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [q, setQ] = useState(busquedaInicial);
  const guardandoRef = useRef(false);
  const comunicandoRef = useRef(false);

  const query = q.trim().toLowerCase();
  const partidoInicial = partidoInicialId
    ? partidos.find((p) => p.id === partidoInicialId)
    : undefined;
  const visibles = partidoInicial
    ? [partidoInicial]
    : partidos.filter((p) =>
        [
          p.equipo_local,
          p.equipo_visitante,
          p.liga ?? "",
          traducirEquipo(p.equipo_local, idioma),
          traducirEquipo(p.equipo_visitante, idioma),
          traducirLiga(p.liga, idioma),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { isValid },
  } = useForm<DatosValues>({
    mode: "onChange",
    defaultValues: { nombre: "", telefono: "" },
  });

  // Datos guardados de una apuesta anterior (solo se rellenan si el usuario lo
  // pide). Se leen del navegador con useSyncExternalStore para no desajustar la
  // hidratación; nunca se mandan automáticamente.
  const rawDatos = useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return localStorage.getItem("polla:datos");
      } catch {
        return null;
      }
    },
    () => null,
  );
  const recordado = useMemo<DatosValues | null>(() => {
    if (!rawDatos) return null;
    try {
      const d = JSON.parse(rawDatos) as Partial<DatosValues>;
      return d.nombre ? { nombre: d.nombre, telefono: d.telefono ?? "" } : null;
    } catch {
      return null;
    }
  }, [rawDatos]);
  const [datosUsados, setDatosUsados] = useState(false);

  function usarDatosGuardados() {
    if (!recordado) return;
    setValue("nombre", recordado.nombre, { shouldValidate: true });
    setValue("telefono", recordado.telefono, { shouldValidate: true });
    setDatosUsados(true);
  }

  const total = cart.length * POLLA.costo;
  const partidosEnCarrito = new Set(cart.map((item) => item.partido_id)).size;
  const nombrePago = getValues("nombre").trim();
  const partidosPorId = new Map(partidos.map((partido) => [partido.id, partido]));
  const detalleApuestas = cart.map((item, index) => {
    const partido = partidosPorId.get(item.partido_id);
    const local = partido
      ? traducirEquipo(partido.equipo_local, idioma)
      : "Partido";
    const visitante = partido
      ? traducirEquipo(partido.equipo_visitante, idioma)
      : "sin identificar";

    return `${index + 1}. ${local} vs ${visitante}: ${item.goles_local}-${item.goles_visitante}`;
  });
  const mensajePago = [
    "Hola, ya realice mi pago.",
    `Nombre: ${nombrePago || "Pendiente"}`,
    `Monto: ${formatCOP(total)}`,
    `Apuestas: ${cart.length}`,
    `Partidos: ${partidosEnCarrito}`,
    "Detalle:",
    ...detalleApuestas,
    "Por favor confirmar y habilitar mi apuesta.",
  ].join("\n");
  const whatsappPagoUrl = `https://wa.me/${POLLA.whatsappAdmin}?text=${encodeURIComponent(
    mensajePago,
  )}`;

  function setStepper(id: string, patch: Partial<{ local: number; visitante: number }>) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function agregar(partidoId: string) {
    if (apuestaRegistrada) {
      setApuestaRegistrada(false);
      setPagoComunicado(false);
      comunicandoRef.current = false;
    }

    const { local, visitante } = editing[partidoId];
    setCart((prev) => [
      ...prev,
      {
        key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${partidoId}-${Date.now()}-${Math.random()}`,
        partido_id: partidoId,
        goles_local: local,
        goles_visitante: visitante,
      },
    ]);
    setStepper(partidoId, { local: 0, visitante: 0 });
  }

  function quitar(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  function onContinuar() {
    if (cart.length === 0) {
      toast.error("Agrega al menos una apuesta");
      return;
    }
    setModalOpen(true);
  }

  async function registrarApuestasPendientes() {
    if (apuestaRegistrada) return true;
    if (guardandoRef.current) return false;

    const { nombre, telefono } = getValues();
    guardandoRef.current = true;
    setEnviando(true);
    let result: Awaited<ReturnType<typeof crearApuestas>>;
    try {
      result = await crearApuestas({
        nombre,
        cliente_id: getOrCreateClienteId(),
        telefono: telefono.trim() === "" ? null : telefono.trim(),
        pagado: false,
        apuestas: cart.map((c) => ({
          partido_id: c.partido_id,
          goles_local: c.goles_local,
          goles_visitante: c.goles_visitante,
        })),
      });
    } catch {
      toast.error("No pudimos registrar la apuesta. Intenta nuevamente.");
      return false;
    } finally {
      guardandoRef.current = false;
      setEnviando(false);
    }

    if (!result.success) {
      toast.error(result.error);
      return false;
    }

    // Recordar nombre/teléfono para una próxima apuesta (solo en el navegador).
    try {
      localStorage.setItem(
        "polla:datos",
        JSON.stringify({
          nombre: nombre.trim(),
          telefono: (telefono ?? "").trim(),
        }),
      );
    } catch {
      // ignorar
    }
    setApuestaRegistrada(true);
    lanzarConfetti();
    toast.success(
      `¡Listo! Registraste ${result.data.count} apuesta(s). Quedan pendientes de validar pago.`,
    );
    return true;
  }

  async function confirmar() {
    const registrada = await registrarApuestasPendientes();
    if (!registrada) return;

    setModalOpen(false);
    setCart([]);
    router.push("/resultados");
  }

  async function comunicarPago() {
    if (pagoComunicado || comunicandoRef.current) {
      toast.info("El pago ya fue comunicado para esta apuesta.");
      return;
    }

    comunicandoRef.current = true;
    const ventanaWhatsapp = window.open("", "_blank");
    if (ventanaWhatsapp) ventanaWhatsapp.opener = null;
    const registrada = await registrarApuestasPendientes();

    if (!registrada) {
      comunicandoRef.current = false;
      ventanaWhatsapp?.close();
      return;
    }

    setPagoComunicado(true);

    if (ventanaWhatsapp) {
      ventanaWhatsapp.location.href = whatsappPagoUrl;
    } else {
      window.location.href = whatsappPagoUrl;
    }

    setModalOpen(false);
    setCart([]);
    router.push("/resultados");
  }

  return (
    <>
      <form onSubmit={handleSubmit(onContinuar)} className="grid gap-6 pb-28">
        {recordado && !datosUsados && (
          <button
            type="button"
            onClick={usarDatosGuardados}
            className="border-polla-gold/40 bg-polla-gold/10 text-polla-gold hover:bg-polla-gold/15 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors"
          >
            <span className="min-w-0 truncate">
              Usar mis datos: {recordado.nombre}
              {recordado.telefono ? ` · ${recordado.telefono}` : ""}
            </span>
            <span className="text-polla-gold/80 shrink-0 text-xs uppercase">
              Rellenar
            </span>
          </button>
        )}

        <div className="bg-polla-surface ring-polla-line grid gap-4 rounded-2xl p-5 ring-1 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="nombre" className="text-polla-muted">
              Nombre *
            </Label>
            <Input
              id="nombre"
              placeholder="Tu nombre"
              className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
              {...register("nombre", { required: true, minLength: 1 })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="telefono" className="text-polla-muted">
              Teléfono (opcional)
            </Label>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Tu número de contacto"
              className="h-11 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
              {...register("telefono")}
            />
          </div>
        </div>

        <p className="text-polla-muted text-sm">
          Arma tu marcador y pulsa{" "}
          <span className="text-polla-gold font-semibold">Agregar apuesta</span>.
          Puedes hacer varias al mismo partido —{" "}
          <span className="text-polla-gold font-semibold">
            {formatCOP(POLLA.costo)} cada una
          </span>
          .
        </p>

        {partidoInicial && (
          <div className="border-polla-gold/40 bg-polla-gold/10 text-polla-gold rounded-2xl border px-4 py-3 text-sm font-semibold">
            Apostando al partido seleccionado.
          </div>
        )}

        {/* Buscador por país / equipo */}
        {!partidoInicial && (
          <div className="relative">
            <Search className="text-polla-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar país o equipo (ej. Colombia)…"
              className="h-12 pl-10 focus-visible:border-polla-gold focus-visible:ring-polla-gold/30"
            />
          </div>
        )}

        {visibles.length === 0 ? (
          <p className="text-polla-muted rounded-2xl bg-polla-surface px-4 py-8 text-center ring-1 ring-polla-line">
            Sin partidos para “{q}”.
          </p>
        ) : (
          <div className="grid gap-3">
            {visibles.map((p) => {
            const ed = editing[p.id];
            const apuestasPartido = cart.filter((c) => c.partido_id === p.id);
            const local = traducirEquipo(p.equipo_local, idioma);
            const visitante = traducirEquipo(p.equipo_visitante, idioma);
            return (
              <div
                key={p.id}
                className={cn(
                  "bg-polla-surface ring-polla-line rounded-2xl p-4 ring-1 transition-colors",
                  apuestasPartido.length > 0
                    ? "ring-polla-gold/60"
                    : "hover:ring-polla-line",
                )}
              >
                <div className="text-polla-muted mb-3 text-xs font-medium">
                  {formatFechaCorta(p.fecha)}
                </div>
                <div className="grid gap-2">
                  <EquipoPronostico
                    nombre={local}
                    logo={p.equipo_local_logo}
                    goles={ed.local}
                    onGolesChange={(v) => setStepper(p.id, { local: v })}
                  />
                  <EquipoPronostico
                    nombre={visitante}
                    logo={p.equipo_visitante_logo}
                    goles={ed.visitante}
                    onGolesChange={(v) => setStepper(p.id, { visitante: v })}
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => agregar(p.id)}
                  className="bg-polla-elevated mt-4 w-full gap-2 rounded-xl font-bold text-white hover:bg-polla-elevated/80"
                >
                  <Ticket className="size-4" />
                  Agregar apuesta · {formatCOP(POLLA.costo)}
                </Button>

                {apuestasPartido.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {apuestasPartido.map((c) => (
                      <span
                        key={c.key}
                        className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-sm font-bold ring-1"
                      >
                        {c.goles_local}–{c.goles_visitante}
                        <button
                          type="button"
                          aria-label="Quitar apuesta"
                          onClick={() => quitar(c.key)}
                          className="hover:bg-polla-gold/20 flex size-5 items-center justify-center rounded-full"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}

        {/* Barra de total fija */}
        <div className="border-polla-line/70 bg-polla-dark/85 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-polla-muted text-xs tracking-wide uppercase">
                {cart.length} apuesta(s)
              </div>
              <div className="font-heading text-polla-gold text-2xl">
                {formatCOP(total)}
              </div>
            </div>
            <Button
              type="submit"
              disabled={!isValid || cart.length === 0}
              className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 h-12 gap-2 rounded-xl px-6 text-base font-bold"
            >
              <Ticket className="size-5" />
              Continuar
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-polla-surface border-polla-line max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-polla-gold text-2xl tracking-wide">
              Confirmar apuestas
            </DialogTitle>
            <DialogDescription className="text-polla-muted">
              {cart.length} apuesta(s) · transfiere{" "}
              <span className="text-polla-gold font-semibold">
                {formatCOP(total)}
              </span>{" "}
              y confirma.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="ring-polla-line flex w-full max-w-80 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1">
              {qrError ? (
                <div className="text-polla-muted flex aspect-square w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs">
                  <QrCode className="size-8" />
                  Coloca tu QR en
                  <code className="text-polla-gold">public/qr-pago.png</code>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={POLLA.qrSrc}
                  alt="QR de pago"
                  className="h-auto w-full"
                  onError={() => setQrError(true)}
                />
              )}
            </div>
            <div className="grid w-full max-w-80 grid-cols-2 gap-2">
              <a
                href={POLLA.qrSrc}
                download="qr-pago-paola-gomez.png"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-polla-gold/50 text-polla-gold hover:bg-polla-gold/10",
                )}
              >
                <Download className="size-4" />
                Descargar QR
              </a>
              <a
                href={POLLA.qrSrc}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-polla-line text-white hover:bg-white/5",
                )}
              >
                <ExternalLink className="size-4" />
                Abrir QR
              </a>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={comunicarPago}
              disabled={enviando || pagoComunicado}
              className={cn(
                "border-polla-gold/60 bg-polla-gold/10 text-polla-gold hover:bg-polla-gold/15 w-full max-w-80 font-bold",
              )}
            >
              <MessageCircle className="size-4" />
              {pagoComunicado
                ? "Pago comunicado"
                : enviando
                  ? "Registrando…"
                  : "Comunicar pago"}
            </Button>
            <div className="text-center text-sm">
              <div className="font-semibold text-white">{POLLA.banco.entidad}</div>
              <div className="text-polla-muted">{POLLA.banco.numero}</div>
              <div className="text-polla-muted">{POLLA.banco.titular}</div>
            </div>
            <p className="text-polla-muted max-w-xs text-center text-xs">
              Después de enviar, el admin validará el pago y lo marcará como
              recibido.
            </p>
          </div>

          <Link
            href="/terminos"
            target="_blank"
            className="text-polla-muted hover:text-polla-gold mx-auto inline-flex items-center gap-1.5 text-xs"
          >
            <Info className="size-3.5" />
            Cómo funciona · Términos y privacidad
          </Link>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => confirmar()}
              disabled={enviando || apuestaRegistrada}
              className="bg-polla-gold text-polla-dark hover:bg-polla-gold/90 w-full gap-2 font-bold"
            >
              <Trophy className="size-4" />
              {apuestaRegistrada
                ? "Apuesta registrada"
                : enviando
                  ? "Registrando…"
                  : "Registrar apuesta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
