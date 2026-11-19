import neo4j, { type Driver } from "neo4j-driver";
import { env } from "../config/env.js";

// El driver administra su propio pool de conexiones. Cada consulta abre una sesión corta.
export const neo4jDriver: Driver = neo4j.driver(
  `bolt://${env.neo4j.host}:${env.neo4j.port}`,
  neo4j.auth.basic(env.neo4j.user, env.neo4j.password),
  { connectionAcquisitionTimeout: 3000, disableLosslessIntegers: true },
);

export async function cerrarNeo4j(): Promise<void> {
  await neo4jDriver.close();
}
