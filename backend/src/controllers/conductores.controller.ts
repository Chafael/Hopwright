import type { FastifyInstance } from "fastify";
import { respuestasError, seguridadBearer } from "../schemas/comunes.js";
import { eliminarConductor, modificarConductor, obtenerConductor, obtenerConductores, registrarConductor } from "../services/conductores.service.js";

const esquemaConductor = {
  type: "object",
  properties: {
    idConductor: { type: "integer" },
    nombre: { type: "string" },
    licencia: { type: "string" },
    telefono: { type: ["string", "null"] },
    activo: { type: "boolean" },
  },
} as const;

const cuerpo = {
  type: "object",
  required: ["nombre", "licencia"],
  additionalProperties: false,
  properties: { nombre: { type: "string" }, licencia: { type: "string" }, telefono: { type: ["string", "null"] }, activo: { type: "boolean" } },
} as const;

export async function rutasConductores(app: FastifyInstance): Promise<void> {
  app.get("/conductores", { schema: { tags: ["Conductores"], summary: "Lista conductores", response: { 200: { type: "array", items: esquemaConductor } } } }, async () => obtenerConductores());
  app.post<{ Body: { nombre: string; licencia: string; telefono?: string | null; activo?: boolean } }>("/conductores", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: { tags: ["Conductores"], summary: "Crea un conductor", body: cuerpo, response: { 201: esquemaConductor, ...respuestasError(400, 401, 403, 409) }, security: seguridadBearer },
  }, async (req, reply) => reply.code(201).send(await registrarConductor(req.body)));
  app.get<{ Params: { id: string } }>("/conductores/:id", { schema: { tags: ["Conductores"], summary: "Obtiene un conductor", params: { type: "object", required: ["id"], properties: { id: { type: "integer" } } }, response: { 200: esquemaConductor, ...respuestasError(404) } } }, async (req) => obtenerConductor(Number(req.params.id)));
  app.put<{ Params: { id: string }; Body: { nombre: string; licencia: string; telefono?: string | null; activo?: boolean } }>("/conductores/:id", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: { tags: ["Conductores"], summary: "Actualiza un conductor", params: { type: "object", required: ["id"], properties: { id: { type: "integer" } } }, body: cuerpo, response: { 200: esquemaConductor, ...respuestasError(400, 401, 403, 404, 409) }, security: seguridadBearer },
  }, async (req) => modificarConductor(Number(req.params.id), req.body));
  app.delete<{ Params: { id: string } }>("/conductores/:id", {
    preHandler: app.requiereRol("administrador"),
    schema: { tags: ["Conductores"], summary: "Borra un conductor", params: { type: "object", required: ["id"], properties: { id: { type: "integer" } } }, response: { 204: { type: "null" }, ...respuestasError(401, 403, 404, 409) }, security: seguridadBearer },
  }, async (req, reply) => {
    await eliminarConductor(Number(req.params.id));
    return reply.code(204).send();
  });
}
