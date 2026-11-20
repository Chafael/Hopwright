// Vehículos de ejemplo y su ubicación.
// En el grafo solo vive la placa (réplica de PostgreSQL) y la arista SE_ENCUENTRA_EN (fuente de verdad: Neo4j).
// Las placas deben coincidir con los datos de prueba de PostgreSQL (ver docs/plan-de-trabajo.md).

UNWIND [
  {placa: 'CHP-1001', ciudad: '07101'},
  {placa: 'CHP-1002', ciudad: '07101'},
  {placa: 'CHP-1003', ciudad: '07089'},
  {placa: 'CHP-1004', ciudad: '07009'},
  {placa: 'CHP-1005', ciudad: '07078'},
  {placa: 'CHP-1006', ciudad: '07019'}
] AS v
MERGE (n:Vehiculo {placa: v.placa})
WITH n, v
MATCH (c:Ciudad {idCiudad: v.ciudad})
OPTIONAL MATCH (n)-[vieja:SE_ENCUENTRA_EN]->()
DELETE vieja
MERGE (n)-[u:SE_ENCUENTRA_EN]->(c)
SET u.fechaHora = datetime('2026-11-20T08:00:00-06:00');

// El tren solo puede estar en una estación (regla R11)
MERGE (t:Vehiculo {placa: 'TREN-01'})
WITH t
MATCH (e:Estacion {idEstacion: 'EST-ARR'})
OPTIONAL MATCH (t)-[vieja:SE_ENCUENTRA_EN]->()
DELETE vieja
MERGE (t)-[u:SE_ENCUENTRA_EN]->(e)
SET u.fechaHora = datetime('2026-11-20T08:00:00-06:00');
