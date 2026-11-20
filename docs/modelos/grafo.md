# Modelo de grafos (Neo4j)

La base de grafos guarda la red de transporte de Chiapas: ciudades, intersecciones y estaciones de tren unidas por tramos de carretera y de vía férrea. Usamos Neo4j porque las preguntas que más hace la aplicación son de caminos. ¿Cuál es la ruta más rápida entre dos ciudades? ¿Qué ciudades se quedan sin salida si se cierra un cruce? ¿Qué envíos pasan por el punto donde hubo un derrumbe? En SQL cada una de esas preguntas sería una consulta recursiva difícil de mantener; en Cypher es un patrón de una o dos líneas y APOC trae Dijkstra ya hecho.

El grafo no es la fuente de verdad de todo lo que contiene. La red (puntos, tramos, pesos) y la ubicación de los vehículos sí se originan aquí. Las ciudades y los vehículos son réplicas de PostgreSQL, y los incidentes son réplicas de MongoDB. Para esas réplicas solo copiamos lo que necesita el cálculo de rutas.

Scripts: `database/graph/schema/` (restricciones e índices), `database/graph/data/` (red de ejemplo), `database/graph/queries/` (consultas representativas) y `database/graph/tests/` (pruebas de integridad).

## Nodos

`Ciudad`. Un municipio de Chiapas. Réplica de la tabla `ciudad` de PostgreSQL.
- `idCiudad`: clave de municipio del INEGI en texto, por ejemplo `"07101"` para Tuxtla Gutiérrez. Única.
- `nombre`.

`Interseccion`. Un punto de la carretera que no es ciudad: un cruce, una glorieta o una caseta. Existe solo en el grafo.
- `idInterseccion`: texto con prefijo, por ejemplo `INT-CRU`. Única.
- `nombre`, `tipo` (`Cruce`, `Glorieta` o `Caseta`), `latitud`, `longitud`.

`Estacion`. Una estación del tren de carga. Existe solo en el grafo.
- `idEstacion`: texto con prefijo, por ejemplo `EST-ARR`. Única, igual que `nombre`.
- `tipoServicio`.

`Incidente`. Réplica mínima de un reporte de `reportes_incidente` en MongoDB.
- `idIncidente` (único), `gravedad` (`Baja`, `Media` o `Alta`), `activo`.

`Vehiculo`. Réplica de la tabla `vehiculo` de PostgreSQL. Solo lleva la placa; el tipo, la capacidad y el estado se consultan en PostgreSQL.
- `placa`: única.

## Relaciones

`(:Ciudad|Interseccion)-[:CARRETERA]->(:Ciudad|Interseccion)`. Un tramo de carretera en un sentido. Un camino de doble sentido son dos aristas, porque el tiempo de ida y el de vuelta pueden ser distintos (una subida, por ejemplo).
- `distanciaKm` y `tiempoMin`: mayores que cero.
- `costoCaseta`: pesos, cero si no hay caseta.
- `tipoVia`: `Autopista`, `Federal`, `Estatal` o `Terracería`.
- `abierto`: si es `false`, el cálculo de rutas no lo usa.

`(:Estacion)-[:VIA_FERREA]->(:Estacion)`. Un tramo de tren en un sentido, con `distanciaKm`, `tiempoMin` y `costoPorTonelada`.

`(:Estacion)-[:UBICADA_EN]->(:Ciudad)`. En qué ciudad está la estación. `tiempoCambioMin` son los minutos que tarda pasar la carga del camión al tren o al revés.

`(:Incidente)-[:BLOQUEA]->(:Ciudad|Interseccion)`. Dónde ocurrió el incidente. Solo uno activo de gravedad `Alta` saca ese punto del cálculo de rutas.

`(:Vehiculo)-[:SE_ENCUENTRA_EN]->(:Ciudad|Interseccion|Estacion)`. Dónde está el vehículo ahora. `fechaHora` guarda cuándo se actualizó.

## Cardinalidades

- Cada estación está en exactamente una ciudad; una ciudad puede tener cero o varias estaciones.
- Cada incidente bloquea exactamente un punto; un punto puede tener cero o varios incidentes.
- Cada vehículo está en exactamente un punto. Un tren solo puede estar en una estación y un camión o tráiler solo en una ciudad o intersección (regla R11).
- Todo punto de la red tiene al menos un tramo; un punto sin tramos no sirve para nada en una ruta.

## Reglas y dónde se revisan

Neo4j Community solo impone unicidad, así que las demás reglas las revisa el backend antes de escribir y las consultas de `database/graph/tests/01_integridad.cypher` las comprueban después. Si alguna de esas consultas regresa fallas mayores que cero, algo entró a la base sin pasar por la API.

- R2. Un solo tramo por sentido y tipo de vía entre dos puntos (`POST /red/tramos` responde 409).
- R3. Propiedades obligatorias de cada nodo (esquemas de Fastify).
- R4 y R5. Todo tramo tiene distancia y tiempo, y ninguno es cero o negativo.
- R6. Valores permitidos de `tipo`, `tipoVia` y `gravedad`.
- R11. Tipo de vehículo contra tipo de punto (`PATCH /vehiculos/{placa}/ubicacion`).
- R12. `CARRETERA` solo entre ciudades e intersecciones, `VIA_FERREA` solo entre estaciones.
- R14. Todo tramo tiene su regreso (el alta crea los dos sentidos por defecto).
- R15. Ninguna velocidad pasa de 110 km/h.
- R16. Un incidente activo de gravedad Alta bloquea su punto en el cálculo de rutas.

## Cómo se calcula una ruta

`apoc.algo.dijkstra` encuentra caminos sumando una propiedad de las aristas (`tiempoMin`, `distanciaKm` o `costoCaseta`, según el criterio), pero no sabe saltarse tramos ni puntos. Por eso le pedimos las 10 rutas más cortas y en la misma consulta descartamos las que pasan por un tramo cerrado, por terracería cuando la carga no lo permite, o por un punto con un incidente Alta activo. Nos quedamos con la primera que cumple. En una red de este tamaño 10 candidatas alcanzan; si la red creciera mucho habría que subir `RUTAS_CANDIDATAS` o cambiar de estrategia.

Las ciudades aisladas (C4) se calculan con `apoc.path.subgraphNodes` desde el destino, recorriendo las carreteras al revés y sin pasar por el punto cerrado. Las ciudades que no aparecen en ese subgrafo son las que se quedan sin camino.

## Cómo se mantienen las réplicas

- Incidentes: al reportar o cerrar uno, el backend lo guarda primero en MongoDB con `sincronizado: false`, lo copia al grafo con `MERGE` y luego lo marca `sincronizado: true`. Si Neo4j no responde, la API contesta 202 y el reporte queda pendiente.
- Ciudades y vehículos: los copia el procesador de eventos pendientes de PostgreSQL (parte del compañero).
- `POST /admin/reconciliar` compara las tres réplicas contra su fuente de verdad y corrige lo que se haya quedado atrás. Todas sus escrituras usan `MERGE`, así que correrla dos veces no cambia nada la segunda vez.
