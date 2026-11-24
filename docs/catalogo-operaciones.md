# Catálogo de operaciones

Cada operación de la API con las bases que toca y cómo se comporta si una de ellas falla. El contrato completo (parámetros, cuerpos y respuestas) está en Swagger: `http://localhost:3000/docs`.

Las bases se abrevian así: PG es PostgreSQL, MG es MongoDB y N4 es Neo4j. "Lee" o "escribe" indica qué hace la operación en cada una.

## Red, rutas y ubicación (Rafael)

`GET /health`. Lee PG, MG y N4 con un ping cada una. Responde 200 si las tres contestan y 503 con el estado de cada una si alguna falla.

`GET /red/puntos`. Lee N4. Lista ciudades, intersecciones y estaciones.

`GET /red/mapa`. Lee N4 con cuatro consultas en paralelo: puntos con coordenadas, tramos (una línea por par de puntos), incidentes activos y ubicación de los vehículos. Es lo que usa la interfaz para dibujar la red.

`POST /red/intersecciones`, `POST /red/estaciones`, `DELETE /red/intersecciones/{id}`. Escriben N4. El borrado se niega (409) si la intersección tiene incidentes activos o si algún vecino se quedaría sin tramos.

`POST /red/tramos`, `PATCH /red/tramos`, `DELETE /red/tramos`. Escriben N4. Validan R2, R4, R5, R12, R14 y R15 antes de escribir.

`GET /rutas` (C1). Lee N4. Ruta por tiempo, distancia o costo con restricciones de terracería y tiempo máximo. Si ninguna ruta cumple, responde 200 con `encontrada: false` y el motivo.

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

Pendiente: aquí van `/clientes`, `/conductores`, `/vehiculos`, `/ciudades`, `/envios`, la asignación, los manifiestos, la bitácora y el login.
