# Entregable 4. Implementación de las tres bases

Este documento junta lo que pide la sección 7.4 de la guía para cada base: cómo está definida, con qué scripts se crea y se carga, qué consultas la representan y qué pruebas la revisan. El diseño (modelo conceptual, modelos lógicos y diccionario de datos) está en [modelado.md](modelado.md); aquí va la parte que corre.

Todo vive en `database/`, una carpeta por base, y cada una tiene la misma forma:

| Carpeta | PostgreSQL (`relational/`) | MongoDB (`document/`) | Neo4j (`graph/`) |
|---|---|---|---|
| Esquema | `schema/01_tablas.sql` | `validators/*.js` (validador e índices por colección) | `schema/01_restricciones.cypher` |
| Datos de prueba | `data/01_datos.sql` | `data/*.js` | `data/01_red_chiapas.cypher`, `02_vehiculos.cypher`, `03_incidentes.cypher` |
| Quién los corre | `init.sh` | `init/01_init.js` | `load.sh` (contenedor `neo4j-init`) |
| Consultas | `queries/consultas.sql` | `queries/01_consultas_incidentes.js`, `02_consultas_manifiestos.js`, `03_consultas_bitacora.js` | `queries/01_consultas_rutas.cypher` |
| Pruebas | `tests/01_integridad.sql` | `tests/01_validacion.js` | `tests/00_humo.cypher`, `tests/01_integridad.cypher` |

La evidencia de que todo esto corre está en [pruebas/implementacion-evidencia.md](pruebas/implementacion-evidencia.md). La genera `npm run bases -- --desde-cero` (desde `backend/`): borra los volúmenes, construye las tres bases desde cero con estos scripts y después corre dentro de cada contenedor las consultas y las pruebas, guardando su salida tal cual.

## 1. Construir las bases desde cero

Requisitos: Docker Desktop y el archivo `.env` (copia de `.env.example`).

```bash
docker compose down -v   # solo si ya existían; borra los datos
docker compose up -d
```

Qué pasa en ese `up`:

1. PostgreSQL 16 arranca con un volumen vacío y corre `init.sh`, que ejecuta con `ON_ERROR_STOP` los `.sql` de `schema/` y luego los de `data/`, en orden alfabético. Si un script falla, la carga se detiene.
2. MongoDB 7 corre `init/01_init.js`. Para cada archivo de `validators/` crea la colección con su `$jsonSchema` (`validationLevel: strict`, `validationAction: error`) y sus índices; después inserta los documentos de `data/`. Los datos pasan por el validador al cargarse, así que un dato de ejemplo mal escrito detiene la carga.
3. Neo4j 5 con APOC arranca, y cuando su healthcheck responde, el contenedor `neo4j-init` corre `load.sh`: primero `schema/` (restricciones e índices) y luego `data/`. Todo usa `CREATE ... IF NOT EXISTS` y `MERGE`, así que se puede correr otra vez sin duplicar nada (`docker compose up neo4j-init`).

Para revisar que cargó: `docker compose logs neo4j-init` debe terminar en "Base de grafos lista", y `GET /health` de la API responde `"estado": "ok"` cuando las tres bases contestan.

Los scripts de PostgreSQL y MongoDB solo corren cuando el volumen está vacío; para repetirlos hay que borrar el volumen con `down -v`.

## 2. Base relacional (PostgreSQL)

### 2.1 Tablas, llaves y restricciones

