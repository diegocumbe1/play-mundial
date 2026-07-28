# Plan — Vertical "Torneos deportivos"

> Documento vivo. Se actualiza al cerrar cada fase.
> Fecha de arranque: 2026-07-27. Segunda vertical de **Play Mundial**, después de
> Rifas. No la reemplaza: conviven en el mismo backoffice.

## Decisiones tomadas (locked)

1. **La plataforma es multi-producto.** El backoffice deja de llamarse "Rifas":
   la marca madre es **Play Mundial** y cada organizador ve las verticales que
   tenga habilitadas (`tenant_productos`).
2. **Se reutiliza todo el cimiento**: auth, `tenants`, `memberships`, RLS,
   `tenant_pago_config`, `plataforma_config`, ledger `cobros`, `ActionResult<T>`,
   zod, sistema de planes y componentes shadcn base-nova.
3. **La lógica de planes se extrajo a un servicio común** (`src/lib/planes.ts`)
   en vez de duplicar `activarRifa`. Rifas y torneos deciden y cobran igual;
   solo cambian el escalón de precio y la unidad de tamaño.
4. **MVP administrativo y financiero primero.** El fixture y los resultados son
   la siguiente fase: la pestaña ya existe, visible y deshabilitada.
5. **La inscripción pública nunca confirma ni cobra sola.** Entra como
   solicitud `pendiente`; confirmar el cupo y registrar el dinero son decisiones
   del organizador.
6. **Montos por definir.** Los escalones de torneo nacen en `0` en
   `plataforma_config`; los fija el superadmin en `/superadmin/settings`.

---

## Modelo de datos

### Productos por organizador
- **`tenant_productos`** — `tenant_id`, `producto` (`rifas` | `torneos`),
  `habilitado`, único por `(tenant_id, producto)`. RLS: el miembro consulta lo
  suyo, el superadmin escribe.
- Compatibilidad: la migración siembra filas para **todos los tenants
  existentes** y el helper hace *fail-open* solo para `rifas` (ningún
  organizador puede perder acceso a lo que ya estaba vendiendo).

### Dominio torneo
- **`torneos`** — identidad deportiva (`deporte`, `modalidad`, `categoria`,
  `rama`, `formato`), lugar y fechas, operación (`cupo_equipos`,
  `minimo_equipos`, `jugadores_por_equipo`, `duracion_partido_minutos`,
  `cantidad_canchas`), finanzas (`valor_inscripcion`, `premiacion_descripcion`,
  `reglamento`) y monetización (`cobro_tipo`, `activado_at`).
  Ciclo: `borrador` → `inscripciones` → `programado` → `en_curso` →
  `finalizado` | `cancelado`.
- **`equipos_torneo`** — el recurso escaso (≈ boletas de rifa). Datos del
  responsable, `estado` (`pendiente` | `confirmado` | `rechazado` | `retirado`),
  `monto_inscripcion`, `monto_pagado`, `metodo_pago`, `comprobante_url`,
  `consentimiento_datos`. Único por `(torneo_id, nombre)`.
- **`premios_torneo`** — la premiación **por puesto**: `puesto` (1 = campeón,
  2 = subcampeón…), `tipo` (`valor` | `producto`), `descripcion`, `valor`. Único
  por `(torneo_id, puesto)`. Cada torneo premia los puestos que quiera: solo el
  primero, los dos primeros o los que sean. Lectura pública (es lo que decide
  inscribirse). `torneos.premiacion_descripcion` queda como **nota** para lo que
  no es un puesto ("todos reciben medalla").
- **`gastos_torneo`** — categoría, descripción, cantidad × valor unitario,
  `valor_total`, `pagado`, `proveedor`. Es lo que convierte el módulo en una
  herramienta de rentabilidad y no en una planilla de inscritos.

### Aislamiento (RLS)
- `torneos`: `_tenant_rw` + lectura `anon` solo en
  `inscripciones|programado|en_curso|finalizado`.
- `premios_torneo`: `_tenant_rw` + lectura `anon` de los premios de torneos ya
  visibles.
- `equipos_torneo` y `gastos_torneo`: **sin política `anon`**. Llevan
  responsable, teléfono, correo, comprobantes y dinero. Lo público sale de
  `getTorneoPublico()` con service role, ya recortado.

---

## Privacidad

| Dato | Backoffice | Página pública |
|---|---|---|
| Nombre del equipo, escudo | ✅ | ✅ |
| Premiación por puesto | ✅ | ✅ |
| Equipo confirmado (sí/no) | ✅ | ✅ |
| Responsable, teléfono, correo | ✅ | ❌ |
| Monto pagado, método, comprobante | ✅ | ❌ |
| Gastos y utilidad | ✅ | ❌ |

`EquipoTorneoPublico` solo expone `id`, `nombre`, `escudo_url` y `confirmado`.

---

## Núcleo puro — `src/lib/torneos.ts`

Sin I/O, testeable, igual que `src/lib/rifa.ts`:

- `calcularIngresosTorneo` — proyectados, recaudados, por cobrar, % recaudado.
- `calcularGastosTorneo` — proyectados, pagados, pendientes.
- `calcularDashboardTorneo` — ocupación + dinero + utilidad proyectada y actual.
- `calcularPuntoEquilibrio(gastos, valorInscripcion)` — redondea hacia arriba,
  `null` si no es calculable (inscripción gratuita).
