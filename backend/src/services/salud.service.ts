import { pingPostgres } from "../repositories/relational/salud.repository.js";
import { pingMongo } from "../repositories/document/salud.repository.js";
import { pingNeo4j } from "../repositories/graph/salud.repository.js";

export type EstadoBase = { estado: "ok" | "error"; ms: number; detalle?: string };

export type EstadoSalud = {
  estado: "ok" | "degradado";
  bases: { postgres: EstadoBase; mongo: EstadoBase; neo4j: EstadoBase };
};

async function medir(ping: () => Promise<void>): Promise<EstadoBase> {
  const inicio = performance.now();
  try {
    await ping();
    return { estado: "ok", ms: Math.round(performance.now() - inicio) };
  } catch (error) {
    return {
      estado: "error",
      ms: Math.round(performance.now() - inicio),
      detalle: error instanceof Error ? error.message : String(error),
    };
  }
}

// Revisa las tres bases al mismo tiempo. Si una falla, las otras se reportan igual:
// es la prueba de conectividad que pide la guía en el punto 9.
export async function revisarSalud(): Promise<EstadoSalud> {
  const [postgres, mongo, neo4j] = await Promise.all([medir(pingPostgres), medir(pingMongo), medir(pingNeo4j)]);
  const todasOk = [postgres, mongo, neo4j].every((b) => b.estado === "ok");
  return { estado: todasOk ? "ok" : "degradado", bases: { postgres, mongo, neo4j } };
}