| Tabla | Llave primaria | Llaves foráneas | Otras restricciones |
|---|---|---|---|
| `usuario` | `id_usuario` (BIGSERIAL) | | `correo` UNIQUE; `rol` en (despachador, administrador) |
| `cliente` | `id_cliente` (BIGSERIAL) | | `rfc` UNIQUE; `razon_social` NOT NULL |
| `conductor` | `id_conductor` (BIGSERIAL) | | `licencia` UNIQUE |
| `ciudad` | `id_ciudad` (clave INEGI) | | `id_ciudad` con 5 dígitos (`CHECK ~ '^[0-9]{5}$'`) |
| `vehiculo` | `placa` | `id_conductor` → `conductor` | `tipo` en (Camión, Tráiler, Tren); `capacidad_kg > 0`; `estado` en (Disponible, En ruta, En taller) |
| `envio` | `id_envio` (`E-<dígitos>`) | `id_cliente` → `cliente`; origen y destino → `ciudad` | `peso_kg > 0`; `prioridad` y `estado` con valores fijos; origen distinto del destino |
| `asignacion` | `id_asignacion` (BIGSERIAL) | `id_envio` → `envio`; `placa` → `vehiculo` | una sola asignación activa por envío y por vehículo (índices únicos parciales) |
| `eventos_pendientes` | `id` (BIGSERIAL) | | `tipo` y `estado` con valores fijos; `intentos >= 0`; `payload` JSONB |

Las llaves foráneas no tienen `ON DELETE CASCADE` a propósito: borrar un cliente con envíos o un conductor con vehículo falla (23503) y la API lo traduce a 409. Los identificadores que ve el usuario son naturales (clave INEGI, placa, `E-101`) porque son los mismos que viajan a MongoDB y Neo4j; las tablas internas usan secuencias.

### 2.2 Índices y por qué existen

| Índice | Columnas | Para qué |
|---|---|---|
| `asignacion_envio_activa_idx` | `asignacion (id_envio) WHERE activa`, único | Que un envío no tenga dos vehículos a la vez. Es una regla de cardinalidad que la base impone aunque dos asignaciones lleguen al mismo tiempo |
| `asignacion_vehiculo_activa_idx` | `asignacion (placa) WHERE activa`, único | Que un vehículo no lleve dos envíos a la vez |
| `envio_estado_idx` | `envio (estado)` | La lista de pendientes y los envíos en camino que revisa C5 |
| `envio_id_cliente_idx`, `envio_origen_idx`, `envio_destino_idx` | llaves foráneas de `envio` | PostgreSQL no indexa solo las llaves foráneas; sin esto, cada join con cliente o ciudad y cada borrado revisado por la llave leería toda la tabla |
| `vehiculo_estado_idx` | `vehiculo (estado)` | Los vehículos disponibles que son candidatos en el flujo integrado |
| `vehiculo_conductor_idx` | `vehiculo (id_conductor)` | Join con conductor y revisión al borrar un conductor |
| `asignacion_envio_idx`, `asignacion_placa_idx` | llaves foráneas de `asignacion` | Historial de un vehículo y asignación de un envío |
| `eventos_pendientes_estado_idx` | `eventos_pendientes (estado, creado_en)` | El procesador toma los pendientes más viejos cada 5 segundos |

### 2.3 Datos de prueba

`data/01_datos.sql` carga 2 usuarios, 4 clientes, 4 conductores, las 124 cabeceras municipales de Chiapas, 7 vehículos (cinco camiones o tráileres en distintos estados y el tren), 8 envíos que cubren los cinco estados y 4 asignaciones (tres activas y una cerrada). Los datos están pensados para que cada regla tenga un caso: hay un vehículo en taller, uno disponible que no aguanta 9 toneladas, un envío entregado y uno cancelado.

### 2.4 Consultas representativas

Están en `queries/consultas.sql` y corren completas con psql (traen valores por defecto para sus variables):

1. Envíos pendientes con cliente y ciudades, urgentes primero.
2. Vehículos disponibles que aguantan un peso (los candidatos del flujo integrado).
3. Historial de asignaciones de un vehículo.
4. Envíos en camino con su vehículo y conductor, con `LEFT JOIN` porque el conductor es opcional.
5. Envíos y kilos por cliente y por estado, con `count(*) FILTER`.
6. Estado de la flota por tipo: cuántos vehículos y qué capacidad hay en cada estado.
7. Ciudades que más envíos generan o reciben.
8. Horas entre la salida y la entrega de cada envío entregado.
9. Vigilancia de la cola de eventos: cuántos hay por tipo y estado y el último error.
10. Conductores activos sin vehículo, con `NOT EXISTS`.
11. `EXPLAIN` de la consulta 1, que muestra el uso de `envio_estado_idx`.

