// Prueba de humo de la base de grafos: qué hay cargado, por etiqueta y por tipo de relación,
// y qué restricciones e índices existen.
//   docker exec -i hopwright-neo4j cypher-shell -u neo4j -p <contraseña> < database/graph/tests/00_humo.cypher
// Con los datos de prueba: 124 ciudades, 9 intersecciones y 5 estaciones (138 puntos).

MATCH (n)
UNWIND labels(n) AS etiqueta
RETURN etiqueta, count(*) AS nodos
ORDER BY etiqueta;

MATCH ()-[r]->()
RETURN type(r) AS relacion, count(*) AS aristas
ORDER BY relacion;

SHOW CONSTRAINTS YIELD name, labelsOrTypes, properties, type
RETURN name, labelsOrTypes, properties, type
ORDER BY name;

SHOW INDEXES YIELD name, labelsOrTypes, properties, type
WHERE type <> 'LOOKUP'
RETURN name, labelsOrTypes, properties, type
ORDER BY name;

// Gracias a la restricción ciudad_id, cada clave aparece una sola vez (los scripts de carga usan MERGE).
MATCH (c:Ciudad {idCiudad: '07101'})
RETURN count(c) AS ciudadesConClave07101;
