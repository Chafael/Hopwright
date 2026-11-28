# Entregable 1. Propuesta de aplicación

Esta es la propuesta con la que arrancamos el proyecto, ajustada a lo que se construyó al final. Los cambios respecto a la primera versión están en la sección 10. La matriz de responsabilidades, la fuente de verdad y el flujo integrado se desarrollan en [arquitectura.md](arquitectura.md); la elección de tecnologías, en [decisiones-tecnologicas.md](decisiones-tecnologicas.md).

## 1. Nombre

Hopwright. "Hop" es un salto, que en un grafo es pasar de un nodo al siguiente, y "wright" es quien construye algo a mano. El nombre describe lo que hace el sistema: arma rutas salto por salto.

## 2. Problema

Las empresas de paquetería regionales en Chiapas planean sus rutas con lo que saben los despachadores y con hojas de cálculo. Eso trae tres problemas que se repiten:

- Cuando hay un bloqueo, un derrumbe o una obra en la carretera, nadie sabe rápido qué envíos van a pasar por ahí ni cuál es el camino alterno.
- La asignación de camiones se lleva a mano. A veces dos despachadores le dan el mismo camión a dos envíos, o le asignan una carga que pesa más de lo que aguanta el vehículo.
- Cada tipo de carga tiene requisitos distintos (una refrigerada necesita rango de temperatura y un tiempo máximo de viaje; una peligrosa, clase UN y hoja de seguridad) y esa información queda en papel, lejos de la decisión de la ruta.

## 3. Usuarios y necesidades

- Despachador: registra envíos y su manifiesto de carga, asigna vehículos, marca la salida, la entrega o la cancelación, pide la ruta de cada envío, reporta y cierra incidentes, y consulta qué envíos afecta un incidente.
- Administrador: hace lo mismo que el despachador y además da de alta ciudades, vehículos, intersecciones, estaciones y tramos de la red, borra clientes y conductores, y corre la reconciliación entre bases.

Los clientes de la paquetería no usan el sistema; sus datos los captura el despachador.

## 4. Objetivo general

Que el despachador asigne vehículos sin conflictos y obtenga, para cada envío, la ruta más conveniente por tiempo, distancia o costo, respetando los requisitos de la carga y esquivando los incidentes activos.

## 5. Alcance

Sí se desarrolla:

- Alta, consulta, modificación y baja de clientes, conductores, vehículos, ciudades y envíos.
- Gestión de la red: intersecciones, estaciones y tramos de carretera y de vía férrea con sus pesos.
- Manifiestos de carga por tipo (general, refrigerada, peligrosa) con validación de estructura.
- Reportes de incidente con evidencias, y bloqueo automático del punto cuando el incidente es de gravedad Alta.
- Asignación de vehículo a envío dentro de una transacción, y el ciclo del envío: salida, entrega y cancelación.
- Ruta más rápida, más corta o más barata, y comparación entre ir solo en camión o combinar camión y tren.
- Envíos en camino afectados por un incidente, con su desvío y los minutos extra.
- Ciudades que se quedan sin camino si se cierra un punto.
- Bitácora de seguimiento de cada envío.
- Mapa de la red con las rutas, los incidentes y la ubicación de cada vehículo.
- Inicio de sesión con dos roles.
- Reconciliación de las copias entre bases.

No se desarrolla:

- Ubicación por GPS en tiempo real; la ubicación del vehículo se actualiza a mano o al entregar un envío.
- Pagos ni facturación.
- App para conductores ni consulta pública de rastreo para clientes.
- Optimización de varios envíos en un mismo viaje.
- Tráfico en tiempo real; los tiempos de cada tramo son fijos.
- Red fuera de Chiapas. La red cubre las 124 cabeceras municipales del estado, 9 intersecciones y las 5 estaciones del tren de la costa.

## 6. Operaciones prioritarias

