import { escribir, leer } from "../../db/neo4j.js";

// Consultas del grafo que usa la reconciliación para ciudades y vehículos.
// Su fuente de verdad es PostgreSQL; en Neo4j vive una réplica (Ciudad {idCiudad, nombre}, Vehiculo {placa}).

export async function ciudadesEnGrafo(): Promise<{ idCiudad: string; nombre: string; tramos: number }[]> {
  return leer(
    `MATCH (c:Ciudad)
     RETURN c.idCiudad AS idCiudad, c.nombre AS nombre, COUNT { (c)-[:CARRETERA]-() } AS tramos`,
  );
}

// MERGE: crea la ciudad si falta y corrige el nombre si cambió. Correrlo dos veces no duplica nada.
export async function guardarCiudades(ciudades: { idCiudad: string; nombre: string }[]): Promise<void> {
  if (ciudades.length === 0) return;
  await escribir(
    `UNWIND $ciudades AS c
     MERGE (n:Ciudad {idCiudad: c.idCiudad})
     SET n.nombre = c.nombre`,
    { ciudades },
  );
}

export async function vehiculosEnGrafo(): Promise<{ placa: string; ubicado: boolean }[]> {
  return leer(
    `MATCH (v:Vehiculo)
     RETURN v.placa AS placa, EXISTS { (v)-[:SE_ENCUENTRA_EN]->() } AS ubicado`,
  );
}

export async function guardarVehiculos(placas: string[]): Promise<void> {
  if (placas.length === 0) return;
  await escribir(`UNWIND $placas AS placa MERGE (:Vehiculo {placa: placa})`, { placas });
}

export async function borrarVehiculos(placas: string[]): Promise<void> {
  if (placas.length === 0) return;
  await escribir(`MATCH (v:Vehiculo) WHERE v.placa IN $placas DETACH DELETE v`, { placas });
}
