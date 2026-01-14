# SMOKE TESTS - Queue Demo (0.1 -> 0.6.3)

Base path: /projects/queue/demo/

## 1. Rutas basicas (navegacion)
Abrir cada URL y confirmar que no hay errores 404 de assets ni errores JS en consola.

- [ ] `/` (redirect -> `/kiosco/`)
- [ ] `/kiosco/`
- [ ] `/kiosco/confirmacion/`
- [ ] `/kiosco/ticket/`
- [ ] `/pantalla/`
- [ ] `/operador/`
- [ ] `/operador/triaje/`
- [ ] `/turno/`
- [ ] `/turno/?ticket=A-001`
- [ ] `/turno/?dni=12345678A`
- [ ] `/admin/`
- [ ] `/analitica/`

## 2. Flujo kiosco (0.2 + 0.3)
Objetivo: crear un ticket desde cero.

Pasos:
1. Ir a `/kiosco/`.
2. Pulsar teclado: `12345678A` -> `Confirmar`.
3. En `/kiosco/confirmacion/`: seleccionar "Sin Cita" o una cita mock.
4. Pulsar "Confirmar llegada".
5. En `/kiosco/ticket/`: ver "Imprimiendo...", esperar ~1.2s -> ver ticket generado.
6. Pulsar "Finalizar" -> vuelve a inicio.

EXPECTED:
- Timeout 60s vuelve a `/kiosco/`.
- Impresion simula texto durante ~1.2s.
- Ticket real (A/E/C/V) desde mockStore.

## 3. Citas multiples (0.3)
Pasos:
1. DNI `12345678A` en kiosco.
2. Ver selector con varias citas.
3. Confirmar llegada.

EXPECTED:
- Ticket creado para cada cita seleccionada.

## 4. Turno lookup (0.4)
Pasos:
1. Abrir `/turno/?ticket=A-001`.
2. Probar busqueda manual de ticket.
3. Probar busqueda por DNI.

EXPECTED:
- Estados correctos (Waiting/Called/Serving) + autorefresco cada 10s.
- URL shareable (se mantiene el parametro de busqueda).

## 5. Triaje (0.5)
Pasos:
1. Abrir `/operador/triaje/`.
2. Seleccionar ticket, marcar ROJO.
3. Volver a `/operador/`.
4. Marcar preferente.

EXPECTED:
- Reorden en `/operador/` (ROJO arriba).
- Preferente queda delante de normales pero detras de ROJO/NARANJA.
- `/turno/` refleja el triaje.

## 6. Cross-tab sync (0.6)
Pasos:
1. Abrir `/pantalla/` y `/turno/` en una pestana.
2. Abrir `/operador/` en otra pestana.
3. Cambiar estado de un ticket.

EXPECTED:
- `/pantalla/` y `/turno/` se actualizan instantaneo (sin esperar 3s).

## 7. TV ticker (0.6.3)
EXPECTED:
- El mensaje inferior se desplaza continuamente.
- Se pausa durante callout y se reanuda al ocultarse.

## Evidencias
- [ ] Captura: pantalla ticker (ruta/archivo)
- [ ] Captura: overlay LLAMADO (ruta/archivo)
- [ ] Captura: overlay EN ATENCION (ruta/archivo)
- [ ] Grabacion 30-45s: cross-tab + callouts + ticker (ruta/archivo)
