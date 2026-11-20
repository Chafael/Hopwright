// Consultas representativas de la base de grafos (para el catálogo de operaciones).
// Se pueden pegar en Neo4j Browser (http://localhost:7474). Primero define los parámetros, por ejemplo:
//   :param origen => '07101'
//   :param destino => '07009'
// El backend usa estas mismas consultas en backend/src/repositories/graph/.

// C1. Ruta más rápida por carretera entre dos ciudades, sin terracería y sin puntos bloqueados.
// apoc.algo.dijkstra da las 10 rutas más cortas sin ciclos; nos quedamos con la primera que cumple.
MATCH (o:Ciudad {idCiudad: $origen}), (d:Ciudad {idCiudad: $destino})
CALL apoc.algo.dijkstra(o, d, 'CARRETERA>', 'tiempoMin', 0.0, 10) YIELD path, weight
WITH path, weight
WHERE all(r IN relationships(path) WHERE coalesce(r.abierto, true) AND r.tipoVia <> 'Terracería')
  AND none(n IN nodes(path) WHERE EXISTS {
        MATCH (n)<-[:BLOQUEA]-(i:Incidente) WHERE i.activo AND i.gravedad = 'Alta' })
RETURN [n IN nodes(path) | n.nombre] AS ruta, weight AS minutos
ORDER BY weight
LIMIT 1;

// C2. Tramo en tren entre dos estaciones, con su costo por tonelada.
MATCH (a:Estacion {idEstacion: 'EST-ARR'}), (b:Estacion {idEstacion: 'EST-TAP'})
CALL apoc.algo.dijkstra(a, b, 'VIA_FERREA>', 'tiempoMin', 0.0, 1) YIELD path, weight
RETURN [n IN nodes(path) | n.nombre] AS estaciones,
       weight AS minutos,
       reduce(s = 0.0, r IN relationships(path) | s + r.costoPorTonelada) AS costoPorTonelada;

// C4. Ciudades que se quedan sin camino a Tuxtla si se cierra el entronque de Oxchuc.
MATCH (cerrado:Interseccion {idInterseccion: 'INT-OXC'}), (t:Ciudad {idCiudad: '07101'})
CALL apoc.path.subgraphNodes(t, {relationshipFilter: '<CARRETERA', denylistNodes: [cerrado], blacklistNodes: [cerrado]}) YIELD node
WITH cerrado, collect(node) AS alcanzables
MATCH (c:Ciudad) WHERE NOT c IN alcanzables AND c <> cerrado
RETURN c.nombre AS aislada;

// Vecinos directos de un punto, con sus pesos
MATCH (p:Ciudad {idCiudad: '07101'})-[r:CARRETERA]->(v)
RETURN v.nombre AS hacia, r.distanciaKm AS km, r.tiempoMin AS minutos, r.tipoVia AS via, r.costoCaseta AS caseta
ORDER BY minutos;

// Incidentes activos y el punto que bloquean
MATCH (i:Incidente {activo: true})-[:BLOQUEA]->(p)
RETURN i.idIncidente AS incidente, i.gravedad AS gravedad, p.nombre AS punto;

// Dónde está cada vehículo
MATCH (v:Vehiculo)-[u:SE_ENCUENTRA_EN]->(p)
RETURN v.placa AS placa, p.nombre AS lugar, labels(p)[0] AS tipo, u.fechaHora AS desde
ORDER BY placa;
