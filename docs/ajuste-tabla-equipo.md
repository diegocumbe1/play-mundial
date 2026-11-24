# Ajuste manual de PJ / PG en la tabla de un equipo

## Para qué sirve
Cuando un equipo se retira y deja un partido ya jugado, su rival conserva ese resultado y queda con un partido (y una victoria) de más que los demás del grupo.

Este ajuste le resta PJ y/o PG **solo en lo que se muestra**. No toca:
- los puntos
- los sets
- los partidos guardados
- a ningún otro equipo

> Ejemplo real: Fase 4 se retiró y dejó el partido contra Desnivel (3-0, vie 6 nov). Desnivel quedó con PJ 4 · PG 2. Con el ajuste queda PJ 3 · PG 1 · PP 2 · 6 pts.

## Cómo funciona
- El ajuste se guarda en `torneos.reglas.tabla.ajustes`, con esta forma:
  ```json
  { "<id_del_equipo>": { "pj": -1, "pg": -1 } }
  ```
- `calcularTabla` ([src/lib/torneo-fixture.ts](../src/lib/torneo-fixture.ts)) lo suma al final, solo a PJ y PG, y nunca deja el resultado por debajo de 0.
- Lo ven la tabla del panel, la página pública, la ficha del equipo y la clasificación a eliminatorias.
- Es un valor **absoluto**: correr el script dos veces deja lo mismo. No se acumula.
- PG sí cuenta en el desempate. Los puntos y los sets no cambian, así que en general el orden de la tabla no se mueve.

## Desde la pantalla (sin script)
Panel del organizador → **Equipos** → abrir la ficha del equipo → debajo de su posición, **«Ajustar PJ / PG en la tabla»**.

- Dos campos: PJ y PG. Escribe `-1` para restar uno.
- Muestra cómo quedará la fila antes de guardar y avisa si PG + PP no suma PJ.
- **Guardar ajuste** o **Quitar ajuste** (vuelve a lo calculado).
- Acción: `ajustarTablaEquipo` en [src/actions/torneos.ts](../src/actions/torneos.ts). Guarda en el mismo dato que el script, así que ambos se pueden mezclar.

## Orden para usarlo (script)
1. Subir el código (commit + push) y esperar el despliegue.
   - Si aún no hay ajustes guardados, no cambia nada: es seguro subirlo solo.
2. Probar sin escribir (`--dry`).
3. Correr el script de verdad.
4. Recargar la página del torneo.

## Comandos
Todos se corren desde la raíz del proyecto. Usan la base de datos de `.env.local`: confirma que es la de producción antes de escribir.

**Ver el antes y el después, sin escribir nada:**
```bash
node --env-file=.env.local scripts/ajustar-tabla-equipo.mjs \
  --torneo 46c256d8-189d-427e-b90c-8fc23126128d \
  --equipo "Desnivel" --pj -1 --pg -1 --dry
```

**Aplicar:**
```bash
node --env-file=.env.local scripts/ajustar-tabla-equipo.mjs \
  --torneo 46c256d8-189d-427e-b90c-8fc23126128d \
  --equipo "Desnivel" --pj -1 --pg -1
```

**Revertir (borra el ajuste de ese equipo):**
```bash
node --env-file=.env.local scripts/ajustar-tabla-equipo.mjs \
  --torneo 46c256d8-189d-427e-b90c-8fc23126128d \
  --equipo "Desnivel" --pj 0 --pg 0
```

**Cambiar el valor:** vuelve a correrlo con otros números. Reemplaza el anterior.

### Opciones del script
| Opción | Qué hace |
|---|---|
| `--torneo <id>` | Torneo (obligatorio). |
| `--equipo "<nombre o id>"` | Nombre sin importar mayúsculas, o el id. Si hay dos con el mismo nombre, usa el id. |
| `--pj <n>` | Cuánto se suma a PJ (negativo = restar). Por defecto 0. |
| `--pg <n>` | Cuánto se suma a PG. Por defecto 0. |
| `--dry` | No escribe: solo muestra lo que haría. |

Script: [scripts/ajustar-tabla-equipo.mjs](../scripts/ajustar-tabla-equipo.mjs)

## Qué verificar después de aplicarlo
- Desnivel: **PJ 3 · PG 1 · PP 2 · 6 pts**. Sigue 5° (Fenix Squad tiene 5).
- PG + PP = PJ, para que la tabla cuadre. Si ajustas PJ, ajusta también PG o PP.
- Los demás equipos del grupo no cambiaron.

## Riesgos y límites
- **Guardar reglas puede borrarlo.** Si alguien guarda las reglas desde "Configurar torneo" con un formulario que no conserve `ajustes`, el ajuste se pierde. Revisa la tabla después de guardar reglas.
- **No está en git.** Es un dato de la base de datos. Revertir el commit no lo deshace, pero tampoco hace falta: sin el código nuevo el dato se ignora.
- **La pantalla solo está en el panel de Equipos.** En la ficha que se abre desde la tabla pública o desde Partidos no aparece; el visitante nunca la ve.

## Alternativa descartada: borrar el partido
Se pensó en borrar el partido Fase 4 vs Desnivel. Como Fase 4 está retirado, solo afectaría a Desnivel, pero le quitaría también esos 3 puntos y lo bajaría al 7° puesto, lo que cambia quién va a consolación. Por eso se prefirió conservar los puntos y ajustar solo PJ y PG.
