/**
 * Propuestas comerciales que se presentan en vivo al cliente desde
 * `/propuesta/[slug]`.
 *
 * TODO lo que cambia entre una propuesta y otra vive aquí: precios, fechas,
 * premios, textos. La página solo pinta. Para ajustar un valor antes de una
 * reunión basta con editar este archivo; para una propuesta nueva, copiar el
 * objeto de Fase 4 con otro `slug`.
 *
 * Modelo de negocio: SUSCRIPCIÓN al software. El organizador gestiona su
 * torneo él mismo con la guía paso a paso; no se vende la plataforma ni se
 * opera el torneo por él.
 */

export type Disponibilidad = "incluido" | "proximamente";

export interface Propuesta {
  slug: string;
  /** Marca con la que se presenta la propuesta. */
  marca: string;
  cliente: { nombre: string; ciudad: string };
  evento: {
    nombre: string;
    deporte: string;
    /** Texto libre: así se muestra tal cual en la portada. */
    fechas: string;
    /** Valor de inscripción por equipo (COP). */
    inscripcion: number;
  };
  /** Cada categoría con sus premios en orden: [1er, 2°, 3er…] (COP). */
  categorias: { nombre: string; detalle: string; premios: number[] }[];
  /** Planes de suscripción. `precio: null` se muestra como "Por definir". */
  planes: {
    nombre: string;
    precio: number | null;
    unidad: string;
    detalle: string;
    destacado?: boolean;
  }[];
  incluye: { titulo: string; detalle: string; estado: Disponibilidad }[];
  /** Qué hacen las ligas grandes y cómo lo aplica la plataforma. */
  referentes: { fuente: string; practica: string; aqui: string; estado: Disponibilidad }[];
  pasos: { titulo: string; detalle: string; tiempo: string }[];
  necesitamos: string[];
  contacto: { nombre: string; whatsapp: string };
  /** Hasta cuándo aplican estos valores. */
  vigencia: string;
}