### 2.5 Pruebas de integridad y transacciones

`tests/01_integridad.sql` hace 27 pruebas y al final imprime una tabla con lo esperado, lo obtenido y si cumple. Ninguna deja datos: cada intento se hace dentro de un bloque que PostgreSQL deshace.

- Humo: cuántas filas tiene cada tabla.
- Integridad (16 pruebas): llave primaria repetida, `UNIQUE` de RFC y de licencia, `NOT NULL`, cada `CHECK` (clave INEGI, tipo y capacidad del vehículo, peso, formato del envío, estado, origen igual al destino, tipo de evento) y cada llave foránea, incluido borrar un cliente que tiene envíos. Cada una debe fallar con su código: 23505, 23502, 23514 o 23503.
- Cardinalidad (3 pruebas): los índices únicos parciales rechazan una segunda asignación activa para el mismo envío y para el mismo vehículo, pero aceptan varias asignaciones cerradas.
- Transacciones (3 pruebas): una asignación completa (insertar la asignación, cambiar dos estados y dejar el evento) en la que el último paso falla a propósito; los tres primeros se deshacen con él. Y la misma transacción sin error, donde los cuatro cambios se ven juntos.
- Datos (5 pruebas): consultas que cuentan lo que no debería existir en los datos cargados, como un envío en camino sin asignación activa o un vehículo asignado que no aguanta el peso. Todas deben dar 0.

La concurrencia se prueba aparte, porque necesita dos conexiones: `tests/integration/asignaciones.concurrentes.test.ts` manda dos asignaciones del mismo envío al mismo tiempo y comprueba que una gana y la otra recibe 409. `tests/integration/relacional.restricciones.test.ts` repite varias de estas restricciones desde el backend.

## 3. Base documental (MongoDB)

### 3.1 Colecciones y estructura

| Colección | Un documento es | Campos principales |
|---|---|---|
| `manifiestos` | la carga de un envío | `idEnvio`, `tipoCarga`, `articulos[]` (descripción, cantidad, peso), campos según el tipo, `restriccionesRuta { evitarTerraceria, tiempoMaxMin }`, `creadoEn` |
| `bitacora_envio` | el historial de un envío | `idEnvio`, `eventos[] { tipo, fecha, detalle }` ordenados por fecha |
| `reportes_incidente` | un incidente en la red | `idIncidente`, `tipo`, `idPunto`, `tipoPunto`, `gravedad`, `descripcion`, `fechaInicio`, `fechaFin`, `detalle` según el tipo, `evidencias[]`, `activo`, `sincronizado`, `reportadoPor` |
| `contadores` | el último número usado de una serie | `_id` (nombre de la serie), `valor` |

Los arreglos van dentro del documento porque siempre se leen junto con su dueño y tienen un tope razonable: los artículos de una carga, los eventos de un envío (seis como mucho) y hasta 50 evidencias por incidente.

### 3.2 Reglas de validación

Las tres colecciones de datos tienen `$jsonSchema` en modo estricto, con `additionalProperties: false` para que no entren campos que no están en el modelo.

