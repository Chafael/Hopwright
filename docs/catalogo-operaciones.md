# Entregable 5. Catálogo de operaciones y consultas

Cada operación tiene su identificador, para qué sirve, qué bases usa, qué recibe y cómo se valida, qué regresa y sus casos normales, límite y de error. La evidencia de ejecución está en [pruebas/catalogo-evidencia.md](pruebas/catalogo-evidencia.md): la genera `npm run catalogo` (desde `backend/`, con los contenedores arriba), que manda cada caso como una petición HTTP real, guarda lo que respondió la API y lo compara con lo esperado. Lo que crea esa corrida se borra de las tres bases al terminar.

Los identificadores van por modelo: R para PostgreSQL, D para MongoDB, G para Neo4j e I para las operaciones que necesitan más de una base. Los casos se llaman igual en este documento y en la evidencia (R04-N1 es el caso normal 1 de OP-R04; L es límite, E es error y V es una verificación directa en la base).

Convenciones que aplican a todas las operaciones:

- Formato: JSON de entrada y salida. Los errores siempre tienen la forma `{ error, mensaje, statusCode }` y a veces `detalles`.
- Sesión: las consultas (`GET`) son públicas. Las escrituras piden `Authorization: Bearer <token>`; sin token responden 401 y con un rol que no alcanza, 403.
- Validación en dos niveles: Fastify revisa tipos, formatos y rangos con JSON Schema antes de entrar al servicio (400); el servicio revisa las reglas de negocio (400, 404 o 409); y cada base tiene su última barrera (`CHECK` y llaves en PostgreSQL, `$jsonSchema` en MongoDB).
- Si una base no responde, la API contesta 503 en lugar de un error genérico.

El contrato completo con ejemplos está en Swagger: `http://localhost:3000/docs`.

## Resumen

| Id | Operación | Endpoint | Bases |
|---|---|---|---|
| OP-R01 | Iniciar sesión | `POST /auth/login` | PostgreSQL |
| OP-R02 | Registrar cliente | `POST /clientes` | PostgreSQL |
| OP-R03 | Registrar vehículo | `POST /vehiculos` | PostgreSQL, evento a Neo4j |
| OP-R04 | Registrar envío | `POST /envios` | PostgreSQL |
| OP-R05 | Asignar vehículo | `POST /envios/{id}/asignacion` | PostgreSQL, evento a MongoDB |
| OP-R06 | Salida, entrega y cancelación | `POST /envios/{id}/salida`, `/entrega`, `/cancelacion` | PostgreSQL, eventos a MongoDB y Neo4j |
| OP-R07 | Consultar envíos | `GET /envios`, `GET /envios/{id}` | PostgreSQL |
| OP-D01 | Registrar manifiesto | `POST /envios/{id}/manifiesto` | MongoDB (revisa el envío en PostgreSQL) |
| OP-D02 | Consultar manifiesto | `GET /envios/{id}/manifiesto` | MongoDB (revisa el envío en PostgreSQL) |
| OP-D03 | Consultar bitácora | `GET /envios/{id}/bitacora` | MongoDB (revisa el envío en PostgreSQL) |
| OP-D04 | Reportar incidente | `POST /incidentes` | MongoDB y réplica en Neo4j |
| OP-D05 | Agregar evidencia | `POST /incidentes/{id}/evidencias` | MongoDB |
| OP-D06 | Consultar incidentes | `GET /incidentes`, `GET /incidentes/{id}` | MongoDB |
| OP-D07 | Cerrar incidente | `PATCH /incidentes/{id}/cerrar` | MongoDB y réplica en Neo4j |
| OP-G01 | Ruta más corta (C1) | `GET /rutas` | Neo4j |
| OP-G02 | Exploración paso a paso | `GET /rutas/exploracion` | Neo4j |
| OP-G03 | Camión contra camión y tren (C2) | `GET /rutas/camion-tren` | Neo4j |
| OP-G04 | Ciudades aisladas (C4) | `GET /red/ciudades-aisladas` | Neo4j |
| OP-G05 | Mapa de la red | `GET /red/mapa` | Neo4j |
| OP-G06 | Ubicación de un vehículo | `GET` y `PATCH /vehiculos/{placa}/ubicacion` | Neo4j (y PostgreSQL para el tipo) |
| OP-I01 | Flujo integrado: ruta de un envío | `GET /envios/{id}/ruta` | PostgreSQL, MongoDB y Neo4j |
| OP-I02 | Envíos afectados por un incidente (C5) | `GET /incidentes/{id}/envios-afectados` | MongoDB, PostgreSQL y Neo4j |
| OP-I03 | Alta de ciudad replicada al grafo | `POST /ciudades` | PostgreSQL y Neo4j por evento |
| OP-I04 | Reconciliación de réplicas | `POST /admin/reconciliar` | PostgreSQL, MongoDB y Neo4j |
| OP-I05 | Estado de las bases | `GET /health` | PostgreSQL, MongoDB y Neo4j |