export const PROPUESTAS: Propuesta[] = [
  {
    slug: "xtreme-park-fase-4",
    marca: "DC Sport Score",
    cliente: { nombre: "Xtreme Park Fase 4", ciudad: "Garzón, Huila" },
    evento: {
      nombre: "Torneo Familia Fase 4",
      deporte: "Voleiplaya mixto",
      fechas: "4 al 27 de noviembre de 2026",
      inscripcion: 200_000,
    },
    categorias: [
      {
        nombre: "3 vs 3",
        detalle: "Equipos de 3 jugadores · mínimo una mujer en cancha",
        premios: [900_000, 400_000, 250_000],
      },
      {
        nombre: "5 vs 5",
        detalle: "Equipos de 5 jugadores · mínimo una mujer en cancha",
        premios: [1_200_000, 800_000, 500_000],
      },
    ],
    planes: [
      {
        nombre: "Por torneo",
        precio: null,
        unidad: "por torneo",
        detalle: "Todo el torneo, del primer inscrito al informe final.",
        destacado: true,
      },
      {
        nombre: "Mensual",
        precio: null,
        unidad: "al mes",
        detalle: "Torneos ilimitados mientras la suscripción esté activa.",
      },
    ],
    incluye: [
      {
        titulo: "Configuración en 10 minutos",
        detalle:
          "Asistente con plantilla de voleiplaya: categorías, reglas de juego, reglas de participación y premiación ya precargadas.",
        estado: "incluido",
      },
      {
        titulo: "Reglamento y términos automáticos",
        detalle:
          "Se redactan solos según sus respuestas. Cada equipo los acepta al inscribirse y queda registro de la versión.",
        estado: "incluido",
      },
      {
        titulo: "Inscripción en línea con validación",
        detalle:
          "Enlace para WhatsApp e Instagram. Valida solo: exclusivo para clientes, máximo un externo, un referente y mínimo una mujer.",
        estado: "incluido",
      },
      {
        titulo: "Pagos, gastos y premios",
        detalle:
          "Quién pagó, cuánto falta y alertas si los inscritos no alcanzan para cubrir la premiación.",
        estado: "incluido",
      },
      {
        titulo: "Fixture y tabla automáticos",
        detalle:
          "Se generan con un botón y la tabla se recalcula sola con cada resultado, con criterios de desempate fijos.",
        estado: "incluido",
      },
      {
        titulo: "Marcador en vivo",
        detalle:
          "Pantalla o TV en la cancha y control desde el celular del árbitro, con voz. El resultado pasa al fixture con un toque.",
        estado: "incluido",
      },
      {
        titulo: "Torneo en vivo para todos",
        detalle:
          "Jugadores y público siguen punto a punto los partidos en juego, los resultados anteriores y la tabla, sin recargar la página.",
        estado: "incluido",
      },
      {
        titulo: "Informe final en Excel",
        detalle: "Resultados, equipos y movimientos de dinero en un archivo.",
        estado: "incluido",
      },
      {
        titulo: "Avisos por WhatsApp",
        detalle: "Recordatorio automático a cada equipo: \"su partido es a las 3:00 p. m.\".",
        estado: "proximamente",
      },
    ],
    referentes: [
      {
        fuente: "FIVB · Volleyball World",
        practica: "Planilla electrónica en tablet en lugar de papel desde 2015.",
        aqui: "El árbitro anota desde el celular y el resultado llega a la tabla sin transcribir.",
        estado: "incluido",
      },
      {
        fuente: "FIFA Connect",
        practica: "Un identificador único por jugador para detectar registros duplicados.",
        aqui: "Un jugador = un documento: el sistema avisa si aparece en dos equipos o dos categorías.",
        estado: "incluido",
      },
      {
        fuente: "Ligas amateur en EE. UU. (Playbook365, PlayHQ)",
        practica: "Revisión automática de las plantillas contra las reglas de elegibilidad.",
        aqui: "La inscripción no deja pasar un equipo con dos externos o sin mujeres.",
        estado: "incluido",
      },
      {
        fuente: "USA Volleyball · Volleyball Life",
        practica: "Exoneraciones digitales y resultados públicos sin iniciar sesión.",
        aqui: "Términos aceptados en línea y un enlace público con fixture y tabla para todos.",
        estado: "incluido",
      },
      {
        fuente: "FIVB · reglas de clasificación",
        practica: "Tabla por puntos de partido y desempate por cociente de puntos.",
        aqui: "La tabla se calcula sola: nadie suma a mano ni discute el desempate.",
        estado: "incluido",
      },
      {
        fuente: "Torneos en línea (start.gg)",
        practica: "Check-in con cuenta regresiva y W.O. automático si el equipo no se presenta.",
        aqui: "Llegada confirmada desde el celular y W.O. marcado al vencer la tolerancia.",
        estado: "proximamente",
      },
    ],
    pasos: [
      {
        titulo: "Configurar el torneo",
        detalle: "Categorías, reglas, premios y patrocinadores con el asistente.",
        tiempo: "10 min",
      },
      {
        titulo: "Publicar y compartir",
        detalle:
          "Un enlace para WhatsApp, Instagram y el código QR en el parque. Ahí todos siguen en vivo, sin recargar, los marcadores, resultados y posiciones.",
        tiempo: "1 min",
      },
      {
        titulo: "Aprobar equipos y registrar pagos",
        detalle: "La plataforma ya revisó las reglas; ustedes confirman el pago.",
        tiempo: "1 min por equipo",
      },
      {
        titulo: "Cerrar inscripciones y generar el fixture",
        detalle: "Un botón arma los partidos por categoría y cancha.",
        tiempo: "2 min",
      },
      {
        titulo: "Jugar cada partido",
        detalle: "Abrir el marcador, entregar el celular al árbitro y confirmar el resultado.",
        tiempo: "1 toque",
      },
      {
        titulo: "Cerrar el torneo",
        detalle: "Podio, premios entregados e informe final en Excel.",
        tiempo: "5 min",
      },
    ],
    necesitamos: [
      "Formato del torneo y cupo de cada categoría.",
      "Cómo se juega cada partido: sets y puntos.",
      "Qué se considera un \"referente local\".",
      "Cómo demuestra un jugador que es cliente.",
      "Si un jugador puede jugar en las dos categorías.",
      "Si la premiación se paga completa o depende de un mínimo de equipos.",
      "Logos de los patrocinadores.",
    ],
    contacto: { nombre: "Diego Cumbe", whatsapp: "" },
    vigencia: "Valores válidos hasta el 15 de noviembre de 2026.",
  },
];

export function getPropuesta(slug: string): Propuesta | null {
  return PROPUESTAS.find((p) => p.slug === slug) ?? null;
}

/** Equipos necesarios para cubrir la premiación solo con inscripciones. */
export function equiposParaCubrir(premios: number[], inscripcion: number): number | null {
  if (inscripcion <= 0) return null;
  const total = premios.reduce((s, v) => s + v, 0);
  return Math.ceil(total / inscripcion);
}
