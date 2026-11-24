# Prueba de rendimiento

Corrida el 24/11/2026, 12:25:30 a.m. con `npm run rendimiento` (script en `tests/rendimiento/rendimiento.mts`).

Cada escenario manda 200 peticiones HTTP con 10 clientes a la vez, después de 10 peticiones de calentamiento que no se cuentan. Los tiempos son de ida y vuelta medidos desde el cliente, en milisegundos. p95 quiere decir que el 95 % de las peticiones tardó eso o menos.

## Equipo

- Procesador: AMD Ryzen 5 7535HS with Radeon Graphics (12 hilos)
- Memoria: 15 GB
- Sistema operativo: win32 10.0.26200 (x64)
- Node.js: v26.13.1

Las tres bases corren en Docker en el mismo equipo que el backend.

## Resultados

| Escenario | Bases | Peticiones/s | p50 | p95 | p99 | Máx | Errores |
|---|---|---:|---:|---:|---:|---:|---:|
| GET /health | PostgreSQL, MongoDB y Neo4j (ping) | 366.7 | 22.1 | 71 | 131.6 | 142.7 | 0 |
| GET /rutas (C1, por tiempo) | Neo4j | 135.5 | 69.8 | 96.1 | 101.5 | 103.7 | 0 |
| GET /rutas (C1, con restricciones) | Neo4j | 137.4 | 67.9 | 84.7 | 141.5 | 145.4 | 0 |
| GET /rutas/camion-tren (C2) | Neo4j | 18.5 | 526.4 | 609.2 | 631 | 655.8 | 0 |
| GET /red/ciudades-aisladas (C4) | Neo4j | 331.6 | 28.8 | 42.1 | 50.1 | 57.8 | 0 |
| GET /incidentes?activo=true | MongoDB | 1038.5 | 9.1 | 12.6 | 13.5 | 38.6 | 0 |
| POST /incidentes | MongoDB y Neo4j (escritura en las dos) | 146.2 | 49.5 | 171.8 | 245.4 | 271.1 | 0 |
| GET /incidentes/{id}/envios-afectados (C5) | MongoDB, PostgreSQL y Neo4j | 259.1 | 37.6 | 47.9 | 56.5 | 61.3 | 0 |
| PATCH /vehiculos/{placa}/ubicacion | PostgreSQL (lectura) y Neo4j (escritura) | 132.3 | 70.8 | 106.5 | 152.9 | 180.1 | 0 |

## Datos en las bases al momento de la prueba

- Neo4j, nodos: Ciudad 22, Estacion 5, Incidente 2, Interseccion 9, Vehiculo 7
- Neo4j, aristas: BLOQUEA 2, CARRETERA 66, SE_ENCUENTRA_EN 7, UBICADA_EN 5, VIA_FERREA 8
- MongoDB: contadores 1, reportes_incidente 2
- PostgreSQL: vacía

## Cómo leer estos números

Son los datos de ejemplo del proyecto, no un volumen de producción. La prueba sirve para comparar los flujos entre sí y para detectar si un cambio los vuelve más lentos, no para predecir cuántos usuarios aguantaría el sistema en un servidor real. Las escrituras que tocan dos bases (alta de incidente, movimiento de vehículo) tienen que esperar a las dos, así que es normal que tarden más que una lectura de una sola base.