## Operaciones del modelo relacional

### OP-R01. Iniciar sesión

Propósito: obtener el token con el que el despachador o el administrador hacen cambios.

Bases: PostgreSQL (tabla `usuario`).

Entrada: `POST /auth/login` con `{ correo, password }`, los dos obligatorios. La contraseña se compara con el hash bcrypt guardado; solo entran usuarios con `activo = true`.

Salida: 200 con `{ token }`. El token es un JWT con `idUsuario`, `rol` y `correo`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R01-N1 | normal | despachador con su contraseña | 200 y un JWT |
| R01-N2 | normal | administrador con su contraseña | 200 y un JWT |
| R01-L1 | límite | token de despachador en `POST /ciudades`, que es solo de administrador | 403 |
| R01-L2 | límite | `POST /envios` sin token | 401 |
| R01-E1 | error | contraseña incorrecta | 401 |
| R01-E2 | error | correo que no existe | 401 con el mismo mensaje que R01-E1, para no revelar qué correos existen |
| R01-E3 | error | sin contraseña | 400 |

Evidencia: [OP-R01 en la evidencia](pruebas/catalogo-evidencia.md#op-r01-iniciar-sesión).

### OP-R02. Registrar cliente

Propósito: dar de alta la empresa que manda los envíos.

Bases: PostgreSQL (tabla `cliente`, `rfc` es `UNIQUE`).

Entrada: `POST /clientes` (despachador o administrador) con `razonSocial` (obligatoria, no vacía), `rfc` (obligatorio, mínimo 5 caracteres), `telefono` y `correo` opcionales. El RFC se guarda sin espacios y en mayúsculas.

Salida: 201 con `{ idCliente, razonSocial, rfc, telefono, correo }`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R02-N1 | normal | cliente con RFC de 12 caracteres | 201 |
| R02-L1 | límite | RFC de 5 caracteres en minúsculas | 201 y el RFC guardado en mayúsculas |
| R02-E1 | error | el RFC de R02-N1 escrito en minúsculas | 409, porque ya existe al normalizarlo |
| R02-E2 | error | RFC de 4 caracteres | 400 |

Evidencia: [OP-R02 en la evidencia](pruebas/catalogo-evidencia.md#op-r02-registrar-cliente).

### OP-R03. Registrar vehículo

Propósito: dar de alta un camión, tráiler o tren y que el grafo lo conozca para poder ubicarlo.

Bases: PostgreSQL (tabla `vehiculo` y `eventos_pendientes`); Neo4j recibe la placa por el evento `VEHICULO_GUARDADO`.

Entrada: `POST /vehiculos` (solo administrador) con `placa`, `tipo` (`Camión`, `Tráiler` o `Tren`), `capacidadKg` (mayor que 0), `estado` (`Disponible`, `En ruta` o `En taller`) e `idConductor` opcional, que debe existir. El alta y el evento van en la misma transacción.

Salida: 201 con el vehículo. Unos segundos después (o al correr el procesador) aparece `(:Vehiculo {placa})` en Neo4j.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R03-N1 | normal | camión de 9,000 kg disponible | 201 |
| R03-V1 | verificación | `GET /vehiculos/{placa}/ubicacion` antes de aplicar el evento | 404: el grafo todavía no conoce la placa |
| R03-V2 | verificación | la misma consulta después del procesador de eventos | 200 con `punto: null` (ya está en Neo4j, sin ubicación) |
| R03-L1 | límite | capacidad de 0 kg | 400 |
| R03-E1 | error | placa CHP-1001, que ya existe | 409 |
| R03-E2 | error | tipo `Avión` | 400 |

Evidencia: [OP-R03 en la evidencia](pruebas/catalogo-evidencia.md#op-r03-registrar-vehículo).

### OP-R04. Registrar envío

Propósito: registrar el envío que pide un cliente, de una ciudad a otra.

Bases: PostgreSQL (tabla `envio`, con llaves a `cliente` y `ciudad`).

Entrada: `POST /envios` (despachador o administrador) con `idEnvio` (formato `E-<dígitos>`), `idCliente` (debe existir), `idCiudadOrigen` e `idCiudadDestino` (claves INEGI de 5 dígitos que existan y sean distintas), `pesoKg` (mayor que 0) y `prioridad` (`Normal` o `Urgente`).

Salida: 201 con el envío en estado `Pendiente`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R04-N1 | normal | 9,000 kg de Tuxtla a Comitán, urgente | 201, estado `Pendiente` |
| R04-L1 | límite | origen igual al destino | 400 |
| R04-L2 | límite | peso de 0 kg | 400 |
| R04-E1 | error | cliente 999999 | 400 |
| R04-E2 | error | el mismo `idEnvio` de R04-N1 | 409 |
| R04-E3 | error | `idEnvio` = `ENVIO-1` | 400 |

Evidencia: [OP-R04 en la evidencia](pruebas/catalogo-evidencia.md#op-r04-registrar-envío).

### OP-R05. Asignar vehículo a un envío

Propósito: decidir qué vehículo lleva el envío. Es la operación que más depende de la integridad transaccional.

Bases: PostgreSQL (tablas `envio`, `vehiculo`, `asignacion` y `eventos_pendientes`); MongoDB recibe el evento `ASIGNACION_CREADA` en la bitácora.

Entrada: `POST /envios/{id}/asignacion` (despachador o administrador) con `{ placa }`. En una transacción se bloquean con `FOR UPDATE` el envío y luego el vehículo, y se revisa que el envío esté `Pendiente`, que el vehículo exista, esté `Disponible` y aguante el peso (`capacidadKg >= pesoKg`), y que ninguno tenga ya una asignación activa.

Salida: 201 con la asignación. El envío pasa a `Asignado` y el vehículo a `En ruta`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R05-E1 | error | CHP-1006 (8,000 kg) para el envío de 9,000 kg | 409, sin cambiar nada |
| R05-E2 | error | CHP-1004, que está en taller | 409 |
| R05-E3 | error | placa que no existe | 404 |
| R05-L1 | límite | el camión de prueba, con capacidad exactamente igual al peso | 201 |
| R05-E4 | error | asignar otra vez el mismo envío | 409 |
| R05-V1 | verificación | estados en PostgreSQL después de R05-L1 | envío `Asignado`, vehículo `En ruta` y evento `ASIGNACION_CREADA` |

La prueba `tests/integration/asignaciones.concurrentes.test.ts` manda dos asignaciones del mismo envío al mismo tiempo: una gana y la otra recibe 409.

Evidencia: [OP-R05 en la evidencia](pruebas/catalogo-evidencia.md#op-r05-asignar-vehículo-a-un-envío).

### OP-R06. Salida, entrega y cancelación de un envío

Propósito: mover el envío por su ciclo de vida: `Pendiente`, `Asignado`, `En camino`, `Entregado` o `Cancelado`.

Bases: PostgreSQL; por eventos, MongoDB (bitácora) y Neo4j (al entregar, el camión queda en la ciudad de destino).

Entrada: `POST /envios/{id}/salida`, `/entrega` o `/cancelacion` (despachador o administrador), sin cuerpo. Salida solo desde `Asignado`; entrega solo desde `En camino`, y libera el vehículo; cancelación solo desde `Pendiente` o `Asignado`, y también libera el vehículo.

Salida: 200 con el envío en su nuevo estado. Cada cambio deja su evento (`ENVIO_SALIO`, `ENVIO_ENTREGADO`, `ENVIO_CANCELADO`).

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R06-N1 | normal | salida del envío asignado | 200, `En camino` |
| R06-N2 | normal | entrega | 200, `Entregado` |
| R06-L1 | límite | entregar dos veces | 409 |
| R06-E1 | error | cancelar un envío entregado | 409 |
| R06-E2 | error | salida de un envío que no existe | 404 |
| R06-V1 | verificación | ubicación del camión después del procesador de eventos | en Comitán, el destino del envío |

Evidencia: [OP-R06 en la evidencia](pruebas/catalogo-evidencia.md#op-r06-salida-entrega-y-cancelación-de-un-envío).

### OP-R07. Consultar envíos

Propósito: la lista de la pantalla de Envíos y el detalle de uno.

Bases: PostgreSQL.

Entrada: `GET /envios?estado=` (filtro opcional) y `GET /envios/{id}` (formato `E-<dígitos>`).

Salida: 200 con una lista de envíos o con uno solo: `idEnvio`, `idCliente`, origen, destino, `pesoKg`, `prioridad`, `estado`, `fechaSalida`, `creadoEn`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| R07-N1 | normal | `?estado=Pendiente` | 200, todos pendientes |
| R07-N2 | normal | el envío de prueba | 200, `Entregado` |
| R07-L1 | límite | `?estado=Extraviado` | 200 y lista vacía |
| R07-E1 | error | `E-999999` | 404 |
| R07-E2 | error | `X1` | 400 |

Evidencia: [OP-R07 en la evidencia](pruebas/catalogo-evidencia.md#op-r07-consultar-envíos).

## Operaciones del modelo documental

### OP-D01. Registrar manifiesto de carga

Propósito: describir qué lleva el envío. Cada tipo de carga trae campos distintos y de ahí salen las restricciones de la ruta.

Bases: MongoDB (colección `manifiestos`, validador `$jsonSchema` con `oneOf` por tipo e índice único `idEnvio_unico`); antes revisa en PostgreSQL que el envío exista.

Entrada: `POST /envios/{id}/manifiesto` (despachador o administrador) con `tipoCarga` y `articulos` (al menos uno, cada uno con `descripcion`, `cantidad >= 1` y `pesoKg > 0`). Según el tipo:

- `general`: puede traer `restriccionesRuta`.
- `refrigerada`: `tempMinC`, `tempMaxC` y `tiempoMaxMin` obligatorios.
- `peligrosa`: `claseUN` (1 a 9), `numeroONU`, `hojaSeguridad` y `telefonoEmergencia` obligatorios; la ruta evitará terracería.

Salida: 201 con el documento guardado, incluyendo `restriccionesRuta` calculadas.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D01-L1 | límite | carga peligrosa con `claseUN: 10` | 400 |
| D01-E1 | error | carga peligrosa sin `numeroONU` | 400 |
| D01-E2 | error | envío que no existe en PostgreSQL | 404 |
| D01-N1 | normal | carga peligrosa clase 3 con dos artículos | 201 |
| D01-E3 | error | segundo manifiesto para el mismo envío | 409 |
| D01-V1 | verificación | `insertOne` directo en MongoDB de un manifiesto peligroso sin artículos ni datos de seguridad | MongoDB lo rechaza con el código 121 |

Evidencia: [OP-D01 en la evidencia](pruebas/catalogo-evidencia.md#op-d01-registrar-manifiesto-de-carga).

### OP-D02. Consultar manifiesto

Propósito: ver la carga de un envío.

Bases: MongoDB; revisa el envío en PostgreSQL.

Entrada: `GET /envios/{id}/manifiesto`.

Salida: 200 con el documento completo.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D02-N1 | normal | el envío de prueba | 200, `peligrosa`, clase 3 |
| D02-L1 | límite | E-105, que existe pero no tiene manifiesto | 404 con el mensaje "no tiene manifiesto" |
| D02-E1 | error | `E-999999` | 404 |

Evidencia: [OP-D02 en la evidencia](pruebas/catalogo-evidencia.md#op-d02-consultar-manifiesto).

### OP-D03. Consultar bitácora de un envío

Propósito: el historial del envío en un solo documento, ordenado por fecha.

Bases: MongoDB (colección `bitacora_envio`); revisa el envío en PostgreSQL. La escriben los eventos que nacen en PostgreSQL.

Entrada: `GET /envios/{id}/bitacora`.

Salida: 200 con `{ idEnvio, eventos: [{ tipo, fecha, detalle }] }`. Si el envío existe pero no tiene eventos, `eventos` viene vacío.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D03-N1 | normal | el envío de prueba después de entregarlo | 200 con `ASIGNACION_CREADA`, `ENVIO_SALIO` y `ENVIO_ENTREGADO` en ese orden |
| D03-L1 | límite | E-101, pendiente y sin eventos | 200 con `eventos: []` |
| D03-E1 | error | `E-999999` | 404 |

Evidencia: [OP-D03 en la evidencia](pruebas/catalogo-evidencia.md#op-d03-consultar-bitácora-de-un-envío).

### OP-D04. Reportar incidente

Propósito: registrar un bloqueo, accidente, obra o derrumbe en un punto de la red para que las rutas lo tomen en cuenta.

Bases: MongoDB (colección `reportes_incidente`, fuente de verdad) y Neo4j (nodo `Incidente` y relación `BLOQUEA`).

Entrada: `POST /incidentes` (despachador o administrador) con `tipo` (`Bloqueo`, `Accidente`, `Obra` o `Derrumbe`), `idPunto` (ciudad o intersección que exista; no una estación), `gravedad` (`Baja`, `Media` o `Alta`), `descripcion` (5 a 1,000 caracteres), `detalle` con los campos de su tipo, `reportadoPor` y `evidencias` opcionales. El identificador `INC-####` lo da un contador en MongoDB.

Salida: 201 con `{ incidente }` y `sincronizado: true` si quedó en las dos bases. Si Neo4j no respondió, 202 con `{ incidente, aviso }` y `sincronizado: false` (lo cubre `tests/consistencia/incidente-sin-neo4j.test.ts`).

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D04-N1 | normal | bloqueo de gravedad Alta en la caseta de Chiapa de Corzo (INT-CHC) | 201, `sincronizado: true` |
| D04-V1 | verificación | el nodo en Neo4j | activo, gravedad Alta y `BLOQUEA` a INT-CHC |
| D04-L1 | límite | punto EST-TAP, que existe pero es una estación | 400 |
| D04-E1 | error | detalle de derrumbe en un reporte de bloqueo | 400 |
| D04-E2 | error | punto INT-NOEXISTE | 404 |
| D04-E3 | error | gravedad `Extrema` | 400 |

Evidencia: [OP-D04 en la evidencia](pruebas/catalogo-evidencia.md#op-d04-reportar-incidente).

### OP-D05. Agregar evidencia a un incidente

Propósito: sumar fotos o testimonios a un reporte mientras sigue abierto.

Bases: MongoDB (`$push` al arreglo `evidencias`). No se replica a Neo4j.

Entrada: `POST /incidentes/{id}/evidencias` (despachador o administrador) con `tipo` (`Foto` o `Testimonio`), `url` (obligatoria para foto), `texto` (2 a 1,000 caracteres, obligatorio para testimonio), `autor` y `fecha` opcionales.

Salida: 201 con el reporte actualizado.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D05-N1 | normal | foto con URL | 201 |
| D05-L1 | límite | testimonio de 2 caracteres | 201 |
| D05-E1 | error | foto sin URL | 400 |
| D05-E2 | error | incidente INC-9999 | 404 |

Evidencia: [OP-D05 en la evidencia](pruebas/catalogo-evidencia.md#op-d05-agregar-evidencia-a-un-incidente).

### OP-D06. Consultar incidentes

Propósito: la lista de la pantalla de Incidentes y el reporte completo.

Bases: MongoDB. El filtro de activos usa el índice `activos_por_gravedad`.

Entrada: `GET /incidentes` con filtros opcionales `activo`, `gravedad`, `tipo`, `idPunto`, `sincronizado` y `limite` (50 por defecto); `GET /incidentes/{id}` con formato `INC-####`.

Salida: 200 con una lista de reportes o con uno solo, con su `detalle` y `evidencias`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D06-N1 | normal | `?activo=true` | 200, todos activos |
| D06-N2 | normal | el incidente de prueba | 200 con 3 evidencias (la del alta y las dos de OP-D05) |
| D06-L1 | límite | filtros que no coinciden con nada | 200 y lista vacía |
| D06-E1 | error | INC-9999 | 404 |
| D06-E2 | error | `incidente1` | 400 |

Evidencia: [OP-D06 en la evidencia](pruebas/catalogo-evidencia.md#op-d06-consultar-incidentes).

### OP-D07. Cerrar incidente

Propósito: marcar que el problema terminó para que las rutas vuelvan a pasar por ese punto.

Bases: MongoDB y la réplica en Neo4j, con el mismo esquema de 200 o 202 que el alta.

Entrada: `PATCH /incidentes/{id}/cerrar` (despachador o administrador) con `motivoCierre` y `fechaFin` opcionales.

Salida: 200 con `{ incidente }`, `activo: false`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| D07-N1 | normal | cerrar el bloqueo de prueba | 200, `activo: false`, `sincronizado: true` |
| D07-E1 | error | cerrarlo otra vez | 409 |

El caso G01-L4 muestra el efecto: con el incidente cerrado, la ruta de Tuxtla a San Cristóbal regresa a la autopista.

Evidencia: [OP-D07 en la evidencia](pruebas/catalogo-evidencia.md#op-d07-cerrar-incidente).

## Operaciones del modelo de grafos

### OP-G01. Ruta más corta (C1)

Propósito: la mejor ruta entre dos ciudades por tiempo, distancia o costo, respetando las restricciones de la carga y los incidentes.

Bases: Neo4j (`apoc.algo.dijkstra` sobre `CARRETERA`; descarta tramos cerrados, terracería si se pide y puntos con un incidente activo de gravedad Alta).

Entrada: `GET /rutas` con `origen` y `destino` (claves INEGI de 5 dígitos, distintas, que existan en la red), `criterio` (`tiempo` por defecto, `distancia` o `costo`), `evitarTerraceria` (booleano) y `tiempoMaxMin` (entero, mínimo 1).

Salida: 200 con `encontrada`, `ruta` (puntos en orden), `tramos`, `minutos`, `kilometros`, `costoCasetas` y `avisos`. Si ninguna ruta cumple, `encontrada: false` con el `motivo`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G01-N1 | normal | Tuxtla a San Cristóbal por tiempo | 73 min por la autopista, 230 de casetas |
| G01-N2 | normal | lo mismo por costo | 140 min por la libre, 0 de casetas |
| G01-L1 | límite | San Cristóbal a Totolapa sin terracería | 108 min, ningún tramo de terracería (la más rápida, de 80 min, sí usa) |
| G01-L2 | límite | Tuxtla a Arriaga con tiempo máximo de 100 min | 200 con `encontrada: false` |
| G01-L3 | límite | Tuxtla a San Cristóbal con el bloqueo Alta de OP-D04 activo | 176 min, rodea la caseta |
| G01-L4 | límite | lo mismo después de cerrar el incidente | 73 min otra vez |
| G01-E1 | error | destino 07999 | 404 |
| G01-E2 | error | origen igual al destino | 400 |
| G01-E3 | error | origen `tuxtla` | 400 |

Evidencia: [OP-G01 en la evidencia](pruebas/catalogo-evidencia.md#op-g01-ruta-más-corta-c1).

### OP-G02. Exploración paso a paso de la ruta

Propósito: repetir Dijkstra en el backend sobre la red leída de Neo4j, guardando cada punto resuelto y cada tramo revisado, para animarlo en la interfaz y comprobar que llega al mismo costo que Neo4j.

Bases: Neo4j.

Entrada: `GET /rutas/exploracion` con los mismos parámetros que OP-G01 más `algoritmo` (`dijkstra` o `bidireccional`).

Salida: 200 con `pasos`, `ruta`, `minutos`, el resultado de Neo4j y `coincide`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G02-N1 | normal | Tuxtla a San Cristóbal | `coincide: true`, 73 min |
| G02-L1 | límite | Tuxtla a Tapachula, bidireccional | `coincide: true` |
| G02-E1 | error | `algoritmo=a-estrella` | 400 |

Evidencia: [OP-G02 en la evidencia](pruebas/catalogo-evidencia.md#op-g02-exploración-paso-a-paso-de-la-ruta).

### OP-G03. Camión contra camión y tren (C2)

Propósito: decidir si conviene llevar todo por carretera o pasar la carga al tren de la costa.

Bases: Neo4j (`CARRETERA`, `VIA_FERREA` y `UBICADA_EN` para saber en qué ciudad está cada estación).

Entrada: `GET /rutas/camion-tren` con `origen`, `destino` y `pesoKg` (mayor que 0).

Salida: 200 con `soloCamion` y `camionTren` (minutos, kilómetros, costo y estaciones de subida y bajada), `masBarata` y `masRapida`. El costo del camión es casetas más kilómetros por `COSTO_KM_CAMION`; el del tren, la tarifa por tonelada de cada tramo.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G03-N1 | normal | 20 toneladas de Tuxtla a Tapachula | el tren sale más barato y el camión más rápido |
| G03-L1 | límite | `pesoKg=0` | 400 |
| G03-E1 | error | destino 07999 | 404 |

Evidencia: [OP-G03 en la evidencia](pruebas/catalogo-evidencia.md#op-g03-camión-contra-camión-y-tren-c2).

### OP-G04. Ciudades aisladas (C4)

Propósito: saber qué ciudades se quedan sin camino si se cierra un punto.

Bases: Neo4j (`apoc.path.subgraphNodes` desde el destino, recorriendo las carreteras al revés sin pasar por el punto cerrado).

Entrada: `GET /red/ciudades-aisladas` con `punto` (ciudad o intersección) y `destino` opcional (Tuxtla por defecto).

Salida: 200 con `puntoCerrado`, `destino` y `aisladas`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G04-N1 | normal | se cierra Tapachula | 6 municipios del Soconusco sin camino a Tuxtla |
| G04-L1 | límite | se cierra el entronque de Oxchuc | lista vacía, porque hay caminos alternos |
| G04-E1 | error | INT-NOEXISTE | 404 |

Evidencia: [OP-G04 en la evidencia](pruebas/catalogo-evidencia.md#op-g04-ciudades-aisladas-c4).

### OP-G05. Mapa de la red

Propósito: todo lo que dibuja la pantalla de inicio.

Bases: Neo4j, con cuatro consultas en paralelo.

Entrada: `GET /red/mapa`, sin parámetros.

Salida: 200 con `puntos` (con coordenadas), `tramos` (una línea por par de puntos), `incidentes` activos y `vehiculos` con su ubicación.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G05-N1 | normal | sin parámetros | 138 puntos |

Evidencia: [OP-G05 en la evidencia](pruebas/catalogo-evidencia.md#op-g05-mapa-de-la-red).

### OP-G06. Ubicación de un vehículo

Propósito: saber dónde está un vehículo y moverlo.

Bases: Neo4j (relación `SE_ENCUENTRA_EN`); al mover, lee el tipo del vehículo en PostgreSQL para validar R11.

Entrada: `GET /vehiculos/{placa}/ubicacion` y `PATCH /vehiculos/{placa}/ubicacion` (despachador o administrador) con `{ idPunto }`. Un tren solo puede estar en una estación y un camión o tráiler solo en una ciudad o intersección.

Salida: 200 con `{ placa, punto, fechaHora }` al consultar y `{ placa, anterior, actual, avisos }` al mover.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| G06-N1 | normal | mover el camión de prueba a Tuxtla | 200, `actual` = Tuxtla |
| G06-N2 | normal | consultar dónde está | 200, Tuxtla |
| G06-L1 | límite | mover el camión a la estación EST-TAP | 400 (R11) |
| G06-E1 | error | placa que no existe | 404 |
| G06-E2 | error | sin token | 401 |

Evidencia: [OP-G06 en la evidencia](pruebas/catalogo-evidencia.md#op-g06-ubicación-de-un-vehículo).

## Operaciones integradas

### OP-I01. Flujo integrado: ruta de un envío

Propósito: planear la ruta de un envío con todo lo que se sabe de él. Es el flujo de la sección 8.1 de la guía y está explicado paso a paso en [arquitectura.md](arquitectura.md#7-flujo-integrado-planear-la-ruta-de-un-envío).

Bases: PostgreSQL (origen, destino, peso, estado y vehículos disponibles que aguantan el peso), MongoDB (manifiesto: peligrosa evita terracería, refrigerada tiene tiempo máximo) y Neo4j (ruta con esas restricciones y el vehículo candidato más cercano al origen).

Entrada: `GET /envios/{id}/ruta` con `criterio` opcional (`tiempo`, `distancia` o `costo`).

Salida: 200 con `tipoCarga`, `restricciones`, `candidatos`, `encontrada`, `ruta`, `tramos`, `minutos`, `kilometros`, `costoCasetas`, `vehiculoSugerido`, `avisos` y `fuentes` (qué aportó cada base). Sin manifiesto calcula sin restricciones y lo avisa.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| I01-N1 | normal | E-103, carga peligrosa de Tuxtla a Comitán | evita terracería y sugiere un vehículo que aguanta 3,000 kg |
| I01-N2 | normal | el envío de prueba, con el camión de prueba en Tuxtla | el camión es candidato y el sugerido está a 0 min del origen |
| I01-L1 | límite | E-105, ya entregado | 200 con aviso |
| I01-E1 | error | `E-999999` | 404 |
| I01-E2 | error | `criterio=barata` | 400 |

La prueba `tests/e2e/ruta-envio.test.ts` recorre el mismo flujo con un envío sin manifiesto y con una carga refrigerada.

Evidencia: [OP-I01 en la evidencia](pruebas/catalogo-evidencia.md#op-i01-flujo-integrado-ruta-de-un-envío).

### OP-I02. Envíos afectados por un incidente (C5)

Propósito: saber qué envíos en camino pasan por el punto de un incidente y cuánto se tardan de más si lo rodean.

Bases: MongoDB (el incidente y las restricciones del manifiesto de cada envío), PostgreSQL (envíos `En camino` y su vehículo) y Neo4j (dónde está el vehículo, su ruta sin el incidente y la ruta que rodea el punto).

Entrada: `GET /incidentes/{id}/envios-afectados`.

Salida: 200 con `incidente`, `revisados`, `afectados` (cada uno con `rutaSinIncidente`, `desvio` y `minutosExtra`; `desvio: null` si no hay forma de rodear) y `avisos`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| I02-N1 | normal | el bloqueo de OP-D04 con el envío de prueba en camino desde Tuxtla | el envío aparece con su desvío y los minutos extra |
| I02-L1 | límite | INC-0002, que está cerrado | lista vacía con aviso |
| I02-E1 | error | INC-9999 | 404 |

Evidencia: [OP-I02 en la evidencia](pruebas/catalogo-evidencia.md#op-i02-envíos-afectados-por-un-incidente-c5).

### OP-I03. Alta de ciudad replicada al grafo

Propósito: dar de alta una ciudad y que el grafo la tenga como nodo para conectarle tramos.

Bases: PostgreSQL (tabla `ciudad` y `eventos_pendientes` en la misma transacción); Neo4j por el evento `CIUDAD_GUARDADA`.

Entrada: `POST /ciudades` (solo administrador) con `idCiudad` (5 dígitos), `nombre` y `estado`.

Salida: 201 con la ciudad. Después del procesador de eventos, `(:Ciudad {idCiudad, nombre})` existe en Neo4j.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| I03-N1 | normal | ciudad de prueba | 201 |
| I03-V1 | verificación | Neo4j y `eventos_pendientes` antes del procesador | 0 nodos y el evento `pendiente` |
| I03-V2 | verificación | lo mismo después del procesador | el nodo con el mismo nombre y el evento `aplicado` |
| I03-L1 | límite | clave `7101` (4 dígitos) | 400 |
| I03-E1 | error | Tuxtla, que ya existe | 409 |

Evidencia: [OP-I03 en la evidencia](pruebas/catalogo-evidencia.md#op-i03-alta-de-ciudad-replicada-al-grafo).

### OP-I04. Reconciliación de réplicas

Propósito: corregir cualquier diferencia entre las réplicas del grafo y su fuente de verdad (incidentes contra MongoDB, ciudades y vehículos contra PostgreSQL).

Bases: lee PostgreSQL y MongoDB, escribe Neo4j y marca `sincronizado: true` en MongoDB.

Entrada: `POST /admin/reconciliar` (solo administrador), sin cuerpo.

Salida: 200 con lo revisado y lo corregido por cada tipo de dato, `avisos` y `duracionMs`.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| I04-E1 | error | sin token | 401 |
| I04-E2 | error | con token de despachador | 403 |
| I04-N1 | normal | como administrador | 200 con el resumen |
| I04-L1 | límite | correrla otra vez enseguida | 200 sin copiar ni borrar nada |

El caso en que sí hay algo que corregir (un incidente reportado con Neo4j apagado) lo cubre `tests/consistencia/incidente-sin-neo4j.test.ts`, porque requiere detener el contenedor.

Evidencia: [OP-I04 en la evidencia](pruebas/catalogo-evidencia.md#op-i04-reconciliación-de-réplicas).

### OP-I05. Estado de las tres bases

Propósito: saber si la aplicación puede trabajar.

Bases: PostgreSQL, MongoDB y Neo4j, con un ping a cada una.

Entrada: `GET /health`.

Salida: 200 con `estado: "ok"` y el tiempo de cada base; 503 con `estado: "degradado"` y el error de la que falló.

| Caso | Tipo | Entrada | Esperado |
|---|---|---|---|
| I05-N1 | normal | las tres bases arriba | 200, `ok` |

Evidencia: [OP-I05 en la evidencia](pruebas/catalogo-evidencia.md#op-i05-estado-de-las-tres-bases).

## Otras operaciones de la API

Estas también existen y tienen pruebas de integración, pero no se detallan arriba porque repiten los mismos patrones:

- `GET /ciudades`, `GET /clientes/{id}`, `PUT /clientes/{id}`, `DELETE /clientes/{id}` (409 si tiene envíos), y lo mismo para `/conductores` (409 si tiene vehículos). PostgreSQL.
- `GET /vehiculos`, `GET /vehiculos/{placa}` y `PATCH /vehiculos/{placa}`, que vuelve a encolar `VEHICULO_GUARDADO`. PostgreSQL.
- `GET /red/puntos`, `POST /red/intersecciones`, `POST /red/estaciones`, `DELETE /red/intersecciones/{id}` (409 si tiene incidentes activos o deja vecinos sin tramos), y `POST`, `PATCH` y `DELETE /red/tramos`, que validan R2, R4, R5, R12, R14 y R15. Neo4j.
- `GET /envios/{id}/datos-ruta`: el contrato interno que usa el flujo integrado. PostgreSQL y MongoDB.