- `manifiestos`: un `oneOf` por tipo de carga. La general no puede traer campos de otro tipo; la refrigerada exige `tempMinC`, `tempMaxC` y `tiempoMaxMin`; la peligrosa exige `claseUN` (entero de 1 a 9), `numeroONU`, `hojaSeguridad` y `telefonoEmergencia`. Al menos un artículo, cada uno con `cantidad >= 1` y `pesoKg >= 0.01`.
- `bitacora_envio`: cada evento debe tener `tipo`, `fecha` de tipo date y `detalle` de tipo objeto.
- `reportes_incidente`: tres `oneOf` combinados. El `detalle` corresponde al tipo (un bloqueo trae causa y carriles cerrados; un derrumbe, volumen y si requiere maquinaria). El `tipoPunto` coincide con la forma del `idPunto` (Ciudad con 5 dígitos, Interseccion con `INT-`). Y un incidente activo no tiene `fechaFin`, mientras que uno cerrado sí.

El backend valida lo mismo antes de escribir para dar mensajes claros, pero el validador es la última barrera: si alguien inserta directo en la base, MongoDB rechaza el documento con el código 121.

### 3.3 Índices

| Colección | Índice | Para qué |
|---|---|---|
| `manifiestos` | `idEnvio_unico` | Un manifiesto por envío y búsqueda directa desde el flujo integrado |
| `bitacora_envio` | `idEnvio_unico` | Una bitácora por envío; el procesador de eventos busca por aquí |
| `reportes_incidente` | `idIncidente_unico` | Identificador único |
| `reportes_incidente` | `activos_por_gravedad` (`activo`, `gravedad`, `fechaInicio` descendente) | La lista de la pantalla de incidentes, ya ordenada |
| `reportes_incidente` | `por_punto` (`idPunto`, `activo`) | Historial de un punto y revisión de incidentes activos antes de borrar una intersección |
| `reportes_incidente` | `pendientes_de_sincronizar`, parcial con `sincronizado: false` | Lo primero que busca la reconciliación. Solo indexa los pendientes, que deberían ser casi ninguno |

### 3.4 Estrategia de identificación

- `_id` es el ObjectId que pone MongoDB y no se usa fuera de la base.
- `manifiestos` y `bitacora_envio` se identifican con el `idEnvio` de PostgreSQL. Es una referencia, no una copia: el servicio revisa en PostgreSQL que el envío exista antes de crear el manifiesto, y el índice único impide un segundo documento por envío.
- `reportes_incidente` usa `INC-0001`, `INC-0002`, etc. El número sale de `contadores` con `findOneAndUpdate` y `$inc`, que es atómico: dos reportes al mismo tiempo nunca reciben el mismo número. Es el mismo identificador que tiene el nodo `Incidente` en Neo4j.

### 3.5 Carga reproducible

Cada archivo de `validators/` exporta `{ coleccion, validador, indices }` y cada archivo de `data/` exporta `{ coleccion, documentos }`; `init/01_init.js` los recorre en orden. Para agregar una colección basta con agregar sus dos archivos. Los datos de prueba son 6 manifiestos (dos de cada tipo de carga), 2 bitácoras (un envío en camino y uno entregado), 2 reportes de incidente (una obra activa de gravedad Media y un derrumbe Alta ya cerrado) y el contador de incidentes.

### 3.6 Consultas representativas

- `queries/01_consultas_incidentes.js`: incidentes activos Alta ordenados, historial de un punto, pendientes de sincronizar, conteo por tipo y gravedad con la duración promedio de los cerrados, obras activas (un campo que solo existe en el detalle de tipo Obra), `$push` de una evidencia, el contador atómico y el plan de ejecución de la primera consulta.
- `queries/02_consultas_manifiestos.js`: manifiesto de un envío, cargas peligrosas y refrigeradas con sus campos propios, peso declarado con `$unwind` y `$multiply`, manifiestos por tipo, búsqueda dentro del arreglo de artículos con `$elemMatch` y el plan de la primera consulta.
- `queries/03_consultas_bitacora.js`: bitácora de un envío, último evento de cada envío con `$arrayElemAt`, eventos por tipo, horas de la salida a la entrega con `$filter` y `$dateDiff`, y el `$push` que usa el procesador: no repite un evento y mantiene el orden aunque uno llegue tarde.

