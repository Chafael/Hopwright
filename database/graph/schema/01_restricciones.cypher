// Restricciones e índices de la base de grafos.
// Corresponde a R1 (unicidad de identificadores) del modelo lógico.
//
// Nota: la imagen neo4j:5 es la edición Community. Ahí solo existen las restricciones de
// unicidad. Las de existencia (IS NOT NULL) y de tipo son exclusivas de la edición Enterprise,
// así que las propiedades obligatorias (R3, R4) y los valores permitidos (R5 a R8)
// los valida el backend antes de escribir, y los revisan las consultas de database/graph/tests.

CREATE CONSTRAINT ciudad_id IF NOT EXISTS
FOR (c:Ciudad) REQUIRE c.idCiudad IS UNIQUE;

CREATE CONSTRAINT interseccion_id IF NOT EXISTS
FOR (i:Interseccion) REQUIRE i.idInterseccion IS UNIQUE;

CREATE CONSTRAINT estacion_id IF NOT EXISTS
FOR (e:Estacion) REQUIRE e.idEstacion IS UNIQUE;

CREATE CONSTRAINT estacion_nombre IF NOT EXISTS
FOR (e:Estacion) REQUIRE e.nombre IS UNIQUE;

CREATE CONSTRAINT incidente_id IF NOT EXISTS
FOR (i:Incidente) REQUIRE i.idIncidente IS UNIQUE;

CREATE CONSTRAINT vehiculo_placa IF NOT EXISTS
FOR (v:Vehiculo) REQUIRE v.placa IS UNIQUE;

// Las consultas buscan ciudades por nombre y filtran incidentes activos
CREATE INDEX ciudad_nombre IF NOT EXISTS FOR (c:Ciudad) ON (c.nombre);
CREATE INDEX incidente_activo IF NOT EXISTS FOR (i:Incidente) ON (i.activo);
