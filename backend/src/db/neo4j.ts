import neo4j, { type Driver } from "neo4j-driver";
import { env } from "../config/env.js";

// El driver administra su propio pool de conexiones. Cada consulta abre una sesión corta.
// disableLosslessIntegers: los enteros de Neo4j llegan como number de JavaScript.
export const neo4jDriver: Driver = neo4j.driver(
  `bolt://${env.neo4j.host}:${env.neo4j.port}`,
  neo4j.auth.basic(env.neo4j.user, env.neo4j.password),
  {
    connectionAcquisitionTimeout: 3000,
    disableLosslessIntegers: true,
    // executeRead/executeWrite reintentan si hay un fallo temporal. Por defecto lo hacen 30 s;
    // lo bajamos a 5 s para que, si Neo4j está caído, la API responda 503 rápido.
    maxTransactionRetryTime: 5000,
  },
);

// JavaScript solo tiene un tipo numérico y el driver lo manda a Neo4j como Float.
// Cuando un procedimiento espera un INTEGER (por ejemplo, cuántas rutas pedir a APOC), hay que usar esto.
export const entero = (n: number) => neo4j.int(n);

// Ejecuta una consulta de lectura y regresa cada registro como objeto plano.
// executeRead reintenta solo si hay un fallo temporal de conexión.
export async function leer<T = Record<string, unknown>>(cypher: string, parametros: Record<string, unknown> = {}): Promise<T[]> {
  const sesion = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const resultado = await sesion.executeRead((tx) => tx.run(cypher, parametros));
    return resultado.records.map((r) => r.toObject() as T);
  } finally {
    await sesion.close();
  }
}

// Igual que leer(), pero para consultas que crean o modifican datos.
export async function escribir<T = Record<string, unknown>>(cypher: string, parametros: Record<string, unknown> = {}): Promise<T[]> {
  const sesion = neo4jDriver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const resultado = await sesion.executeWrite((tx) => tx.run(cypher, parametros));
    return resultado.records.map((r) => r.toObject() as T);
  } finally {
    await sesion.close();
  }
}

export async function cerrarNeo4j(): Promise<void> {
  await neo4jDriver.close();
}
