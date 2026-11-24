import type { FastifyInstance } from "fastify";
import { respuestasError, conToken } from "../schemas/comunes.js";
import { modificarCliente, obtenerCliente, obtenerClientes, registrarCliente } from "../services/clientes.service.js";

const esquemaCliente = {
  type: "object",
  properties: {
    idCliente: { type: "integer" },
    razonSocial: { type: "string" },
    rfc: { type: "string" },
    telefono: { type: ["string", "null"] },
    correo: { type: ["string", "null"] },
  },
} as const;

const cuerpoCliente = {
  type: "object",
  required: ["razonSocial", "rfc"],
  additionalProperties: false,
  properties: {
    razonSocial: { type: "string", minLength: 1 },
    rfc: { type: "string", minLength: 5 },
    telefono: { type: ["string", "null"] },
    correo: { type: ["string", "null"] },
  },
} as const;

export async function rutasClientes(app: FastifyInstance): Promise<void> {
  app.get("/clientes", { schema: { tags: ["Clientes"], summary: "Lista clientes", response: { 200: { type: "array", items: esquemaCliente } } } }, async () => obtenerClientes());

  app.post<{ Body: { razonSocial: string; rfc: string; telefono?: string | null; correo?: string | null } }>("/clientes", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Clientes"], summary: "Crea un cliente", body: cuerpoCliente, response: { 201: esquemaCliente, ...respuestasError(401, 403, 400, 409) } },
  }, async (req, reply) => reply.code(201).send(await registrarCliente(req.body)));

  app.get<{ Params: { id: string } }>("/clientes/:id", {
    schema: { tags: ["Clientes"], summary: "Obtiene un cliente", params: { type: "object", properties: { id: { type: "integer" } } }, response: { 200: esquemaCliente, ...respuestasError(404) } },
  }, async (req) => obtenerCliente(Number(req.params.id)));

  app.put<{ Params: { id: string }; Body: { razonSocial: string; rfc: string; telefono?: string | null; correo?: string | null } }>("/clientes/:id", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Clientes"], summary: "Actualiza un cliente", params: { type: "object", properties: { id: { type: "integer" } } }, body: cuerpoCliente, response: { 200: esquemaCliente, ...respuestasError(401, 403, 400, 404, 409) } },
  }, async (req) => modificarCliente(Number(req.params.id), req.body));
}
