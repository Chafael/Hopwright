# Pruebas automatizadas

Generado por `npm run pruebas:reporte` el 27/11/2026, 6:44:22 p.m., commit `08fe8f7`, con las tres bases en Docker y los datos de prueba recién cargados.

Resultado: 145 de 145 pruebas pasaron.

| Grupo | Archivos | Pruebas | Pasaron |
|---|---|---|---|
| Unitarias (sin bases de datos) | 8 | 52 | 52 |
| Integración (contra las tres bases en Docker) | 11 | 84 | 84 |
| Extremo a extremo (flujo integrado) | 1 | 7 | 7 |
| Consistencia entre bases (apagan Neo4j) | 2 | 2 | 2 |

## Unitarias (sin bases de datos)

### tests/unit/envios-afectados.test.ts

- pasó: enviosAfectados (C5) › solo marca los envíos cuya ruta pasa por el punto y calcula los minutos extra (6 ms)
- pasó: enviosAfectados (C5) › calcula desde donde está el vehículo, no desde el origen (1 ms)
- pasó: enviosAfectados (C5) › un incidente cerrado no afecta a nadie (0 ms)
- pasó: enviosAfectados (C5) › avisa si las tablas de PostgreSQL todavía no existen (0 ms)
- pasó: enviosAfectados (C5) › 404 si el incidente no existe (1 ms)

### tests/unit/envios-ruta.test.ts

- pasó: planearRutaDeEnvio › pasa las restricciones del manifiesto y los candidatos al cálculo en el grafo (4 ms)
- pasó: planearRutaDeEnvio › junta los avisos de las dos partes y avisa si nadie aguanta el peso (1 ms)
- pasó: planearRutaDeEnvio › un envío cancelado se puede consultar pero lo avisa (0 ms)
- pasó: planearRutaDeEnvio › si el envío no existe, el error de PostgreSQL sube sin consultar el grafo (4 ms)

### tests/unit/incidentes.reglas.test.ts

- pasó: tipoDePunto › reconoce ciudades e intersecciones (3 ms)
- pasó: tipoDePunto › no acepta estaciones ni ids mal formados (0 ms)
- pasó: problemasDelDetalle › acepta un bloqueo completo (1 ms)
- pasó: problemasDelDetalle › pide los campos obligatorios de cada tipo (1 ms)
- pasó: problemasDelDetalle › rechaza campos de otro tipo y valores fuera de rango (0 ms)
- pasó: problemasDelDetalle › revisa el tipo de cada valor (0 ms)
- pasó: normalizarDetalle › convierte las fechas de texto en Date (0 ms)
- pasó: formatearIdIncidente › rellena con ceros a cuatro dígitos (0 ms)

### tests/unit/manifiestos.validacion.test.ts

- pasó: validación de manifiestos › acepta general válido (3 ms)
- pasó: validación de manifiestos › acepta refrigerada válida (0 ms)
- pasó: validación de manifiestos › acepta peligrosa válida (0 ms)
- pasó: validación de manifiestos › rechaza peligrosa sin claseUN (1 ms)

### tests/unit/reconciliacion.test.ts

- pasó: reconciliar incidentes › copia los que faltan o no coinciden y borra los que no están en MongoDB (4 ms)
- pasó: reconciliar incidentes › reporta los que apuntan a un punto que ya no existe (0 ms)
- pasó: reconciliar ciudades y vehículos › salta las tablas que no existen con un aviso (1 ms)
- pasó: reconciliar ciudades y vehículos › copia ciudades nuevas o renombradas y no borra las que solo están en el grafo (1 ms)
- pasó: reconciliar ciudades y vehículos › borra vehículos que ya no están en PostgreSQL (1 ms)
- pasó: reconciliar ciudades y vehículos › no borra la flota si PostgreSQL no tiene vehículos (1 ms)

### tests/unit/rutas.calculos.test.ts

- pasó: velocidad de un tramo (R15) › calcula km/h a partir de distancia y minutos (2 ms)
- pasó: validación de tramos (R4, R5, R15) › acepta un tramo normal (1 ms)
- pasó: validación de tramos (R4, R5, R15) › rechaza distancia o tiempo en cero o negativos (1 ms)
- pasó: validación de tramos (R4, R5, R15) › rechaza costos negativos (0 ms)
- pasó: validación de tramos (R4, R5, R15) › rechaza velocidades de más de 110 km/h (dato mal capturado) (1 ms)
- pasó: validación de tramos (R4, R5, R15) › acepta exactamente 110 km/h (caso límite) (0 ms)
- pasó: costos de camión y tren › camión: casetas más kilómetros por costo por km (0 ms)
- pasó: costos de camión y tren › tren: costo por tonelada por las toneladas de la carga (0 ms)
- pasó: elegir la opción más barata y la más rápida › separa la más barata de la más rápida (1 ms)
- pasó: elegir la opción más barata y la más rápida › ignora opciones que no existen (0 ms)
- pasó: elegir la opción más barata y la más rápida › regresa null si no hay ninguna opción (0 ms)

