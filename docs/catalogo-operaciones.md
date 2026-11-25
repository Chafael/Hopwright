# Catálogo de operaciones

Cada operación de la API con las bases que toca y cómo se comporta si una de ellas falla. El contrato completo (parámetros, cuerpos y respuestas) está en Swagger: `http://localhost:3000/docs`.

Las bases se abrevian así: PG es PostgreSQL, MG es MongoDB y N4 es Neo4j. "Lee" o "escribe" indica qué hace la operación en cada una.

## Red, rutas y ubicación (Rafael)

Las consultas no piden sesión. Las escrituras de la red (`/red/intersecciones`, `/red/estaciones`, `/red/tramos`) y `POST /admin/reconciliar` son solo para el administrador; reportar, cerrar o agregar evidencias a un incidente y mover un vehículo piden despachador o administrador. Sin token responden 401 y con un rol que no alcanza, 403.

`GET /health`. Lee PG, MG y N4 con un ping cada una. Responde 200 si las tres contestan y 503 con el estado de cada una si alguna falla.

`GET /red/puntos`. Lee N4. Lista ciudades, intersecciones y estaciones.

`GET /red/mapa`. Lee N4 con cuatro consultas en paralelo: puntos con coordenadas, tramos (una línea por par de puntos), incidentes activos y ubicación de los vehículos. Es lo que usa la interfaz para dibujar la red.

`POST /red/intersecciones`, `POST /red/estaciones`, `DELETE /red/intersecciones/{id}`. Escriben N4. El borrado se niega (409) si la intersección tiene incidentes activos o si algún vecino se quedaría sin tramos.

`POST /red/tramos`, `PATCH /red/tramos`, `DELETE /red/tramos`. Escriben N4. Validan R2, R4, R5, R12, R14 y R15 antes de escribir.

`GET /rutas` (C1). Lee N4. Ruta por tiempo, distancia o costo con restricciones de terracería y tiempo máximo. Si ninguna ruta cumple, responde 200 con `encontrada: false` y el motivo.

`GET /rutas/exploracion`. Lee N4 (la red completa y los puntos bloqueados) y calcula la ruta con Neo4j. Repite Dijkstra, normal o bidireccional, paso a paso con las mismas restricciones, regresa en orden cada punto resuelto y cada tramo revisado, y dice si llegó al mismo costo que Neo4j. Es lo que anima la interfaz.

`GET /rutas/camion-tren` (C2). Lee N4. Compara mandar la carga solo en camión contra combinar camión y tren.

`GET /red/ciudades-aisladas` (C4). Lee N4. Ciudades que se quedan sin camino si se cierra un punto.

`GET /vehiculos/{placa}/ubicacion`. Lee N4.

`PATCH /vehiculos/{placa}/ubicacion`. Lee PG (tipo de vehículo) y escribe N4. Si PG no responde o la tabla no existe todavía, valida R11 con la ubicación actual del vehículo y lo dice en `avisos`.

## Incidentes (Rafael)

`POST /incidentes`. Escribe MG y luego N4. 201 si quedó en las dos, 202 si N4 no respondió (el reporte queda con `sincronizado: false`). 400 si el detalle no corresponde al tipo, 404 si el punto no existe en la red.

`GET /incidentes`, `GET /incidentes/{id}`. Leen MG. Filtros por `activo`, `gravedad`, `tipo`, `idPunto` y `sincronizado`.

`PATCH /incidentes/{id}/cerrar`. Escribe MG y luego N4. 200 o 202 igual que el alta; 409 si ya estaba cerrado.

`POST /incidentes/{id}/evidencias`. Escribe MG con `$push`. No toca N4 porque las evidencias no se replican.

`GET /incidentes/{id}/envios-afectados` (C5). Lee MG (incidente y restricciones del manifiesto), PG (envíos en camino y su vehículo) y N4 (ubicación del vehículo, ruta sin el incidente y ruta que rodea el punto). Mientras no existan las tablas de envíos responde 200 con un aviso.

