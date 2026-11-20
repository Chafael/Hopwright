// Réplica mínima de los incidentes de ejemplo (el reporte completo vive en MongoDB, colección reportes_incidente).
// Solo un incidente activo de gravedad Alta saca a un punto del cálculo de rutas (regla R16).
// Los de gravedad Baja o Media no bloquean, pero la ruta avisa que pasa por ahí.

UNWIND [
  {id: 'INC-0001', gravedad: 'Media', activo: true,  punto: '07094'},    // obra en Teopisca
  {id: 'INC-0002', gravedad: 'Alta',  activo: false, punto: 'INT-FCO'}   // derrumbe ya despejado
] AS i
MERGE (n:Incidente {idIncidente: i.id})
SET n.gravedad = i.gravedad, n.activo = i.activo
WITH n, i
MATCH (p) WHERE (p:Ciudad AND p.idCiudad = i.punto) OR (p:Interseccion AND p.idInterseccion = i.punto)
MERGE (n)-[:BLOQUEA]->(p);