1. Registrar un envío con su manifiesto de carga.
2. Asignar un vehículo disponible a un envío.
3. Calcular la ruta de un envío según tiempo, distancia o costo, con las restricciones de su carga.
4. Comparar la ruta solo en camión contra la que usa el tren en una parte.
5. Reportar un incidente y bloquear el punto afectado.
6. Consultar qué envíos en camino pasan por un punto bloqueado y cuánto se retrasan con el desvío.
7. Consultar qué ciudades quedan sin camino cuando se cierra un punto.
8. Consultar la bitácora de un envío.
9. Dar de alta y modificar tramos de la red con sus pesos.
10. Dar de alta, consultar, modificar y dar de baja clientes, conductores y vehículos.

Cada una está en el [catálogo de operaciones](catalogo-operaciones.md) con sus casos normales, límite y de error.

## 7. Datos necesarios

- Base relacional: usuario, cliente, conductor, vehículo, ciudad (catálogo del INEGI), envío, asignación y la cola de eventos pendientes.
- Base documental: manifiestos de carga, reportes de incidente con sus evidencias y bitácora de seguimiento de cada envío.
- Base de grafos: nodos `Ciudad`, `Interseccion`, `Estacion`, `Incidente` y `Vehiculo`; relaciones `CARRETERA`, `VIA_FERREA`, `UBICADA_EN`, `BLOQUEA` y `SE_ENCUENTRA_EN`.

Respecto al modelo lógico de grafos que entregamos en la actividad anterior, `Envio` salió del grafo y sus relaciones `SALE_DE`, `VA_A` y `TRANSPORTADO_EN` pasaron a la base relacional como llaves foráneas. Así el mismo envío no vive en dos bases, y las consultas del grafo reciben el origen y el destino como parámetros.

## 8. Justificación de los tres modelos

- Relacional (PostgreSQL): los envíos, vehículos y asignaciones necesitan llaves foráneas, estados controlados y transacciones. Asignar un vehículo cambia tres registros al mismo tiempo y no puede quedar a medias ni duplicarse.
- Documental (MongoDB): un manifiesto cambia de forma según el tipo de carga, y un reporte de incidente trae fotos, testimonios y campos distintos para un bloqueo, un accidente, una obra o un derrumbe. En tablas serían muchas columnas vacías o una tabla por tipo.
- Grafos (Neo4j): la pregunta central del sistema es cuál es el mejor camino entre dos puntos, sumando pesos por tramos cuyo número no se conoce de antemano. Neo4j recorre esas conexiones directamente.

### Prueba de suficiencia

La guía pide una operación concreta por modelo y responder qué se pierde si se quita una base:

- Relacional: asignar un vehículo a un envío. Hay que revisar que el vehículo esté Disponible y aguante el peso, cambiarlo a En ruta, pasar el envío a Asignado y guardar la asignación. Si dos despachadores lo intentan con el mismo camión al mismo tiempo, solo uno lo logra. Sin esta base perdemos la garantía de que no haya dobles asignaciones ni datos a medias.
- Documental: registrar el manifiesto de una carga peligrosa. El documento lleva la lista de artículos, la clase UN, el número ONU, la hoja de seguridad y el teléfono de emergencia; una carga refrigerada llevaría otros campos. Sin esta base esos datos terminan en columnas vacías o en texto libre sin validar.
- Grafos: calcular la ruta más rápida de Tuxtla Gutiérrez a Tapachula esquivando los puntos bloqueados. Sin esta base tendríamos que programar a mano el recorrido de la red y la suma de pesos con consultas recursivas.

Ninguna de las tres se puede quitar sin que la aplicación pierda una capacidad que el despachador usa todos los días.

## 9. Ejemplos de consultas por modelo

Son versiones cortas de las que usa la aplicación. Las completas están en `database/*/queries/` y en `backend/src/repositories/`.

### Relacional

Vehículos que pueden llevar un envío de 3,000 kg (son los candidatos del flujo integrado):

```sql
SELECT placa, tipo, capacidad_kg
FROM vehiculo
WHERE estado = 'Disponible' AND capacidad_kg >= 3000
ORDER BY capacidad_kg, placa;
```

