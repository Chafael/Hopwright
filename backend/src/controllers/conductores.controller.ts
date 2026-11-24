import type { FastifyInstance } from "fastify";
import { respuestasError, conToken } from "../schemas/comunes.js";
import { modificarConductor, obtenerConductor, obtenerConductores, registrarConductor } from "../services/conductores.service.js";

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
  app.post<{ Body: { nombre: string; licencia: string; telefono?: string | null; activo?: boolean } }>("/conductores", { preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Conductores"], summary: "Crea un conductor", body: cuerpo, response: { 201: esquemaConductor, ...respuestasError(401, 403, 400, 409) } } }, async (req, reply) => reply.code(201).send(await registrarConductor(req.body)));
  app.get<{ Params: { id: string } }>("/conductores/:id", { schema: { tags: ["Conductores"], summary: "Obtiene un conductor", params: { type: "object", properties: { id: { type: "integer" } } }, response: { 200: esquemaConductor, ...respuestasError(404) } } }, async (req) => obtenerConductor(Number(req.params.id)));
  app.put<{ Params: { id: string }; Body: { nombre: string; licencia: string; telefono?: string | null; activo?: boolean } }>("/conductores/:id", { preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Conductores"], summary: "Actualiza un conductor", params: { type: "object", properties: { id: { type: "integer" } } }, body: cuerpo, response: { 200: esquemaConductor, ...respuestasError(401, 403, 400, 404, 409) } } }, async (req) => modificarConductor(Number(req.params.id), req.body));
}
