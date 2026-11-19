import { neo4jDriver } from "../../db/neo4j.js";

// Consulta mínima para saber si Neo4j responde.
// Usa sesion.run y no executeRead porque executeRead reintenta hasta 30 s si Neo4j está caído,
// y para revisar la salud queremos una respuesta rápida.
export async function pingNeo4j(): Promise<void> {
  const sesion = neo4jDriver.session();
  try {
    await sesion.run("RETURN 1");
  } finally {
    await sesion.close();
  }
}