Las que escriben deshacen su cambio al final.

### 3.7 Pruebas de documentos válidos e inválidos

`tests/01_validacion.js` inserta documentos directo en MongoDB, sin la API, y revisa qué hace el validador:

- Humo: que existan las cuatro colecciones, con su validador, sus índices y sus documentos.
- `manifiestos` (14 pruebas): un documento válido de cada tipo y la clase UN 9 como límite superior se aceptan; se rechazan la clase UN 10, la peligrosa sin número ONU, la refrigerada sin tiempo máximo, la general con temperatura, un tipo de carga que no existe, sin artículos, un artículo con cantidad 0, un `idEnvio` sin formato y un campo fuera del esquema (121), y un segundo manifiesto de E-101 (11000).
- `bitacora_envio` (5 pruebas): bitácora válida y vacía se aceptan; un evento con la fecha como texto o sin detalle se rechaza (121) y una segunda bitácora del mismo envío choca con el índice único (11000).
- `reportes_incidente` (12 pruebas): un bloqueo, un derrumbe en una ciudad y un incidente cerrado con fecha de fin se aceptan; se rechazan el detalle de otro tipo, un bloqueo sin carriles cerrados, una gravedad que no existe, un `tipoPunto` que no coincide con el `idPunto`, activo con fecha de fin, cerrado sin ella, una evidencia sin fecha y un identificador mal escrito (121), y un `INC-0001` repetido (11000).
- Datos (4 pruebas): en los documentos cargados no hay incidentes activos con fecha de fin, bitácoras fuera de orden, cargas peligrosas que no eviten terracería ni un contador atrás del número más alto usado.

## 4. Base de grafos (Neo4j)

### 4.1 Etiquetas y propiedades

| Etiqueta | Identificador | Propiedades | Datos de prueba |
|---|---|---|---|
| `Ciudad` | `idCiudad` (clave INEGI) | `nombre`, `latitud`, `longitud` | 124 cabeceras municipales |
| `Interseccion` | `idInterseccion` (`INT-...`) | `nombre`, `tipo` (Cruce, Glorieta o Caseta), `latitud`, `longitud` | 9 |
| `Estacion` | `idEstacion` (`EST-...`) | `nombre`, `tipoServicio`, `latitud`, `longitud` | 5 en la línea de la costa |
| `Vehiculo` | `placa` | (réplica: solo la placa) | 7 |
| `Incidente` | `idIncidente` | `gravedad`, `activo` (réplica mínima) | 2 |

### 4.2 Relaciones

| Relación | De → a | Propiedades | Datos de prueba |
|---|---|---|---|
| `CARRETERA` | Ciudad o Interseccion → Ciudad o Interseccion | `distanciaKm`, `tiempoMin`, `costoCaseta`, `pesoCosto`, `tipoVia`, `abierto` | 333 tramos, dos aristas cada uno (666) |
| `VIA_FERREA` | Estacion → Estacion | `distanciaKm`, `tiempoMin`, `costoPorTonelada` | 4 tramos, dos aristas cada uno (8) |
| `UBICADA_EN` | Estacion → Ciudad | `tiempoCambioMin` | 5 |
| `BLOQUEA` | Incidente → Ciudad o Interseccion | | 2 |
| `SE_ENCUENTRA_EN` | Vehiculo → Ciudad, Interseccion o Estacion | `fechaHora` | 7 |

Cada tramo de carretera son dos aristas dirigidas, una por sentido, porque el tiempo de ida y el de vuelta pueden ser distintos. Los tramos salen de rutas reales de OSRM sobre OpenStreetMap entre cabeceras vecinas; el tiempo es el de OSRM por 1.2 para un camión de carga (las fuentes están en `database/graph/fuentes/LEEME.md`).

### 4.3 Restricciones e índices

