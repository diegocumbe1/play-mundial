# Guía superadmin: aprobar cuentas y habilitar rifas pagadas

Todo se hace desde **`/superadmin`** (Panel de plataforma). Los precios y tus datos de pago están en **`/superadmin/settings`** (botón **Precios**).

Hay **dos llaves distintas**. Un organizador solo publica cuando tiene las dos:

| Llave | Qué controla | Dónde la das |
|---|---|---|
| 1. **Cuenta aprobada** | Que la persona pueda publicar *algo* en la plataforma | `/superadmin` → **Cuentas nuevas** → **Aprobar** |
| 2. **Rifa pagada** | Que *esa rifa en particular* se active (cuando no le alcanza el plan gratis) | `/superadmin` → **Cobros pendientes** → **Confirmar** |

---

## 0. Antes de empezar (una sola vez)

En **`/superadmin/settings`** revisa:

- **Medios de pago de la plataforma**: Nequi, cuenta, llave Bre-B, QR y **WhatsApp**. Es lo que ve el organizador cuando tiene que pagarte, y el WhatsApp es el botón de "Escribirnos" mientras su cuenta está en revisión.
- **Precios**:
  - Cobro por rifa: **1% de lo que recauda si vende todo**, mínimo **$8.000**.
  - Tope según tamaño: **$29.900** hasta 1.000 números, **$79.900** hasta 5.000 y **$149.900** hasta 10.000.
  - Gratis: la **primera rifa** de cada cuenta, de hasta **100 números**.
  - PRO: el valor mensual y cuántas rifas cubre por mes.

> El precio de una rifa **queda congelado** en el momento en que el organizador la activa. Si cambias tarifas después, los cobros que ya existen no se mueven.

---

## 1. Llega un usuario nuevo

1. La persona se registra con correo y **WhatsApp**. Un mismo número no puede abrir dos cuentas: así no reinicia la rifa gratis.
2. Su cuenta nace **pendiente**. Puede entrar y armar su rifa en **borrador**, pero nadie la ve.
3. Si intenta **Activar y publicar**, le sale *"Tu cuenta está en revisión"* con un botón para escribirte por WhatsApp. **No se crea ningún cobro todavía.**
4. Además debe **verificar su correo**: sin eso no puede registrar ni vender números, aunque esté aprobada.

### Tú: aprobar o rechazar

En **`/superadmin`**, la primera sección es **Cuentas nuevas**, resaltada cuando hay gente esperando. Cada solicitud muestra:

- nombre, correo y WhatsApp (con botón para escribirle),
- **cuántas rifas dejó en borrador**, que es buena señal de que va en serio.

Acciones:

- **Aprobar**: la cuenta pasa a **activa** y desde ese momento puede activar rifas.
- **Rechazar**: no puede publicar nada.

> Sugerencia: antes de aprobar, escríbele por WhatsApp. Confirma quién es, qué va a rifar y recuérdale que **los permisos legales de la rifa (Coljuegos o la entidad territorial) y los impuestos son responsabilidad suya**: la plataforma solo gestiona y organiza.

---

## 2. El organizador activa una rifa: ¿paga o no?

Cuando la cuenta ya está aprobada y toca **Activar y publicar**, el sistema decide solo, en este orden:

1. **¿Tiene PRO vigente y le quedan rifas del mes?** Se activa sin cobro.
2. **¿Es su primera rifa y tiene 100 números o menos?** Se activa gratis.
3. **Si no**, se crea un **cobro pendiente** con el monto calculado. La rifa **sigue en borrador** y a él le aparece *"Esta rifa requiere pago: transfiere $X"*, con tus datos de pago.

Ejemplos de cuánto le sale:

| Rifa | Cobro |
|---|---|
| 100 números a $15.000 (no es la primera) | $15.000 |
| 1.000 números a $10.000 | $29.900 |
| 10.000 números a $1.500 (la moto) | $149.900 |

---

## 3. Te paga: habilitar la rifa

1. El organizador te transfiere y te manda el comprobante por WhatsApp.
2. **Verifica que el dinero llegó** a tu Nequi o cuenta. No te bases solo en el pantallazo.
3. En **`/superadmin`** → **Cobros pendientes**, busca el cobro por **monto** y tipo ("Pago por rifa").
4. Toca **Confirmar**.

Al confirmar, el sistema:

- marca el cobro como **pagado**,
- **activa la rifa automáticamente**: queda pública y empieza a vender.

No tienes que hacer nada más. El dinero confirmado aparece en las métricas **Valor generado** y **Pagos confirmados** del mes.

> ⚠️ La lista de cobros pendientes muestra el **monto y el tipo**, no el nombre del organizador. Si dos personas te deben el mismo valor, cruza con el WhatsApp o con la tabla de organizadores antes de confirmar.

---

## 4. Suscripción PRO

- El organizador la pide desde **Planes** (`/precios` → **Elegir suscripción**). Eso crea un cobro pendiente de tipo **Suscripción**.
- Cuando te paga, la confirmas igual que una rifa (**Cobros pendientes → Confirmar**). Su plan pasa a **PRO por un mes**: si ya tenía PRO vigente, el mes se suma al vencimiento actual.
- Si tenía una rifa esperando pago, se activa con la misma confirmación.
- PRO cubre hasta N rifas al mes (lo defines en settings). Si se pasa, la rifa extra se cobra aparte y vuelve a caer en **Cobros pendientes**.

### Cambiar el plan a mano

En la **tabla de organizadores** de `/superadmin` puedes cambiarle el plan a alguien directamente (gratis, pago por rifa o suscripción), por ejemplo para una cortesía o un acuerdo especial. Poner **suscripción** a mano le da un mes desde hoy, o desde su vencimiento si sigue vigente.

---

## 5. Bloquear a alguien

En la tabla de organizadores puedes **bloquear** una cuenta. Una cuenta que no está activa **no puede activar rifas nuevas**, porque es la misma revisión que se hace con las cuentas pendientes.

---

## Resumen rápido

```
Usuario se registra ──► Cuenta PENDIENTE (arma borradores, no publica)
                              │
              Tú: /superadmin → Cuentas nuevas → APROBAR
                              │
Usuario: "Activar y publicar"
   ├─ PRO vigente con cupo ........... se activa sola
   ├─ 1ª rifa y ≤ 100 números ........ se activa gratis
   └─ si no .......................... COBRO PENDIENTE (rifa en borrador)
                                              │
                    Usuario te transfiere y manda comprobante
                                              │
              Tú: verificas el dinero → /superadmin → Cobros pendientes → CONFIRMAR
                                              │
                                   Rifa ACTIVA y pública ✅
```
