"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  Share2,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { inscribirEquipoPublico } from "@/actions/torneos";
import type { TorneoPublicoDetalle } from "@/actions/torneos";
import { Campo } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFechaCO } from "@/lib/fecha-co";
import { labelCuentaPago } from "@/lib/pagos";
import {
  apodoPuesto,
  formatCOP,
  labelFormatoTorneo,
  labelPuesto,
} from "@/lib/torneos";
import { waLink } from "@/lib/whatsapp";

/**
 * Landing pública del torneo: es un embudo, no una planilla.
 * Orden: promesa (qué torneo y qué se gana) → escasez real (cupos) → un solo
 * CTA (inscribir equipo) → prueba social (equipos confirmados) → compartir.
 *
 * Nunca muestra datos de contacto de otros equipos, montos pagados ni estados
 * de pago: eso vive solo en el backoffice del organizador.
 */
export function TorneoPublicoView({ datos }: { datos: TorneoPublicoDetalle }) {
  const {
    torneo,
    premios,
    equipos,
    cuposDisponibles,
    inscripcionesAbiertas,
    pago,
    organizador,
  } = datos;
  const [enviado, setEnviado] = useState<string | null>(null);

  const fechaInicio = formatFechaCO(torneo.fecha_inicio, { conAnio: false });
  const fechaFin = formatFechaCO(torneo.fecha_fin, { conAnio: false });
  const cierre = formatFechaCO(torneo.cierre_inscripciones);
  const pctOcupacion =
    torneo.cupo_equipos > 0
      ? Math.round(((torneo.cupo_equipos - cuposDisponibles) / torneo.cupo_equipos) * 100)
      : 0;

  function compartir() {
    const url = window.location.href;
    const mensaje = [
      `Torneo: ${torneo.nombre}`,
      `${torneo.deporte}${torneo.modalidad ? ` ${torneo.modalidad}` : ""}`,
      fechaInicio ? `Arranca el ${fechaInicio}` : null,
      `Quedan ${cuposDisponibles} de ${torneo.cupo_equipos} cupos`,
      url,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      navigator.share({ title: torneo.nombre, text: mensaje }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      {/* --- Promesa --- */}
      <header className="mb-5">
        <p className="text-primary text-xs font-semibold uppercase tracking-wide">
          {torneo.deporte}
          {torneo.modalidad ? ` · ${torneo.modalidad}` : ""}
          {torneo.rama ? ` · ${torneo.rama}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">{torneo.nombre}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Organiza <b className="text-foreground">{organizador}</b> ·{" "}
          {labelFormatoTorneo(torneo.formato)}
          {torneo.categoria ? ` · ${torneo.categoria}` : ""}
        </p>
      </header>

      {(premios.length > 0 || torneo.premiacion_descripcion) && (
        <section className="border-primary/40 bg-primary/5 mb-4 rounded-2xl border p-4">
          <p className="text-primary mb-2 inline-flex items-center gap-1.5 text-xs font-semibold">
            <Trophy className="size-3.5" /> Premiación
          </p>

          {premios.length > 0 && (
            <ul className="mb-2 flex flex-col gap-2">
              {premios.map((p) => {
                const apodo = apodoPuesto(p.puesto);
                return (
                  <li key={p.puesto} className="flex items-start gap-2.5">
                    <span className="bg-primary/15 text-primary mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {p.puesto}°
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.descripcion}</p>
                      <p className="text-muted-foreground text-xs">
                        {apodo ?? labelPuesto(p.puesto)}
                        {p.tipo === "valor" && p.valor
                          ? ` · ${formatCOP(p.valor)}`
                          : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {torneo.premiacion_descripcion && (
            <p className="text-muted-foreground whitespace-pre-line text-xs">
              {torneo.premiacion_descripcion}
            </p>
          )}
        </section>
      )}

      {/* --- Datos que deciden la inscripción --- */}
      <section className="border-border mb-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
        <Fila
          icon={<CalendarDays className="size-4" />}
          label="Fechas"
          valor={
            fechaInicio
              ? `${fechaInicio}${fechaFin && fechaFin !== fechaInicio ? ` – ${fechaFin}` : ""}`
              : "Por confirmar"
          }
        />
        <Fila
          icon={<MapPin className="size-4" />}
          label="Dónde"
          valor={[torneo.escenario, torneo.ciudad].filter(Boolean).join(", ") || "Por confirmar"}
        />
        <Fila
          icon={<Users className="size-4" />}
          label="Jugadores por equipo"
          valor={torneo.jugadores_por_equipo ? String(torneo.jugadores_por_equipo) : "Libre"}
        />
        <Fila
          icon={<Trophy className="size-4" />}
          label="Inscripción por equipo"
          valor={
            torneo.valor_inscripcion > 0 ? formatCOP(torneo.valor_inscripcion) : "Gratuita"
          }
        />
      </section>

      {/* --- Escasez real --- */}
      <section className="border-border mb-5 rounded-2xl border p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            Quedan {cuposDisponibles} de {torneo.cupo_equipos} cupos
          </p>
          <span className="text-muted-foreground text-xs">{pctOcupacion}% ocupado</span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, pctOcupacion)}%` }}
          />
        </div>
        {cierre && (
          <p className="text-muted-foreground mt-2 text-xs">
            Las inscripciones cierran el {cierre}.
          </p>
        )}
      </section>

      {/* --- CTA principal --- */}
      {enviado ? (
        <section className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
          <Check className="mx-auto mb-2 size-6 text-emerald-600 dark:text-emerald-400" />
          <p className="font-semibold">Tu solicitud fue enviada</p>
          <p className="text-muted-foreground mt-1 text-sm">
            El organizador confirmará el cupo de <b>{enviado}</b> y te compartirá las
            instrucciones de pago.
          </p>
          {pago?.whatsapp && (
            <a
              href={waLink(
                pago.whatsapp,
                `Hola, acabo de inscribir a ${enviado} en el torneo ${torneo.nombre}.`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              <MessageCircle className="size-4" /> Escribirle al organizador
            </a>
          )}
        </section>
      ) : inscripcionesAbiertas ? (
        <FormularioInscripcion
          slug={torneo.slug_publico}
          onListo={(nombre) => setEnviado(nombre)}
        />
      ) : (
        <section className="border-border bg-muted/30 mb-5 rounded-2xl border border-dashed p-5 text-center">
          <p className="text-sm font-semibold">Las inscripciones están cerradas</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {cuposDisponibles === 0
              ? "Este torneo ya completó su cupo de equipos."
              : "Este torneo no está recibiendo nuevas solicitudes."}
          </p>
        </section>
      )}

      <Button variant="outline" onClick={compartir} className="mb-6 w-full">
        <Share2 className="size-4" /> Compartir el torneo
      </Button>

      {/* --- Prueba social --- */}
      {equipos.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-sm font-semibold">
            Equipos inscritos{" "}
            <span className="text-muted-foreground font-normal">({equipos.length})</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {equipos.map((e) => (
              <li
                key={e.id}
                className="border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
              >
                {e.confirmado && (
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                {e.nombre}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Cómo pagar --- */}
      {torneo.valor_inscripcion > 0 && pago && (
        <section className="border-border mb-6 rounded-2xl border p-4">
          <p className="mb-2 text-sm font-semibold">Cómo pagar la inscripción</p>
          <div className="space-y-1.5 text-sm">
            {pago.titular && (
              <p>
                <span className="text-muted-foreground text-xs">Titular</span>{" "}
                <b>{pago.titular}</b>
              </p>
            )}
            {(pago.cuenta_numero ?? pago.nequi_llave) && (
              <p>
                <span className="text-muted-foreground text-xs">
                  {labelCuentaPago(pago.cuenta_tipo ?? (pago.nequi_llave ? "nequi" : null))}
                </span>{" "}
                <b>{pago.cuenta_numero ?? pago.nequi_llave}</b>
              </p>
            )}
            {pago.llave && (
              <p>
                <span className="text-muted-foreground text-xs">Llave</span>{" "}
                <b>{pago.llave}</b>
              </p>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Paga solo después de que el organizador confirme tu cupo.
          </p>
        </section>
      )}

      {/* --- Reglamento --- */}
      {torneo.reglamento && (
        <section className="border-border mb-6 rounded-2xl border p-4">
          <p className="mb-2 text-sm font-semibold">Reglamento</p>
          <p className="text-muted-foreground whitespace-pre-line text-sm">
            {torneo.reglamento}
          </p>
        </section>
      )}

      <footer className="text-muted-foreground border-border border-t pt-4 text-center text-xs">
        <a href="/terminos" className="hover:text-foreground underline">
          Términos y tratamiento de datos
        </a>
      </footer>
    </main>
  );
}

/** Formulario de inscripción sin cuenta (el equipo entra como solicitud). */
function FormularioInscripcion({
  slug,
  onListo,
}: {
  slug: string;
  onListo: (nombre: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [responsable, setResponsable] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [jugadores, setJugadores] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);

  function enviar() {
    if (!consentimiento) {
      toast.error("Debes aceptar el tratamiento de datos");
      return;
    }
    startTransition(async () => {
      const r = await inscribirEquipoPublico(slug, {
        nombre: nombre.trim(),
        responsable_nombre: responsable.trim(),
        responsable_telefono: telefono.trim(),
        responsable_correo: correo.trim() || null,
        cantidad_jugadores: jugadores ? Number(jugadores) : null,
        consentimiento: true,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      onListo(r.data.nombre);
    });
  }

  return (
    <section className="border-border mb-5 rounded-2xl border p-4">
      <p className="mb-1 text-base font-semibold">Inscribe tu equipo</p>
      <p className="text-muted-foreground mb-4 text-xs">
        Es una solicitud: el organizador confirma el cupo y te dice cómo pagar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nombre del equipo" className="sm:col-span-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Los Tigres FC"
          />
        </Campo>
        <Campo label="Responsable">
          <Input
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder="Tu nombre"
          />
        </Campo>
        <Campo label="WhatsApp">
          <Input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            placeholder="3001234567"
          />
        </Campo>
        <Campo label="Correo (opcional)">
          <Input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            inputMode="email"
            placeholder="equipo@correo.com"
          />
        </Campo>
        <Campo label="Cantidad de jugadores (opcional)">
          <Input
            value={jugadores}
            onChange={(e) => setJugadores(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="12"
          />
        </Campo>
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consentimiento}
          onChange={(e) => setConsentimiento(e.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span className="text-muted-foreground">
          Autorizo el tratamiento de mis datos para gestionar la inscripción del equipo.{" "}
          <a href="/terminos" className="underline" target="_blank" rel="noreferrer">
            Ver política
          </a>
          .
        </span>
      </label>

      <Button
        onClick={enviar}
        disabled={pending || !nombre.trim() || !responsable.trim() || !telefono.trim()}
        size="lg"
        className="mt-4 w-full"
      >
        Inscribir equipo
      </Button>
    </section>
  );
}

function Fila({
  icon,
  label,
  valor,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate text-sm font-medium">{valor}</p>
      </div>
    </div>
  );
}
