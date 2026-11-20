import { leer, entero } from "../../db/neo4j.js";

// Consultas de rutas sobre la red. Solo hablan con Neo4j.
//
// Cómo se calcula una ruta con restricciones:
// apoc.algo.dijkstra encuentra los caminos más cortos sumando una propiedad de las aristas,
// pero no sabe filtrar tramos ni puntos. Por eso le pedimos varias rutas candidatas
// (las k más cortas, sin ciclos) y en la misma consulta descartamos las que pasan por un tramo
// cerrado, por terracería cuando no se permite, o por un punto con un incidente activo de
// gravedad Alta. Nos quedamos con la primera que cumple. En una red de este tamaño, 10 candidatas
// cubren todas las alternativas razonables; si ninguna cumple, se avisa.

export type Criterio = "tiempo" | "distancia" | "costo";

const propiedadPorCriterio: Record<Criterio, string> = {
  tiempo: "tiempoMin",
  distancia: "distanciaKm",
  costo: "costoCaseta",
};

export type PuntoRuta = { idPunto: string; nombre: string; tipo: string };
export type TramoRuta = { desde: string; hacia: string; distanciaKm: number; tiempoMin: number; costoCaseta: number; tipoVia: string };
export type IncidenteEnRuta = { idIncidente: string; gravedad: string; idPunto: string; punto: string };

export type RutaCarretera = {
  puntos: PuntoRuta[];
  tramos: TramoRuta[];
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  incidentes: IncidenteEnRuta[];
};

// Proyección que se repite en varias consultas: convierte un nodo en { idPunto, nombre, tipo }
export const proyeccionPunto = (n: string) =>
  `{ idPunto: coalesce(${n}.idCiudad, ${n}.idInterseccion, ${n}.idEstacion), nombre: ${n}.nombre, tipo: labels(${n})[0] }`;

// Busca un punto de la red por su id, sea ciudad, intersección o estación
export async function buscarPunto(idPunto: string): Promise<PuntoRuta | null> {
  const filas = await leer<{ punto: PuntoRuta }>(
    `MATCH (n)
     WHERE (n:Ciudad AND n.idCiudad = $id) OR (n:Interseccion AND n.idInterseccion = $id) OR (n:Estacion AND n.idEstacion = $id)
     RETURN ${proyeccionPunto("n")} AS punto`,
    { id: idPunto },
  );
  return filas[0]?.punto ?? null;
}

export async function listarPuntos(): Promise<PuntoRuta[]> {
  const filas = await leer<{ punto: PuntoRuta }>(
    `MATCH (n) WHERE n:Ciudad OR n:Interseccion OR n:Estacion
     RETURN ${proyeccionPunto("n")} AS punto
     ORDER BY labels(n)[0], n.nombre`,
  );
  return filas.map((f) => f.punto);
}

// C1: ruta por carretera entre dos puntos (ciudades o intersecciones) con restricciones
export async function rutaCarretera(params: {
  origen: string;
  destino: string;
  criterio: Criterio;
  evitarTerraceria: boolean;
  tiempoMaxMin: number | null;
  candidatas: number;
  // Para la consulta C5: calcular la ruta como si un incidente no existiera, o rodeando un punto aunque no esté bloqueado
  ignorarIncidentes?: string[];
  evitarPuntos?: string[];
}): Promise<RutaCarretera | null> {
  const filas = await leer<RutaCarretera>(
    `MATCH (o) WHERE (o:Ciudad AND o.idCiudad = $origen) OR (o:Interseccion AND o.idInterseccion = $origen)
     MATCH (d) WHERE (d:Ciudad AND d.idCiudad = $destino) OR (d:Interseccion AND d.idInterseccion = $destino)
     CALL apoc.algo.dijkstra(o, d, 'CARRETERA>', $propiedad, 0.0, $candidatas) YIELD path, weight
     WITH path, weight
     WHERE all(r IN relationships(path) WHERE coalesce(r.abierto, true)
                AND NOT ($evitarTerraceria AND r.tipoVia = 'Terracería'))
       AND none(n IN nodes(path) WHERE coalesce(n.idCiudad, n.idInterseccion) IN $evitarPuntos OR EXISTS {
             MATCH (n)<-[:BLOQUEA]-(i:Incidente)
             WHERE i.activo AND i.gravedad = 'Alta' AND NOT i.idIncidente IN $ignorarIncidentes })
     WITH path, weight,
          reduce(s = 0, r IN relationships(path) | s + r.tiempoMin) AS minutos
     WHERE $tiempoMaxMin IS NULL OR minutos <= $tiempoMaxMin
     WITH path, weight, minutos
     ORDER BY weight, minutos
     LIMIT 1
     RETURN
       [n IN nodes(path) | ${proyeccionPunto("n")}] AS puntos,
       [r IN relationships(path) | {
          desde: coalesce(startNode(r).idCiudad, startNode(r).idInterseccion),
          hacia: coalesce(endNode(r).idCiudad, endNode(r).idInterseccion),
          distanciaKm: r.distanciaKm, tiempoMin: r.tiempoMin,
          costoCaseta: coalesce(r.costoCaseta, 0.0), tipoVia: r.tipoVia }] AS tramos,
       minutos,
       reduce(s = 0.0, r IN relationships(path) | s + r.distanciaKm) AS kilometros,
       reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.costoCaseta, 0.0)) AS costoCasetas,
       reduce(acc = [], n IN nodes(path) | acc +
         [(n)<-[:BLOQUEA]-(i:Incidente) WHERE i.activo |
           { idIncidente: i.idIncidente, gravedad: i.gravedad,
             idPunto: coalesce(n.idCiudad, n.idInterseccion), punto: n.nombre }]) AS incidentes`,
    {
      origen: params.origen,
      destino: params.destino,
      propiedad: propiedadPorCriterio[params.criterio],
      evitarTerraceria: params.evitarTerraceria,
      tiempoMaxMin: params.tiempoMaxMin,
      candidatas: entero(params.candidatas),
      ignorarIncidentes: params.ignorarIncidentes ?? [],
      evitarPuntos: params.evitarPuntos ?? [],
    },
  );
  return filas[0] ?? null;
}