- `validarViabilidadTorneo(torneo, equipos, gastos, premios, ahora)` — alertas en
  lenguaje del organizador. La hora entra por parámetro para poder probarla.
- `valorPremiacion(premios)` — cuánto cuesta la premiación en dinero (los
  premios de tipo `producto` no suman: su costo va como gasto).
- `labelPuesto` / `apodoPuesto` — "1er puesto", "Campeón", "Subcampeón".
- `construirEquiposPublicos` — el corte seguro.
- `equiposVigentes` / `montoEsperadoEquipo` / `saldoEquipo` — reglas de cupo y
  de cobro (los rechazados y retirados liberan su lugar).

---

## Monetización

Se enchufa al modelo existente sin inventar mecánica nueva:

1. Suscripción vigente → publica sin cobrar.
2. Cupo gratuito disponible (tamaño ≤ `free_max_equipos` y dentro de
   `free_torneos_por_mes` / `free_torneos_total`) → publica como `gratis`.
3. Si no → **cobro pendiente** en el ledger; el torneo sigue en `borrador`.
4. El superadmin confirma → `confirmarCobro()` lo pasa a `inscripciones`.

Escalones por cupo de equipos: `precio_torneo_8`, `precio_torneo_16`,
`precio_torneo_32`, `precio_torneo_mas`. **Todos en 0 hasta que Diego los fije.**

---

## Rutas

| Ruta | Acceso | Qué es |
|---|---|---|
| `/admin/torneos` | owner | Lista con buscador, filtros por estado, equipos, ingresos y utilidad |
| `/admin/torneos/nuevo` | owner | Alta: general, operación, finanzas y premiación por puesto |
| `/admin/torneos/[id]` | owner | Dashboard con pestañas: Resumen · Equipos · Finanzas · Configuración (+ Fixture "Próximamente") |
| `/admin/torneos/[id]/editar` | owner | Edición |
| `/t/[slug]` | público | Landing de conversión + inscripción sin cuenta + OG dinámico |

---

## Estado de implementación (2026-07-27)

**Código escrito, `npm run lint` y `npm run build` en verde.** Falta lo que no
se hace desde el repo:

- [ ] **Aplicar las 4 migraciones** (`npm run migrate`):
      `20260727000000_tenant_productos.sql`, `20260727010000_torneos.sql`,
      `20260727020000_cobros_torneos.sql`, `20260728000000_premios_torneo.sql`.
- [ ] **Fijar los precios de torneo** en `/superadmin/settings` (hoy en 0).
- [ ] Revisar qué organizadores deben tener la vertical habilitada (por defecto
      la migración se la da a todos).

### Hecho
- [x] `tenant_productos` + RLS + helpers (`tieneProductoHabilitado`,
      `getProductosTenant`, `getProductosHabilitados`).
- [x] Gating en tres capas: tarjetas del panel, rutas y Server Actions.
- [x] Servicio común de planes (`resolverActivacion`) + refactor de `activarRifa`.
- [x] Ledger multi-producto (`cobros.producto`, `cobros.torneo_id`).
- [x] Migración del dominio torneo con RLS y privacidad.
- [x] Núcleo puro con rentabilidad, punto de equilibrio y alertas.
- [x] Premiación estructurada por puesto (backoffice, landing y vista previa).
- [x] Server Actions completas (CRUD, ciclo de vida, equipos, gastos, público).
- [x] Backoffice con pestañas y panel financiero.
- [x] Landing pública `/t/[slug]` con inscripción sin cuenta.
- [x] Header "Play Mundial" + menú "Nueva rifa / Nuevo torneo".
- [x] Controles de productos por organizador en `/superadmin`.

---

## Siguientes fases

### Fase 2 · Fixture y resultados
- Tabla `encuentros` (`torneo_id`, `tenant_id`, fase, jornada, equipos, fecha,
  cancha, marcador, estado). El enum `public.estado_partido` del Mundial ya
  existe y se reutiliza.
- `generarFixture(equipos, formato)` y `calcularTabla(encuentros, reglas)` en el
  núcleo puro.
- Pestaña "Fixture y resultados" (hoy deshabilitada) + fixture y tabla públicos.
- Riesgos a validar antes de codear: doble-booking de cancha/horario (necesita
  su propio índice o constraint de exclusión), reprogramaciones en cascada y
  criterios de desempate configurables por torneo.

### Fase 3 · Planilla y operación
- Jugadores por equipo (documento, dorsal, foto), carnet, sanciones.
- Sedes y horarios; web-push "tu partido es a las 3pm".

### Fase 4 · Cruce con las otras verticales
- Polla interna del torneo (la tabla `apuestas` ya existe).
- Rifa asociada al torneo para financiar la premiación.
- Estadísticas de goleadores.

### Deuda conocida
- El dashboard de `/superadmin` cuenta **solo rifas**: falta sumar torneos a las
  métricas del mes.
- `/precios` sigue hablando solo de rifas; se actualiza cuando haya montos.
- No hay flyer PNG del torneo (el de rifas usa `next/og`; se puede clonar).
- Sin export xlsx de equipos y gastos.
