import { escribir, leer } from "../../db/neo4j.js";
import { proyeccionPunto, type PuntoRuta } from "./rutas.repository.js";

// Ubicación de los vehículos en la red. La fuente de verdad de la ubicación es Neo4j:
// cada vehículo tiene a lo más una arista SE_ENCUENTRA_EN hacia una ciudad, intersección o estación.

export type UbicacionVehiculo = {
  placa: string;
  punto: PuntoRuta | null;
  fechaHora: string | null;
};

// Regresa null si el vehículo no existe en el grafo. Si existe pero no tiene ubicación, punto es null.
export async function ubicacionDeVehiculo(placa: string): Promise<UbicacionVehiculo | null> {
  const filas = await leer<UbicacionVehiculo>(
    `MATCH (v:Vehiculo {placa: $placa})
     OPTIONAL MATCH (v)-[u:SE_ENCUENTRA_EN]->(p)
     RETURN v.placa AS placa,
            CASE WHEN p IS NULL THEN null ELSE ${proyeccionPunto("p")} END AS punto,
            toString(u.fechaHora) AS fechaHora
     LIMIT 1`,
    { placa },
  );
  return filas[0] ?? null;
}

// Cambia la ubicación en una sola transacción: borra la arista anterior y crea la nueva.
// Si por algún error el vehículo tuviera dos ubicaciones, las borra todas (regla de cardinalidad 1..1).
export async function moverVehiculo(placa: string, idPunto: string): Promise<{ anterior: PuntoRuta | null; actual: PuntoRuta; fechaHora: string } | null> {
  const filas = await escribir<{ anterior: PuntoRuta | null; actual: PuntoRuta; fechaHora: string }>(
    `MATCH (v:Vehiculo {placa: $placa})
     MATCH (p)
     WHERE (p:Ciudad AND p.idCiudad = $idPunto) OR (p:Interseccion AND p.idInterseccion = $idPunto) OR (p:Estacion AND p.idEstacion = $idPunto)
     OPTIONAL MATCH (v)-[vieja:SE_ENCUENTRA_EN]->(antes)
     WITH v, p, collect(vieja) AS viejas, collect(antes)[0] AS anterior
     FOREACH (r IN viejas | DELETE r)
     CREATE (v)-[u:SE_ENCUENTRA_EN {fechaHora: datetime()}]->(p)
     RETURN CASE WHEN anterior IS NULL THEN null ELSE ${proyeccionPunto("anterior")} END AS anterior,
            ${proyeccionPunto("p")} AS actual,
            toString(u.fechaHora) AS fechaHora`,
    { placa, idPunto },
  );
  return filas[0] ?? null;
}