Asignación dentro de una transacción. Los `FOR UPDATE` bloquean el envío y el vehículo para que otro despachador no los tome al mismo tiempo, y el evento queda en la misma transacción:

```sql
BEGIN;
SELECT estado, peso_kg FROM envio WHERE id_envio = $1 FOR UPDATE;
SELECT estado, capacidad_kg FROM vehiculo WHERE placa = $2 FOR UPDATE;
INSERT INTO asignacion (id_envio, placa) VALUES ($1, $2);
UPDATE envio SET estado = 'Asignado' WHERE id_envio = $1;
UPDATE vehiculo SET estado = 'En ruta' WHERE placa = $2;
INSERT INTO eventos_pendientes (tipo, payload) VALUES ('ASIGNACION_CREADA', $3);
COMMIT;
```

### Documental

Cargas peligrosas con lo que necesita saber el conductor en una emergencia (campos que solo existen en ese tipo de carga):

```js
db.manifiestos.find(
  { tipoCarga: "peligrosa" },
  { _id: 0, idEnvio: 1, claseUN: 1, numeroONU: 1, telefonoEmergencia: 1 }
)
```

Incidentes activos de gravedad Alta, del más reciente al más antiguo:

```js
db.reportes_incidente.find({ activo: true, gravedad: "Alta" }).sort({ fechaInicio: -1 })
```

### Grafos

Ruta más rápida entre dos ciudades sumando minutos, con el algoritmo de Dijkstra de APOC, sin terracería y sin pasar por puntos bloqueados:

```cypher
MATCH (o:Ciudad {idCiudad: $origen}), (d:Ciudad {idCiudad: $destino})
CALL apoc.algo.dijkstra(o, d, 'CARRETERA>', 'tiempoMin', 0.0, 10) YIELD path, weight
WITH path, weight
WHERE all(r IN relationships(path) WHERE coalesce(r.abierto, true) AND r.tipoVia <> 'Terracería')
  AND none(n IN nodes(path) WHERE EXISTS {
        MATCH (n)<-[:BLOQUEA]-(i:Incidente) WHERE i.activo AND i.gravedad = 'Alta' })
RETURN [n IN nodes(path) | n.nombre] AS ruta, weight AS minutos
ORDER BY weight LIMIT 1;
```

Ciudades que se quedan sin camino hacia Tuxtla Gutiérrez si se cierra un entronque:

```cypher
MATCH (cerrado:Interseccion {idInterseccion: $punto}), (t:Ciudad {idCiudad: '07101'})
CALL apoc.path.subgraphNodes(t, {relationshipFilter: '<CARRETERA', denylistNodes: [cerrado]}) YIELD node
WITH cerrado, collect(node) AS alcanzables
MATCH (c:Ciudad) WHERE NOT c IN alcanzables
RETURN c.nombre AS aislada;
```

## 10. Cambios respecto a la propuesta inicial

La propuesta del 19 de noviembre se cumplió en lo esencial. Durante el desarrollo cambiaron cuatro cosas:

- La red pasó de unos 30 puntos de ejemplo a las 124 cabeceras municipales de Chiapas, con tramos calculados sobre carreteras reales de OpenStreetMap. Con 30 puntos las rutas alternas eran pocas y casi no se notaba el efecto de un bloqueo.
- Habíamos dejado fuera los mapas visuales. Al final agregamos un mapa porque ver la ruta y el desvío explica el resultado mejor que una lista de ciudades. El mapa solo dibuja lo que regresa la API; no calcula nada.
- El manifiesto guarda los campos de cada tipo de carga en la raíz del documento (`claseUN`, no `peligrosa.claseUN`) y no copia el estado del envío, que vive en PostgreSQL. Las consultas de ejemplo de arriba ya usan esa forma.
- Se agregaron dos operaciones que no estaban: la exploración paso a paso de Dijkstra, que anima la búsqueda en la interfaz y comprueba que llega al mismo resultado que Neo4j, y la reconciliación entre bases como pantalla del administrador.
