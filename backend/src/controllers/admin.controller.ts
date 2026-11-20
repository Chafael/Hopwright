import type { FastifyInstance } from "fastify";
import { reconciliar } from "../services/reconciliacion.service.js";
import { respuestasError } from "../schemas/comunes.js";

const lista = { type: "array", items: { type: "string" } } as const;

// Pendiente: cuando exista el login, llevará preHandler: requiereRol("administrador").

export async function rutasAdmin(app: FastifyInstance): Promise<void> {
  app.post(
    "/admin/reconciliar",
    {
      schema: {
        tags: ["Administración"],
        summary: "Compara las réplicas del grafo contra su fuente de verdad y corrige las diferencias",
        description:
          "Incidentes contra MongoDB; ciudades y vehículos contra PostgreSQL. Copia lo que falte, borra lo que sobre " +
          "(menos ciudades, que se reportan) y regresa un resumen. Se puede correr varias veces: la segunda no cambia nada.",
        response: {
          200: {
            type: "object",
            properties: {
              incidentes: {
                type: "object",
                properties: { revisados: { type: "integer" }, copiados: lista, borradosDelGrafo: lista, conPuntoInexistente: lista },
              },
              ciudades: {
                type: ["object", "null"],
                properties: { revisadas: { type: "integer" }, copiadas: lista, soloEnGrafo: lista, sinTramos: lista },
              },
              vehiculos: {
                type: ["object", "null"],
                properties: { revisados: { type: "integer" }, copiados: lista, borradosDelGrafo: lista, sinUbicacion: lista },
              },
              avisos: lista,
              duracionMs: { type: "integer" },
            },
          },
          ...respuestasError(503),
        },
      },
    },
    async () => reconciliar(),
  );
}
