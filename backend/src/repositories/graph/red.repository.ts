import { escribir, leer } from "../../db/neo4j.js";

// Altas, cambios y bajas de la red (intersecciones, estaciones y tramos). Solo hablan con Neo4j.
// Las reglas de negocio (pesos válidos, tipos de nodo correctos, duplicados) las revisa red.service.ts
// antes de llamar aquí, porque Neo4j Community no tiene restricciones de existencia ni de tipo.

// Condición reutilizable: un nodo de carretera (ciudad o intersección) con cierto id
const esPuntoCarretera = (n: string, param: string) =>
  `((${n}:Ciudad AND ${n}.idCiudad = $${param}) OR (${n}:Interseccion AND ${n}.idInterseccion = $${param}))`;

// El servicio revisa antes que el id no exista; además la restricción de unicidad del esquema
// (database/graph/schema) rechaza un duplicado aunque dos peticiones lleguen al mismo tiempo.
export async function crearInterseccion(i: { idInterseccion: string; nombre: string | null; tipo: string; latitud: number; longitud: number }) {
  await escribir(
    `CREATE (:Interseccion {idInterseccion: $idInterseccion, nombre: $nombre, tipo: $tipo, latitud: $latitud, longitud: $longitud})`,
    i,
  );
}

// Crea la estación y su arista UBICADA_EN en la misma consulta, para que nunca quede una estación sin ciudad
export async function crearEstacion(e: { idEstacion: string; nombre: string; tipoServicio: string; idCiudad: string; tiempoCambioMin: number }) {
  await escribir(
    `MATCH (c:Ciudad {idCiudad: $idCiudad})
     CREATE (s:Estacion {idEstacion: $idEstacion, nombre: $nombre, tipoServicio: $tipoServicio})
     CREATE (s)-[:UBICADA_EN {tiempoCambioMin: $tiempoCambioMin}]->(c)`,
    e,
  );
}

// Vecinos que se quedarían sin ningún tramo si se borra este punto (romperían la cardinalidad 1..N)
export async function vecinosQueQuedarianAislados(idInterseccion: string): Promise<string[]> {
  const [fila] = await leer<{ vecinos: string[] }>(
    `MATCH (n:Interseccion {idInterseccion: $id})-[:CARRETERA]-(v)
     WHERE NOT EXISTS { MATCH (v)-[:CARRETERA]-(x) WHERE x <> n }
     RETURN collect(DISTINCT v.nombre) AS vecinos`,
    { id: idInterseccion },
  );
  return fila?.vecinos ?? [];
}

// Cuenta incidentes activos que bloquean un punto (para no borrar un punto con incidentes abiertos)
export async function incidentesActivosEn(idPunto: string): Promise<number> {
  const [fila] = await leer<{ n: number }>(
    `MATCH (p) WHERE ${esPuntoCarretera("p", "id")}
     RETURN COUNT { (p)<-[:BLOQUEA]-(i:Incidente) WHERE i.activo } AS n`,
    { id: idPunto },
  );
  return fila?.n ?? 0;
}

// Borra la intersección y sus tramos (DETACH DELETE quita también las aristas que la tocan)
export async function borrarInterseccion(idInterseccion: string): Promise<void> {
  await escribir(`MATCH (n:Interseccion {idInterseccion: $id}) DETACH DELETE n`, { id: idInterseccion });
}

export type TipoTramo = "CARRETERA" | "VIA_FERREA";

// ¿Existe ya un tramo entre a y b (en ese sentido)? Para CARRETERA se distingue por tipoVia (R2).
export async function existeTramo(tipo: TipoTramo, desde: string, hasta: string, tipoVia: string | null): Promise<boolean> {
  const cypher =
    tipo === "CARRETERA"
      ? `MATCH (a) WHERE ${esPuntoCarretera("a", "desde")}
         MATCH (b) WHERE ${esPuntoCarretera("b", "hasta")}
         RETURN EXISTS { (a)-[r:CARRETERA]->(b) WHERE r.tipoVia = $tipoVia } AS existe`
      : `MATCH (a:Estacion {idEstacion: $desde}), (b:Estacion {idEstacion: $hasta})
         RETURN EXISTS { (a)-[:VIA_FERREA]->(b) } AS existe`;
  const [fila] = await leer<{ existe: boolean }>(cypher, { desde, hasta, tipoVia });
  return fila?.existe ?? false;
}

