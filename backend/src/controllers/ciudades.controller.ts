import type { FastifyInstance } from "fastify";
import { respuestasError, esquemaIdCiudad, conToken } from "../schemas/comunes.js";
import { obtenerCiudades, registrarCiudad } from "../services/ciudades.service.js";

const esquemaCiudad = {
  type: "object",
  properties: { idCiudad: esquemaIdCiudad, nombre: { type: "string" }, estado: { type: "string" } },
} as const;

export async function rutasCiudades(app: FastifyInstance): Promise<void> {
  app.get("/ciudades", { schema: { tags: ["Ciudades"], summary: "Lista ciudades", response: { 200: { type: "array", items: esquemaCiudad } } } }, async () => obtenerCiudades());

  app.post<{ Body: { idCiudad: string; nombre: string; estado: string } }>(
    "/ciudades",
    {
      preHandler: app.requiereRol("administrador"),
      schema: {
        security: conToken,
        tags: ["Ciudades"],
        summary: "Crea una ciudad",
        body: {
          type: "object",
          required: ["idCiudad", "nombre", "estado"],
          additionalProperties: false,
          properties: { idCiudad: esquemaIdCiudad, nombre: { type: "string" }, estado: { type: "string" } },
        },
        response: { 201: esquemaCiudad, ...respuestasError(400, 401, 403, 409) },
      },
    },
    async (req, reply) => reply.code(201).send(await registrarCiudad(req.body)),
  );
}