export type EstacionConCiudad = { idEstacion: string; nombre: string; idCiudad: string; ciudad: string; tiempoCambioMin: number };

export async function estacionesConCiudad(): Promise<EstacionConCiudad[]> {
  return leer<EstacionConCiudad>(
    `MATCH (e:Estacion)-[u:UBICADA_EN]->(c:Ciudad)
     RETURN e.idEstacion AS idEstacion, e.nombre AS nombre, c.idCiudad AS idCiudad, c.nombre AS ciudad,
            u.tiempoCambioMin AS tiempoCambioMin
     ORDER BY e.idEstacion`,
  );
}

export type RutaTren = { puntos: PuntoRuta[]; minutos: number; kilometros: number; costoPorTonelada: number };

// Tramo en tren entre dos estaciones, la más rápida
export async function rutaTren(desde: string, hasta: string): Promise<RutaTren | null> {
  const filas = await leer<RutaTren>(
    `MATCH (a:Estacion {idEstacion: $desde}), (b:Estacion {idEstacion: $hasta})
     CALL apoc.algo.dijkstra(a, b, 'VIA_FERREA>', 'tiempoMin', 0.0, $una) YIELD path
     RETURN [n IN nodes(path) | ${proyeccionPunto("n")}] AS puntos,
            reduce(s = 0, r IN relationships(path) | s + r.tiempoMin) AS minutos,
            reduce(s = 0.0, r IN relationships(path) | s + r.distanciaKm) AS kilometros,
            reduce(s = 0.0, r IN relationships(path) | s + r.costoPorTonelada) AS costoPorTonelada`,
    { desde, hasta, una: entero(1) },
  );
  return filas[0] ?? null;
}

// C4: ciudades que no pueden llegar a `destino` si se cierra `puntoCerrado`.
// apoc.path.subgraphNodes recorre la red hacia atrás desde el destino (todo lo que puede llegar a él)
// sin pasar por el punto cerrado. Las ciudades que no aparecen en ese recorrido quedaron aisladas.
export async function ciudadesAisladas(puntoCerrado: string, destino: string): Promise<{ idCiudad: string; nombre: string }[]> {
  return leer<{ idCiudad: string; nombre: string }>(
    `MATCH (cerrado) WHERE (cerrado:Ciudad AND cerrado.idCiudad = $cerrado) OR (cerrado:Interseccion AND cerrado.idInterseccion = $cerrado)
     MATCH (t:Ciudad {idCiudad: $destino})
     CALL apoc.path.subgraphNodes(t, {
       relationshipFilter: '<CARRETERA',
       denylistNodes: [cerrado],
       blacklistNodes: [cerrado]
     }) YIELD node
     WITH cerrado, collect(node) AS alcanzables
     MATCH (c:Ciudad)
     WHERE c <> cerrado AND NOT c IN alcanzables
     RETURN c.idCiudad AS idCiudad, c.nombre AS nombre
     ORDER BY c.nombre`,
    { cerrado: puntoCerrado, destino },
  );
}

// Dónde está cada vehículo de la lista (para elegir el que llega antes al origen)
export async function ubicacionesDeVehiculos(placas: string[]): Promise<{ placa: string; idPunto: string; tipo: string }[]> {
  return leer<{ placa: string; idPunto: string; tipo: string }>(
    `UNWIND $placas AS placa
     MATCH (v:Vehiculo {placa: placa})-[:SE_ENCUENTRA_EN]->(p)
     RETURN v.placa AS placa, coalesce(p.idCiudad, p.idInterseccion, p.idEstacion) AS idPunto, labels(p)[0] AS tipo`,
    { placas },
  );
}