`POST /admin/reconciliar`. Lee MG y PG, escribe N4. Copia al grafo los incidentes, ciudades y vehículos que falten o no coincidan, borra los incidentes y vehículos que sobren, y marca `sincronizado: true` en MG. Necesita N4 y MG arriba (503 si no); si una tabla de PG no existe, salta esa parte con un aviso.

## Envíos, flota y usuarios (compañero)

`POST /auth/login`. Valida contra PostgreSQL con bcrypt y devuelve un JWT; credenciales inválidas responden 401 con el mismo mensaje. Los token se envían como `Authorization: Bearer <token>`. Un token válido con rol insuficiente responde 403; los `GET` quedan abiertos.

`GET/POST /ciudades`. Lista o crea ciudades con clave INEGI de 5 dígitos. POST es solo administrador; en transacción guarda en PG y encola `CIUDAD_GUARDADA` para replicar en Neo4j.

`GET/POST/PUT/DELETE /clientes` y `GET/POST/PUT/DELETE /conductores`. POST y PUT requieren despachador o administrador; DELETE requiere administrador. Borrar regresa 204, 404 si no existe y 409 si ya tiene envíos o vehículos asociados (foreign key 23503 traducido a mensaje claro).

`GET/POST /vehiculos` y `PATCH /vehiculos/{placa}`. POST y PATCH son solo administrador; validan placa, tipo, capacidad y estado; en transacción escriben PG y encolan `VEHICULO_GUARDADO` para el grafo.

`GET/POST /envios` y `GET /envios/{id}`. POST requiere despachador o administrador, valida formato `E-[0-9]+`, peso positivo, prioridad, cliente y ciudades existentes; los dos IDs de ciudad no pueden ser iguales.

`POST /envios/{id}/asignacion`. Requiere despachador o administrador. Bloquea el envío con `FOR UPDATE` antes que el vehículo, verifica que el envío esté Pendiente, que el vehículo esté Disponible y con capacidad suficiente, y que no haya asignaciones activas duplicadas. Crea la asignación, cambia estados y encola `ASIGNACION_CREADA`.

`POST /envios/{id}/salida`, `POST /envios/{id}/entrega` y `POST /envios/{id}/cancelacion`. Requieren despachador o administrador. Salida: Asignado a En camino. Entrega: En camino a Entregado, cierra la asignación, libera el vehículo y encola `ENVIO_ENTREGADO` con la placa; al aplicarlo, el procesador escribe la bitácora y deja el camión en la ciudad de destino en N4 (un tren no se mueve, solo puede estar en una estación). Cancelación: solo desde Pendiente o Asignado, cierra la asignación, libera el vehículo y encola `ENVIO_CANCELADO`. Cualquier transición inválida responde 409.

`GET/POST /envios/{id}/manifiesto`. POST requiere despachador o administrador. Fastify valida la forma general con ejemplos para carga general, refrigerada y peligrosa; MongoDB aplica el `$jsonSchema` por tipo y un documento rechazado responde 400 con mensaje claro. `GET /envios/{id}/bitacora` devuelve los eventos ordenados por fecha; `GET /envios/{id}/datos-ruta` entrega el contrato a la otra parte.

## Flujo integrado (los dos)

`GET /envios/{id}/ruta`. Lee PG (origen, destino, peso, estado y vehículos Disponibles que aguantan el peso), MG (manifiesto: una carga peligrosa no usa terracería y una refrigerada tiene tiempo máximo) y N4 (ruta que cumple esas condiciones esquivando incidentes de gravedad Alta, y el vehículo candidato que llega antes al origen por carretera). Parámetro opcional `criterio` (`tiempo`, `distancia` o `costo`). Responde 200 con la ruta, el vehículo sugerido, los avisos de las tres partes y `fuentes` con lo que aportó cada base. Sin manifiesto calcula sin restricciones y lo avisa; si ninguna ruta cumple, `encontrada: false` con el motivo; un envío entregado o cancelado se puede consultar con aviso. 404 si el envío no existe o una ciudad no está en la red, 400 si el criterio no es válido. Prueba de punta a punta: `tests/e2e/ruta-envio.test.ts`.