`schema/01_restricciones.cypher` crea seis restricciones de unicidad (`idCiudad`, `idInterseccion`, `idEstacion`, nombre de estación, `idIncidente` y `placa`) y dos índices: `ciudad_nombre`, porque las consultas buscan ciudades por nombre, e `incidente_activo`, porque el cálculo de rutas filtra incidentes activos en cada candidata.

La imagen `neo4j:5` es la edición Community, que solo tiene restricciones de unicidad; las de existencia y de tipo son de la edición Enterprise. Por eso las propiedades obligatorias, los valores permitidos y las reglas de conectividad las valida el backend antes de escribir y las revisa `tests/01_integridad.cypher` sobre los datos.

### 4.4 Scripts de creación y carga

`load.sh` corre `schema/` y luego `data/` con cypher-shell. `data/01_red_chiapas.cypher` lo genera `scripts/generar-red.mjs` a partir del catálogo del INEGI y de las respuestas de OSRM guardadas en `fuentes/`, así que la red se puede regenerar sin volver a consultar OSRM. Todos los scripts usan `MERGE`; correrlos dos veces deja la base igual.

### 4.5 Consultas funcionales

`queries/01_consultas_rutas.cypher`, con los parámetros `origen` y `destino`:

- C1: ruta más rápida entre dos ciudades con `apoc.algo.dijkstra`, sin terracería y sin puntos con un incidente Alta activo.
- C2: tramo en tren entre dos estaciones con su costo por tonelada.
- C4: ciudades que se quedan sin camino a Tuxtla si se cierra un entronque, con `apoc.path.subgraphNodes`.
- Vecinos directos de una ciudad con sus pesos, incidentes activos con el punto que bloquean y la ubicación de cada vehículo.

Las versiones completas de estas consultas, con todas las restricciones, están en `backend/src/repositories/graph/` y su comportamiento está en el catálogo (OP-G01 a OP-G06).

### 4.6 Pruebas de humo, integridad y cardinalidad

- `tests/00_humo.cypher`: nodos por etiqueta, aristas por tipo, restricciones e índices que existen.
- `tests/01_integridad.cypher`: cada consulta regresa `{ prueba, fallas }` y en una base sana todas dan 0. Revisa propiedades obligatorias (R3), tramos sin distancia o tiempo (R4), pesos en cero o negativos (R5), valores permitidos (R6), relaciones entre etiquetas equivocadas (R12), tramos duplicados (R2), tramos sin vuelta (R14) y velocidades imposibles (R15). También revisa cardinalidades: que no haya puntos aislados, que cada estación esté en exactamente una ciudad, que cada incidente bloquee exactamente un punto y que cada vehículo tenga exactamente una ubicación.

`tests/integration/grafo-integridad.test.ts` corre el mismo archivo desde Vitest, y `tests/integration/rutas.test.ts` comprueba resultados conocidos sobre la red (por ejemplo, Tuxtla a San Cristóbal en 73 minutos por la autopista).

## 5. Resumen de pruebas

| Tipo de prueba | PostgreSQL | MongoDB | Neo4j |
|---|---|---|---|
| Humo | conteo por tabla | colecciones, validador, índices y conteos | nodos por etiqueta, aristas por tipo, restricciones e índices |
| Integridad | 16 restricciones que deben fallar con su código | 31 documentos válidos e inválidos contra el validador y los índices únicos | R2 a R15 sobre los datos cargados |
| Cardinalidad | índices únicos parciales de asignación y 5 conteos sobre los datos | índices únicos por envío e incidente | estaciones, incidentes, vehículos y puntos aislados |
| Transacciones | asignación que se deshace completa si falla un paso; concurrencia en Vitest | | |
| Resultados | 11 consultas representativas | 3 archivos de consultas con sus planes de ejecución | consultas C1, C2, C4 y de apoyo |

Los resultados de cada corrida están en [pruebas/implementacion-evidencia.md](pruebas/implementacion-evidencia.md).