### tests/unit/rutas.exploracion.test.ts

- pasó: dijkstra paso a paso › encuentra el camino más barato y registra cada punto y tramo revisado (3 ms)
- pasó: dijkstra paso a paso › respeta los puntos bloqueados y la terracería (0 ms)
- pasó: dijkstra paso a paso › no usa tramos cerrados (0 ms)
- pasó: dijkstra paso a paso › el bidireccional llega al mismo costo y crece desde los dos lados (1 ms)
- pasó: sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración) › lee los 333 tramos de carretera (2 ms)
- pasó: sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración) › Tuxtla a San Cristóbal: 73 minutos por tiempo y sin casetas por costo (2 ms)
- pasó: sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración) › San Cristóbal a Totolapa: 80 minutos por terracería y 108 evitándola (3 ms)
- pasó: sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración) › con la caseta de Chiapa de Corzo bloqueada, el rodeo a San Cristóbal tarda 176 minutos (1 ms)
- pasó: sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración) › el bidireccional da el mismo resultado en todos los pares y en general revisa menos puntos (4083 ms)

### tests/unit/ubicacion.reglas.test.ts

- pasó: motivoParaNoMover (R11) › un tren puede pasar de una estación a otra (2 ms)
- pasó: motivoParaNoMover (R11) › un tren no puede quedar en una ciudad (0 ms)
- pasó: motivoParaNoMover (R11) › un camión puede ir a una ciudad o a una intersección, pero no a una estación (0 ms)
- pasó: motivoParaNoMover (R11) › sin tipo de PostgreSQL usa la ubicación actual (0 ms)
- pasó: motivoParaNoMover (R11) › sin tipo ni ubicación previa deja moverlo (0 ms)

## Integración (contra las tres bases en Docker)

### tests/integration/asignaciones.concurrentes.test.ts

- pasó: asignación concurrente de vehículo › solo permite una asignación simultánea al mismo vehículo (65 ms)

### tests/integration/envios-afectados.test.ts

- pasó: GET /incidentes/{id}/envios-afectados (C5) › revisa los envíos en camino contra el incidente activo de Teopisca (559 ms)
- pasó: GET /incidentes/{id}/envios-afectados (C5) › un incidente cerrado no afecta a ningún envío (12 ms)
- pasó: GET /incidentes/{id}/envios-afectados (C5) › 404 si el incidente no existe (3 ms)

### tests/integration/envios-flota.test.ts

- pasó: envíos, flota y usuarios › no revela cuál credencial falló en el login (203 ms)
- pasó: envíos, flota y usuarios › rechaza ids de envío que no cumplen el formato acordado (2 ms)
- pasó: envíos, flota y usuarios › cancela un envío asignado, desactiva la asignación y escribe el evento en la bitácora (84 ms)
- pasó: envíos, flota y usuarios › rechaza la cancelación de un envío en camino con 409 (33 ms)
- pasó: envíos, flota y usuarios › borra clientes y conductores con 204, 404 y 409 según sus relaciones (74 ms)
- pasó: envíos, flota y usuarios › crea y valida manifiestos, con 400 claro cuando MongoDB rechaza el documento (27 ms)
- pasó: envíos, flota y usuarios › ordena los eventos de la bitácora por fecha y no duplica uno repetido (9 ms)

### tests/integration/envios.test.ts

- pasó: login › con la contraseña de prueba regresa un token (1 ms)
- pasó: login › con una contraseña incorrecta responde 401 (65 ms)
- pasó: login › con un correo que no existe también responde 401, sin decir cuál de los dos falló (2 ms)
- pasó: permisos › sin token no se puede registrar un envío (1 ms)
- pasó: permisos › un despachador no puede cambiar los datos de un vehículo (2 ms)
- pasó: permisos › las consultas no piden token (3 ms)
- pasó: flujo de un envío › se registra, se asigna, sale y se entrega; el vehículo queda libre al final (49 ms)
- pasó: flujo de un envío › si el mismo envío se asigna a dos vehículos a la vez, la segunda petición ve que ya no está pendiente (16 ms)

