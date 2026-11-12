"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  setMostrarPatrocinadores,
  actualizarPatrocinadorTorneo,
  crearPatrocinadorTorneo,
  eliminarPatrocinadorTorneo,
  subirLogoPatrocinador,
} from "@/actions/torneos";
import { InputMoneda } from "@/components/rifa/input-moneda";
import { Campo, Segmentado } from "@/components/torneo/campos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/torneos";
import { cn } from "@/lib/utils";
import type { PatrocinadorTorneo } from "@/types";

const ROLES: { value: PatrocinadorTorneo["rol"]; label: string }[] = [
  { value: "organiza", label: "Organiza" },
  { value: "gestor", label: "Gestor" },
  { value: "patrocinador", label: "Patrocinador" },
];
const labelRol = (r: PatrocinadorTorneo["rol"]) => ROLES.find((x) => x.value === r)?.label ?? r;

/**
 * Quién organiza, gestiona o patrocina el torneo. Solo los publicados con logo
 * salen en la página pública (una línea bajo el título y una franja al final).
 */
export function PatrocinadoresPanel({
  torneoId,
  slug,
  patrocinadores,
  mostrar = true,
}: {
  torneoId: string;
  slug: string;
  patrocinadores: PatrocinadorTorneo[];
  /** Si el organizador los tiene visibles; `false` los oculta todos (página y TV) sin borrarlos. */
  mostrar?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<PatrocinadorTorneo | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const publicados = patrocinadores.filter((p) => p.estado === "publicado" && p.logo_url).length;

  function alternarVisibilidad() {
    startTransition(async () => {
      const r = await setMostrarPatrocinadores(torneoId, !mostrar);
      if (!r.success) return void toast.error(r.error);
      toast.success(mostrar ? "Patrocinadores ocultos en la página y en la TV" : "Patrocinadores visibles otra vez");
      router.refresh();
    });
  }

  function alternarEstado(p: PatrocinadorTorneo) {
    startTransition(async () => {
      const r = await actualizarPatrocinadorTorneo(p.id, {
        nombre: p.nombre,
        rol: p.rol,
        logo_url: p.logo_url,
        enlace: p.enlace,
        aporte: p.aporte,
        orden: p.orden,
        estado: p.estado === "publicado" ? "borrador" : "publicado",
      });
      if (!r.success) return void toast.error(r.error);
      toast.success(p.estado === "publicado" ? "Quedó en borrador" : "Publicado: ya se ve en la página del torneo");
      router.refresh();
    });
  }

  function borrar(p: PatrocinadorTorneo) {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    startTransition(async () => {
      const r = await eliminarPatrocinadorTorneo(p.id);
      if (!r.success) return void toast.error(r.error);
      toast.success("Eliminado");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            Organizador y patrocinadores{" "}
            <span className="text-muted-foreground font-normal">({publicados} publicados)</span>
          </p>
          <p className="text-muted-foreground text-xs">
            Los publicados con logo salen en{" "}
            <a href={`/t/${slug}`} target="_blank" rel="noreferrer" className="underline">
              la página del torneo
            </a>
            : una cinta de logos bajo el título y la franja «Organiza / Gestores y patrocinadores» al final.
            También salen en la pantalla de la TV de los partidos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mostrar ? "outline" : "default"} disabled={pending} onClick={alternarVisibilidad}>
            {mostrar ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {mostrar ? "Ocultar todos" : "Mostrar todos"}
          </Button>
          <Button size="sm" onClick={() => setNuevo(true)}>
            <Plus className="size-3.5" /> Agregar
          </Button>
        </div>
      </div>
      {!mostrar && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          Los patrocinadores están <b>ocultos</b>: no se ven en la página del torneo ni en la TV. No se borró nada;
          toca «Mostrar todos» para volver a verlos.
        </p>
      )}

      {patrocinadores.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Agrega quién organiza y a los gestores o patrocinadores, con su logo. Quedan en borrador
          hasta que los publiques.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {patrocinadores.map((p) => (
            <li key={p.id} className="border-border flex items-center gap-3 rounded-xl border p-3">
              <button type="button" onClick={() => setEditando(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1">
                  {p.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImagePlus className="size-5 text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {labelRol(p.rol)}
                    {p.aporte ? ` · aporta ${formatCOP(p.aporte)}` : ""}
                    {!p.logo_url ? " · sin logo" : ""}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => alternarEstado(p)}
                disabled={pending || (!p.logo_url && p.estado === "borrador")}
                title={!p.logo_url ? "Sube el logo para poder publicarlo" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
                  p.estado === "publicado"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {p.estado === "publicado" ? "Publicado" : "Borrador"}
              </button>
              <button
                type="button"
                onClick={() => borrar(p)}
                disabled={pending}
                aria-label={`Eliminar ${p.nombre}`}
                className="text-muted-foreground hover:text-destructive inline-flex size-7 shrink-0 items-center justify-center rounded-md"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PatrocinadorModal
        torneoId={torneoId}
        patrocinador={editando}
        abierto={nuevo || editando !== null}
        siguienteOrden={patrocinadores.length}
        onCerrar={() => {
          setNuevo(false);
          setEditando(null);
        }}
      />
    </section>
  );
}

function PatrocinadorModal({
  torneoId,
  patrocinador,
  abierto,
  siguienteOrden,
  onCerrar,
}: {
  torneoId: string;
  patrocinador: PatrocinadorTorneo | null;
  abierto: boolean;
  siguienteOrden: number;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<PatrocinadorTorneo["rol"]>("patrocinador");
  const [logo, setLogo] = useState<string | null>(null);
  const [enlace, setEnlace] = useState("");
  const [aporte, setAporte] = useState("");
  const [estado, setEstado] = useState<PatrocinadorTorneo["estado"]>("borrador");
  const [orden, setOrden] = useState("0");

  const idActual = patrocinador?.id ?? "nuevo";
  if (abierto && idActual !== ultimoId) {
    setUltimoId(idActual);
    setNombre(patrocinador?.nombre ?? "");
    setRol(patrocinador?.rol ?? "patrocinador");
    setLogo(patrocinador?.logo_url ?? null);
    setEnlace(patrocinador?.enlace ?? "");
    setAporte(patrocinador?.aporte ? String(patrocinador.aporte) : "");
    setEstado(patrocinador?.estado ?? "borrador");
    setOrden(String(patrocinador?.orden ?? siguienteOrden));
  }
  if (!abierto) return null;

  async function subir(file: File) {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await subirLogoPatrocinador(torneoId, fd);
      if (!r.success) return void toast.error(r.error);
      setLogo(r.data.url);
    } finally {
      setSubiendo(false);
    }
  }

  function guardar() {
    const input = {
      nombre: nombre.trim(),
      rol,
      logo_url: logo,
      enlace: enlace.trim() || null,
      aporte: aporte ? Number(aporte) : null,
      estado,
      orden: Number(orden) || 0,
    };
    startTransition(async () => {
      const r = patrocinador
        ? await actualizarPatrocinadorTorneo(patrocinador.id, input)
        : await crearPatrocinadorTorneo(torneoId, input);
      if (!r.success) return void toast.error(r.error);
      toast.success(estado === "publicado" ? "Guardado y publicado" : "Guardado como borrador");
      setUltimoId(null);
      onCerrar();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patrocinador ? "Editar" : "Agregar organizador o patrocinador"}</DialogTitle>
          <DialogDescription>
            El logo se guarda en el almacenamiento de la plataforma. Se ve mejor un PNG con fondo
            transparente o un banner horizontal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre" className="sm:col-span-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fase 4 Xtreme Park" />
          </Campo>
          <Campo label="Rol" className="sm:col-span-2">
            <Segmentado value={rol} onChange={(v) => setRol(v as PatrocinadorTorneo["rol"])} options={ROLES} />
          </Campo>
          <Campo label="Logo o banner" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-36 shrink-0 items-center justify-center rounded-xl bg-white/95 p-2">
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImagePlus className="size-6 text-neutral-400" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={archivo}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) subir(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={subiendo} onClick={() => archivo.current?.click()}>
                  <ImagePlus className="size-3.5" /> {subiendo ? "Subiendo…" : logo ? "Cambiar imagen" : "Subir imagen"}
                </Button>
                {logo && (
                  <button type="button" className="text-muted-foreground self-start text-xs underline" onClick={() => setLogo(null)}>
                    Quitar imagen
                  </button>
                )}
                <p className="text-muted-foreground text-[11px]">Máx. 3 MB</p>
              </div>
            </div>
          </Campo>
          <Campo label="Enlace (opcional)" ayuda="Su página o Instagram: el logo lleva ahí.">
            <div className="flex items-center gap-1">
              <Input value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="instagram.com/…" inputMode="url" />
              {enlace && (
                <a href={/^https?:\/\//.test(enlace) ? enlace : `https://${enlace}`} target="_blank" rel="noreferrer" className="text-muted-foreground">
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </Campo>
          <Campo label="Aporte (opcional)" ayuda="Informativo. El dinero que entra regístralo como ingreso «Patrocinio».">
            <InputMoneda value={aporte} onChange={setAporte} placeholder="500.000" />
          </Campo>
          <Campo label="Orden" ayuda="Menor sale primero.">
            <Input inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          <Campo label="Visibilidad">
            <Segmentado
              value={estado}
              onChange={(v) => setEstado(v as PatrocinadorTorneo["estado"])}
              options={[
                { value: "borrador", label: "Borrador" },
                { value: "publicado", label: "Publicado" },
              ]}
            />
          </Campo>
        </div>
        {estado === "publicado" && !logo && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Para publicarlo sube su logo o banner.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || subiendo || !nombre.trim() || (estado === "publicado" && !logo)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
