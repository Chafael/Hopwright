import type { FastifyInstance } from "fastify";
import { revisarSalud } from "../services/salud.service.js";

const estadoBase = {
  type: "object",
  required: ["estado", "ms"],
  properties: {
    estado: { type: "string", enum: ["ok", "error"] },
    ms: { type: "integer", description: "Tiempo de respuesta en milisegundos" },
    detalle: { type: "string", description: "Mensaje de error si la base no respondió" },
  },
} as const;

const respuestaSalud = {
  type: "object",
  required: ["estado", "bases"],
  properties: {
    estado: { type: "string", enum: ["ok", "degradado"] },
    bases: {
      type: "object",
      required: ["postgres", "mongo", "neo4j"],
      properties: { postgres: estadoBase, mongo: estadoBase, neo4j: estadoBase },
    },
  },
} as const;

export async function rutasSalud(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Salud"],
        summary: "Revisa la conexión con PostgreSQL, MongoDB y Neo4j",
        description: "Responde 200 si las tres bases contestan y 503 si alguna falla.",
        response: { 200: respuestaSalud, 503: respuestaSalud },
      },
    },
    async (_req, reply) => {
      const salud = await revisarSalud();
      return reply.code(salud.estado === "ok" ? 200 : 503).send(salud);
    },
  );
}