### tests/integration/grafo-integridad.test.ts

- pasó: integridad de la base de grafos › el archivo trae consultas (2 ms)
- pasó: integridad de la base de grafos › R3 nodos con propiedades obligatorias vacías (74 ms)
- pasó: integridad de la base de grafos › R4 tramos sin distancia o tiempo (10 ms)
- pasó: integridad de la base de grafos › R5 pesos en cero o negativos (10 ms)
- pasó: integridad de la base de grafos › R6 nodos con valores no permitidos (7 ms)
- pasó: integridad de la base de grafos › R6 carreteras con tipoVia no permitido (7 ms)
- pasó: integridad de la base de grafos › R12 CARRETERA entre nodos equivocados (8 ms)
- pasó: integridad de la base de grafos › R12 VIA_FERREA entre nodos equivocados (6 ms)
- pasó: integridad de la base de grafos › R2 tramos duplicados (9 ms)
- pasó: integridad de la base de grafos › R14 tramos sin vuelta (16 ms)
- pasó: integridad de la base de grafos › R15 velocidades imposibles (10 ms)
- pasó: integridad de la base de grafos › Cardinalidad puntos aislados (8 ms)
- pasó: integridad de la base de grafos › Cardinalidad estaciones sin ciudad o con varias (5 ms)
- pasó: integridad de la base de grafos › Cardinalidad incidentes que no bloquean un solo punto (6 ms)
- pasó: integridad de la base de grafos › Cardinalidad vehículos sin ubicación o con varias (5 ms)

### tests/integration/incidentes.test.ts

- pasó: consultar incidentes › lista los reportes de ejemplo (194 ms)
- pasó: consultar incidentes › filtra por activos (5 ms)
- pasó: consultar incidentes › regresa el reporte completo con su detalle y evidencias (4 ms)
- pasó: consultar incidentes › 404 si no existe y 400 si el id está mal escrito (4 ms)
- pasó: reportar y cerrar un incidente › un bloqueo de gravedad Alta queda en las dos bases y cambia la ruta (607 ms)
- pasó: reportar y cerrar un incidente › dos reportes seguidos reciben números distintos (46 ms)
- pasó: reportar y cerrar un incidente › agrega una evidencia al reporte (24 ms)
- pasó: reportes inválidos › 400 si el detalle no corresponde al tipo (1 ms)
- pasó: reportes inválidos › 400 si el punto es una estación o tiene un formato inválido (1 ms)
- pasó: reportes inválidos › 404 si el punto no existe en la red (7 ms)
- pasó: reportes inválidos › 400 si falta un campo, la gravedad no existe o una foto no trae url (2 ms)
- pasó: reportes inválidos › el validador de MongoDB rechaza un documento inválido aunque no pase por la API (3 ms)

### tests/integration/reconciliacion.test.ts

- pasó: POST /admin/reconciliar › solo el administrador puede reconciliar: 401 sin sesión y 403 con un despachador (110 ms)
- pasó: POST /admin/reconciliar › copia lo que falta, corrige lo distinto y borra lo que sobra (242 ms)
- pasó: POST /admin/reconciliar › correrla otra vez no cambia nada (25 ms)
- pasó: POST /admin/reconciliar › avisa si todavía no existen las tablas de PostgreSQL (21 ms)

### tests/integration/relacional.restricciones.test.ts

- pasó: restricciones relacionales › rechaza peso_kg <= 0 (30 ms)
- pasó: restricciones relacionales › rechaza origen igual a destino (14 ms)
- pasó: restricciones relacionales › rechaza id_cliente inexistente (14 ms)
- pasó: restricciones relacionales › rechaza un id de envío que no tiene el formato E-<dígitos> (15 ms)

### tests/integration/rutas.test.ts