export async function crearTramoCarretera(t: {
  desde: string;
  hasta: string;
  distanciaKm: number;
  tiempoMin: number;
  costoCaseta: number;
  tipoVia: string;
}): Promise<void> {
  await escribir(
    `MATCH (a) WHERE ${esPuntoCarretera("a", "desde")}
     MATCH (b) WHERE ${esPuntoCarretera("b", "hasta")}
     CREATE (a)-[:CARRETERA {distanciaKm: $distanciaKm, tiempoMin: $tiempoMin, costoCaseta: $costoCaseta,
                             pesoCosto: $costoCaseta + $tiempoMin * 0.000001, tipoVia: $tipoVia, abierto: true}]->(b)`,
    t,
  );
}

export async function crearTramoTren(t: { desde: string; hasta: string; distanciaKm: number; tiempoMin: number; costoPorTonelada: number }): Promise<void> {
  await escribir(
    `MATCH (a:Estacion {idEstacion: $desde}), (b:Estacion {idEstacion: $hasta})
     CREATE (a)-[:VIA_FERREA {distanciaKm: $distanciaKm, tiempoMin: $tiempoMin, costoPorTonelada: $costoPorTonelada}]->(b)`,
    t,
  );
}

// Cambia propiedades de un tramo de carretera en un sentido. Regresa el tramo como quedó, o null si no existe.
export async function actualizarTramoCarretera(
  desde: string,
  hasta: string,
  tipoVia: string,
  cambios: { abierto?: boolean; distanciaKm?: number; tiempoMin?: number; costoCaseta?: number },
) {
  const [fila] = await escribir<{ tramo: Record<string, unknown> }>(
    `MATCH (a) WHERE ${esPuntoCarretera("a", "desde")}
     MATCH (b) WHERE ${esPuntoCarretera("b", "hasta")}
     MATCH (a)-[r:CARRETERA {tipoVia: $tipoVia}]->(b)
     SET r += $cambios
     SET r.pesoCosto = coalesce(r.costoCaseta, 0.0) + r.tiempoMin * 0.000001
     RETURN r { .distanciaKm, .tiempoMin, .costoCaseta, .tipoVia, .abierto, desde: $desde, hasta: $hasta } AS tramo`,
    { desde, hasta, tipoVia, cambios },
  );
  return fila?.tramo ?? null;
}

export async function leerTramoCarretera(desde: string, hasta: string, tipoVia: string) {
  const [fila] = await leer<{ distanciaKm: number; tiempoMin: number }>(
    `MATCH (a) WHERE ${esPuntoCarretera("a", "desde")}
     MATCH (b) WHERE ${esPuntoCarretera("b", "hasta")}
     MATCH (a)-[r:CARRETERA {tipoVia: $tipoVia}]->(b)
     RETURN r.distanciaKm AS distanciaKm, r.tiempoMin AS tiempoMin`,
    { desde, hasta, tipoVia },
  );
  return fila ?? null;
}

// Borra un tramo de carretera en ambos sentidos. Regresa cuántas aristas se borraron.
export async function borrarTramoCarretera(desde: string, hasta: string, tipoVia: string): Promise<number> {
  const [fila] = await escribir<{ borradas: number }>(
    `MATCH (a) WHERE ${esPuntoCarretera("a", "desde")}
     MATCH (b) WHERE ${esPuntoCarretera("b", "hasta")}
     OPTIONAL MATCH (a)-[r:CARRETERA {tipoVia: $tipoVia}]-(b)
     WITH collect(r) AS tramos
     FOREACH (t IN tramos | DELETE t)
     RETURN size(tramos) AS borradas`,
    { desde, hasta, tipoVia },
  );
  return fila?.borradas ?? 0;
}
