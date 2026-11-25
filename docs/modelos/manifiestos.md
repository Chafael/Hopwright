# Modelo documental: manifiestos (MongoDB)

Colección `manifiestos`, fuente de verdad del manifiesto de carga por envío.

## Estructura

- `idEnvio`: string `E-n`, único.
- `tipoCarga`: `general | refrigerada | peligrosa`.
- `articulos[]`: `{ descripcion, cantidad >= 1, pesoKg > 0 }`.
- `restriccionesRuta`: `{ evitarTerraceria: bool, tiempoMaxMin: number|null }`.
- `creadoEn`: date.

## Campos por tipo

- `refrigerada`: requiere `tempMinC`, `tempMaxC`, `tiempoMaxMin`.
- `peligrosa`: requiere `claseUN` (1-9), `numeroONU`, `hojaSeguridad`, `telefonoEmergencia`.
- `general`: sin campos especiales obligatorios.

## Validación

- `$jsonSchema` estricto en `database/document/validators/manifiestos.js`.
- Índice único por `idEnvio`.
- El servicio verifica que el envío exista en PostgreSQL antes de insertar.
