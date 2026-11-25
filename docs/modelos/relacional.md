# Modelo relacional (PostgreSQL)

Fuente de verdad operativa para usuarios, clientes, conductores, ciudades, vehículos, envíos, asignaciones y eventos pendientes.

## Tablas

- `usuario`: `id_usuario` PK, `nombre`, `correo` UNIQUE, `password_hash`, `rol` (`despachador`,`administrador`), `activo`, `creado_en`.
- `cliente`: `id_cliente` PK, `razon_social`, `rfc` UNIQUE, `telefono`, `correo`.
- `conductor`: `id_conductor` PK, `nombre`, `licencia` UNIQUE, `telefono`, `activo`.
- `ciudad`: `id_ciudad` PK (clave INEGI 5 dígitos), `nombre`, `estado`.
- `vehiculo`: `placa` PK, `tipo` (`Camión`,`Tráiler`,`Tren`), `capacidad_kg > 0`, `estado` (`Disponible`,`En ruta`,`En taller`), `id_conductor` FK nullable.
- `envio`: `id_envio` PK con formato `E-<dígitos>` (el mismo que exigen los validadores de `manifiestos` y `bitacora_envio` en MongoDB), `id_cliente` FK, `id_ciudad_origen` FK, `id_ciudad_destino` FK distinta al origen, `peso_kg > 0`, `prioridad` (`Normal`,`Urgente`), `estado` (`Pendiente`,`Asignado`,`En camino`,`Entregado`,`Cancelado`), `fecha_salida`, `creado_en`.
- `asignacion`: `id_asignacion` PK, `id_envio` FK, `placa` FK, `fecha_asignacion`, `fecha_fin`, `activa`. Índices únicos parciales: una activa por vehículo y una activa por envío.
- `eventos_pendientes`: outbox para sincronización con Neo4j/MongoDB. Campos: `id`, `tipo`, `payload` JSONB, `estado` (`pendiente`,`aplicado`,`fallido`), `intentos`, `ultimo_error`, `creado_en`, `aplicado_en`.

## Reglas clave

- Integridad referencial por FKs.
- CHECK para dominios, pesos/capacidades positivas y origen distinto de destino.
- Transacciones con `enTransaccion()` para asignación y cambios de estado con outbox.
- `SELECT ... FOR UPDATE` en asignación de vehículo para evitar doble asignación concurrente.