- pasó: GET /rutas (C1) › Tuxtla a San Cristóbal por tiempo usa la autopista (1124 ms)
- pasó: GET /rutas (C1) › Tuxtla a San Cristóbal por costo usa la libre y no paga caseta (89 ms)
- pasó: GET /rutas (C1) › San Cristóbal a Totolapa: la más rápida usa terracería; una carga peligrosa no (145 ms)
- pasó: GET /rutas (C1) › si nadie cumple el tiempo máximo, responde encontrada=false con el motivo (440 ms)
- pasó: GET /rutas (C1) › avisa cuando la ruta pasa por un incidente activo que no bloquea (gravedad Media) (74 ms)
- pasó: GET /rutas (C1) › esquiva un punto con un incidente activo de gravedad Alta (R16) (240 ms)
- pasó: GET /rutas (C1) › 404 si la ciudad no existe (15 ms)
- pasó: GET /rutas (C1) › 400 si origen y destino son iguales (1 ms)
- pasó: GET /rutas (C1) › 400 si la clave de ciudad no tiene 5 dígitos (2 ms)
- pasó: GET /rutas/camion-tren (C2) › Tuxtla a Tapachula con 20 toneladas: el camión es más rápido y el tren más barato (752 ms)
- pasó: GET /rutas/camion-tren (C2) › 400 si el peso es cero (1 ms)
- pasó: GET /red/ciudades-aisladas (C4) › si se cierra Tapachula, los municipios de la frontera del Soconusco se quedan sin camino a Tuxtla (105 ms)
- pasó: GET /red/ciudades-aisladas (C4) › si se cierra Juárez, Reforma se queda sin camino (23 ms)
- pasó: GET /red/ciudades-aisladas (C4) › si se cierra el entronque de Oxchuc nadie queda aislado, porque hay caminos alternos (21 ms)
- pasó: GET /red/ciudades-aisladas (C4) › 404 si el punto no existe (71 ms)
- pasó: GET /rutas/exploracion › repite la búsqueda paso a paso y llega al mismo resultado que Neo4j (74 ms)
- pasó: GET /rutas/exploracion › el bidireccional también coincide con Neo4j (144 ms)
- pasó: GET /rutas/exploracion › evitando terracería coincide con los 108 minutos de San Cristóbal a Totolapa (70 ms)
- pasó: GET /rutas/exploracion › 400 con un algoritmo desconocido (1 ms)
- pasó: GET /red/mapa › regresa los 138 puntos con coordenadas, una línea por tramo, incidentes activos y vehículos (105 ms)
- pasó: GET /red/puntos › lista los 138 puntos de la red de ejemplo (47 ms)

### tests/integration/salud.test.ts

- pasó: GET /health › responde 200 y las tres bases en ok (201 ms)
- pasó: GET /health › una ruta que no existe responde 404 con el formato de error común (2 ms)

### tests/integration/ubicacion.test.ts

- pasó: ubicación de vehículos › consulta dónde está un vehículo (185 ms)
- pasó: ubicación de vehículos › mueve un camión a otra ciudad y deja una sola ubicación (83 ms)
- pasó: ubicación de vehículos › un camión no puede quedar en una estación (R11) (9 ms)
- pasó: ubicación de vehículos › el tren no puede salir a una ciudad (R11) (8 ms)
- pasó: ubicación de vehículos › 404 si el vehículo o el punto no existen (21 ms)
- pasó: ubicación de vehículos › 401 sin sesión: mover un vehículo requiere despachador o administrador (1 ms)
- pasó: ubicación de vehículos › 400 si falta el punto o la placa tiene un formato inválido (1 ms)

## Extremo a extremo (flujo integrado)

### tests/e2e/ruta-envio.test.ts

- pasó: ruta de un envío con los datos de ejemplo › carga peligrosa (E-103): la ruta evita terracería y el vehículo sugerido aguanta el peso (311 ms)
- pasó: ruta de un envío con los datos de ejemplo › da la misma ruta que GET /rutas con las restricciones del manifiesto (191 ms)
- pasó: ruta de un envío con los datos de ejemplo › carga refrigerada (E-102): respeta el tiempo máximo del manifiesto (220 ms)
- pasó: ruta de un envío con los datos de ejemplo › un envío entregado se puede consultar, con aviso (220 ms)
- pasó: ruta de un envío con los datos de ejemplo › un envío que no existe responde 404 y un criterio inválido 400 (3 ms)
- pasó: flujo completo de un envío nuevo › sin manifiesto calcula la ruta sin restricciones y lo avisa (145 ms)
- pasó: flujo completo de un envío nuevo › alta, manifiesto, ruta, asignación, salida y entrega; el camión queda en el destino (212 ms)

## Consistencia entre bases (apagan Neo4j)

### tests/consistencia/incidente-sin-neo4j.test.ts

- pasó: un incidente reportado con Neo4j apagado llega al grafo al reconciliar (24339 ms)

### tests/consistencia/vehiculo-sin-neo4j.test.ts

- pasó: un vehículo registrado con Neo4j apagado se guarda en PostgreSQL y se replica al reconectar (15096 ms)
