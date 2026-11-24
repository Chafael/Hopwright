# Modelo documental: bitácora de envío (MongoDB)

Colección `bitacora_envio`, fuente de verdad de la bitácora de seguimiento.

## Estructura

- `idEnvio`: string `E-n`, único.
- `eventos[]`: lista de `{ tipo, fecha, detalle }`.

## Alimentación

- El procesador de eventos pendientes consume eventos de PostgreSQL (`ASIGNACION_CREADA`, `ENVIO_SALIO`, `ENVIO_ENTREGADO`) y los agrega a la bitácora.
- La escritura es idempotente: no inserta evento duplicado con mismo `tipo` y `fecha` para el mismo envío.
