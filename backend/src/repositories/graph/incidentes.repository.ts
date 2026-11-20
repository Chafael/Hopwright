import { escribir, leer } from "../../db/neo4j.js";

// Réplica mínima de los incidentes en el grafo: (:Incidente {idIncidente, gravedad, activo})-[:BLOQUEA]->(punto).
// El reporte completo vive en MongoDB. Aquí solo está lo que necesita el cálculo de rutas (regla R16).

export type IncidenteEnGrafo = { idIncidente: string; gravedad: string; activo: boolean; idPunto: string | null };

// Crea o actualiza la réplica. Se puede correr varias veces con los mismos datos sin duplicar nada (MERGE),
// por eso la usan tanto el alta y el cierre como la reconciliación.
// Regresa false si el punto no existe en la red; en ese caso no crea nada.
export async function guardarIncidenteEnGrafo(i: { idIncidente: string; gravedad: string; activo: boolean; idPunto: string }): Promise<boolean> {
  const filas = await escribir<{ id: string }>(
    `MATCH (p)
     WHERE (p:Ciudad AND p.idCiudad = $idPunto) OR (p:Interseccion AND p.idInterseccion = $idPunto)
     MERGE (i:Incidente {idIncidente: $idIncidente})
     SET i.gravedad = $gravedad, i.activo = $activo
     WITH i, p
     // Cada incidente bloquea exactamente un punto: si antes apuntaba a otro, se quita esa arista
     OPTIONAL MATCH (i)-[vieja:BLOQUEA]->(otro) WHERE otro <> p
     DELETE vieja
     WITH DISTINCT i, p
     MERGE (i)-[:BLOQUEA]->(p)
     RETURN i.idIncidente AS id`,
    i,
  );
  return filas.length > 0;
}

export async function leerIncidenteEnGrafo(idIncidente: string): Promise<IncidenteEnGrafo | null> {
  const filas = await leer<IncidenteEnGrafo>(
    `MATCH (i:Incidente {idIncidente: $idIncidente})
     OPTIONAL MATCH (i)-[:BLOQUEA]->(p)
     RETURN i.idIncidente AS idIncidente, i.gravedad AS gravedad, i.activo AS activo,
            coalesce(p.idCiudad, p.idInterseccion) AS idPunto
     LIMIT 1`,
    { idIncidente },
  );
  return filas[0] ?? null;
}

// Todos los incidentes del grafo, para compararlos contra MongoDB al reconciliar
export async function listarIncidentesEnGrafo(): Promise<IncidenteEnGrafo[]> {
  return leer<IncidenteEnGrafo>(
    `MATCH (i:Incidente)
     OPTIONAL MATCH (i)-[:BLOQUEA]->(p)
     RETURN i.idIncidente AS idIncidente, i.gravedad AS gravedad, i.activo AS activo,
            coalesce(p.idCiudad, p.idInterseccion) AS idPunto`,
  );
}

// Borra del grafo incidentes que ya no existen en MongoDB
export async function borrarIncidentesDelGrafo(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const filas = await escribir<{ borrados: number }>(
    `MATCH (i:Incidente) WHERE i.idIncidente IN $ids
     DETACH DELETE i
     RETURN count(*) AS borrados`,
    { ids },
  );
  return filas[0]?.borrados ?? 0;
}
