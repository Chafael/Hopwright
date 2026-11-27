# Prueba de rendimiento

Corrida el 27/11/2026, 4:50:59 p.m. con `npm run rendimiento` (script en `tests/rendimiento/rendimiento.mts`).

Cada escenario manda 200 peticiones HTTP con 10 clientes a la vez, después de 10 peticiones de calentamiento que no se cuentan. Los tiempos son de ida y vuelta medidos desde el cliente, en milisegundos. p95 quiere decir que el 95 % de las peticiones tardó eso o menos.

## Equipo

- Procesador: AMD Ryzen 5 7535HS with Radeon Graphics (12 hilos)
- Memoria: 15 GB
- Sistema operativo: win32 10.0.26200 (x64)
- Node.js: v24.15.0

Las tres bases corren en Docker en el mismo equipo que el backend.

## Resultados

| Escenario | Bases | Peticiones/s | p50 | p95 | p99 | Máx | Errores |
|---|---|---:|---:|---:|---:|---:|---:|
| GET /health | PostgreSQL, MongoDB y Neo4j (ping) | 365.6 | 22.3 | 90.4 | 125 | 131.9 | 0 |
| GET /rutas (C1, por tiempo) | Neo4j | 122.5 | 78.1 | 105.1 | 110.8 | 118.8 | 0 |
| GET /rutas (C1, con restricciones) | Neo4j | 131.6 | 74.9 | 90.6 | 94.8 | 95 | 0 |
| GET /rutas/camion-tren (C2) | Neo4j | 17.7 | 552.2 | 628.9 | 689.4 | 693 | 0 |
| GET /red/ciudades-aisladas (C4) | Neo4j | 265.5 | 35.9 | 49.6 | 55 | 57.3 | 0 |
| GET /incidentes?activo=true | MongoDB | 772.2 | 12.4 | 16.3 | 19.8 | 60.5 | 0 |
| POST /incidentes | MongoDB y Neo4j (escritura en las dos) | 163.1 | 47.5 | 141.2 | 183.4 | 218.1 | 0 |
| GET /incidentes/{id}/envios-afectados (C5) | MongoDB, PostgreSQL y Neo4j | 142.8 | 66.1 | 92.1 | 113.1 | 116.8 | 0 |
| GET /envios | PostgreSQL | 1186.5 | 8.1 | 13.2 | 15.4 | 16 | 0 |
| GET /envios/{id}/manifiesto | MongoDB | 959.7 | 10 | 13.6 | 15 | 18 | 0 |
| GET /envios/{id}/ruta (flujo integrado) | PostgreSQL, MongoDB y Neo4j | 68.7 | 138.6 | 176.5 | 182.9 | 189.2 | 0 |
| PATCH /vehiculos/{placa}/ubicacion | PostgreSQL (lectura) y Neo4j (escritura) | 167.6 | 56.5 | 83.1 | 129.8 | 157.9 | 0 |

## Datos en las bases al momento de la prueba

- Neo4j, nodos: Ciudad 124, Estacion 5, Incidente 2, Interseccion 9, Vehiculo 7
- Neo4j, aristas: BLOQUEA 2, CARRETERA 666, SE_ENCUENTRA_EN 7, UBICADA_EN 5, VIA_FERREA 8
- MongoDB: manifiestos 6, reportes_incidente 2, contadores 1, bitacora_envio 2
- PostgreSQL: asignacion 4, ciudad 124, cliente 4, conductor 4, envio 8, eventos_pendientes 0, usuario 2, vehiculo 7

## Cómo leer estos números

Son los datos de ejemplo del proyecto, no un volumen de producción. La prueba sirve para comparar los flujos entre sí y para detectar si un cambio los vuelve más lentos, no para predecir cuántos usuarios aguantaría el sistema en un servidor real. Las escrituras que tocan dos bases (alta de incidente, movimiento de vehículo) tienen que esperar a las dos, así que es normal que tarden más que una lectura de una sola base.
