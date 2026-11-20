// Pruebas de integridad de la base de grafos.
// Neo4j Community solo impone unicidad, así que el resto de las reglas del modelo lógico se revisan aquí.
// Cada consulta regresa { prueba, fallas } y en una base sana fallas debe ser 0.
// Las corre tests/integration/grafo-integridad.test.ts, y también se pueden pegar en Neo4j Browser.

// R3: toda Ciudad tiene nombre; toda Interseccion tiene tipo, latitud y longitud
MATCH (n)
WHERE (n:Ciudad AND n.nombre IS NULL)
   OR (n:Interseccion AND (n.tipo IS NULL OR n.latitud IS NULL OR n.longitud IS NULL))
   OR (n:Estacion AND (n.nombre IS NULL OR n.tipoServicio IS NULL))
   OR (n:Incidente AND (n.gravedad IS NULL OR n.activo IS NULL))
RETURN 'R3 nodos con propiedades obligatorias vacías' AS prueba, count(n) AS fallas;

// R4: todo tramo de CARRETERA y VIA_FERREA tiene distanciaKm y tiempoMin
MATCH ()-[r:CARRETERA|VIA_FERREA]->()
WHERE r.distanciaKm IS NULL OR r.tiempoMin IS NULL
RETURN 'R4 tramos sin distancia o tiempo' AS prueba, count(r) AS fallas;

// R5: pesos mayores que cero y costos no negativos
MATCH ()-[r:CARRETERA|VIA_FERREA|UBICADA_EN]->()
WHERE (type(r) <> 'UBICADA_EN' AND (r.distanciaKm <= 0 OR r.tiempoMin <= 0))
   OR coalesce(r.costoCaseta, 0) < 0
   OR coalesce(r.costoPorTonelada, 0) < 0
   OR coalesce(r.tiempoCambioMin, 0) < 0
RETURN 'R5 pesos en cero o negativos' AS prueba, count(r) AS fallas;

// R6: valores permitidos
MATCH (n)
WHERE (n:Interseccion AND NOT n.tipo IN ['Cruce', 'Glorieta', 'Caseta'])
   OR (n:Incidente AND NOT n.gravedad IN ['Baja', 'Media', 'Alta'])
RETURN 'R6 nodos con valores no permitidos' AS prueba, count(n) AS fallas;

MATCH ()-[r:CARRETERA]->()
WHERE NOT r.tipoVia IN ['Autopista', 'Federal', 'Estatal', 'Terracería']
RETURN 'R6 carreteras con tipoVia no permitido' AS prueba, count(r) AS fallas;

// R12: CARRETERA solo entre ciudades e intersecciones, nunca de un punto a sí mismo
MATCH (a)-[r:CARRETERA]->(b)
WHERE NOT (a:Ciudad OR a:Interseccion) OR NOT (b:Ciudad OR b:Interseccion) OR a = b
RETURN 'R12 CARRETERA entre nodos equivocados' AS prueba, count(r) AS fallas;

// R12: VIA_FERREA solo entre estaciones
MATCH (a)-[r:VIA_FERREA]->(b)
WHERE NOT a:Estacion OR NOT b:Estacion OR a = b
RETURN 'R12 VIA_FERREA entre nodos equivocados' AS prueba, count(r) AS fallas;

// R2: un solo tramo por sentido y tipo de camino entre dos puntos
MATCH (a)-[r:CARRETERA]->(b)
WITH a, b, r.tipoVia AS via, count(r) AS n
WHERE n > 1
RETURN 'R2 tramos duplicados' AS prueba, count(*) AS fallas;

// R14: todo tramo de ida tiene su tramo de vuelta
MATCH (a)-[r:CARRETERA|VIA_FERREA]->(b)
WHERE NOT EXISTS { MATCH (b)-[v]->(a) WHERE type(v) = type(r) }
RETURN 'R14 tramos sin vuelta' AS prueba, count(r) AS fallas;

// R15: la velocidad que resulta de distancia y tiempo no pasa de 110 km/h
MATCH ()-[r:CARRETERA|VIA_FERREA]->()
WHERE r.tiempoMin > 0 AND r.distanciaKm / r.tiempoMin * 60 > 110
RETURN 'R15 velocidades imposibles' AS prueba, count(r) AS fallas;

// Cardinalidad 1..N: todo punto tiene al menos un tramo de salida y uno de llegada
MATCH (n)
WHERE ((n:Ciudad OR n:Interseccion) AND (NOT EXISTS { (n)-[:CARRETERA]->() } OR NOT EXISTS { (n)<-[:CARRETERA]-() }))
   OR (n:Estacion AND (NOT EXISTS { (n)-[:VIA_FERREA]->() } OR NOT EXISTS { (n)<-[:VIA_FERREA]-() }))
RETURN 'Cardinalidad puntos aislados' AS prueba, count(n) AS fallas;

// Cardinalidad 1..1: toda estación está en exactamente una ciudad
MATCH (e:Estacion)
WHERE COUNT { (e)-[:UBICADA_EN]->(:Ciudad) } <> 1
RETURN 'Cardinalidad estaciones sin ciudad o con varias' AS prueba, count(e) AS fallas;

// Cardinalidad 1..1: todo incidente bloquea exactamente un punto
MATCH (i:Incidente)
WHERE COUNT { (i)-[:BLOQUEA]->() } <> 1
RETURN 'Cardinalidad incidentes que no bloquean un solo punto' AS prueba, count(i) AS fallas;

// Cardinalidad 1..1: todo vehículo está en un solo lugar.
// Que un tren solo esté en una estación (R11) lo revisa el backend, porque el tipo de vehículo vive en PostgreSQL.
MATCH (v:Vehiculo)
WHERE COUNT { (v)-[:SE_ENCUENTRA_EN]->() } <> 1
RETURN 'Cardinalidad vehículos sin ubicación o con varias' AS prueba, count(v) AS fallas;
