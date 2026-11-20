import type { FastifyInstance } from "fastify";
import { cambiarUbicacion, consultarUbicacion } from "../services/ubicacion.service.js";
import { respuestasError } from "../schemas/comunes.js";

const esquemaPunto = {
  type: ["object", "null"],
  properties: { idPunto: { type: "string" }, nombre: { type: "string" }, tipo: { type: "string" } },
} as const;

const paramsPlaca = {
  type: "object",
  properties: { placa: { type: "string", pattern: "^[A-Z0-9-]{3,15}$", examples: ["CHP-1005"] } },
} as const;

export async function rutasUbicacion(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { placa: string } }>(
    "/vehiculos/:placa/ubicacion",
    {
      schema: {
        tags: ["Vehículos"],
        summary: "Dónde está un vehículo en la red",
        params: paramsPlaca,
        response: {
          200: { type: "object", properties: { placa: { type: "string" }, punto: esquemaPunto, fechaHora: { type: ["string", "null"] } } },
          ...respuestasError(400, 404, 503),
        },
      },
    },
    async (req) => consultarUbicacion(req.params.placa),
  );

  app.patch<{ Params: { placa: string }; Body: { idPunto: string } }>(
    "/vehiculos/:placa/ubicacion",
    {
      schema: {
        tags: ["Vehículos"],
        summary: "Mueve un vehículo a otro punto de la red",
        description:
          "Cambia la arista SE_ENCUENTRA_EN en Neo4j. Un tren solo puede quedar en una estación y un camión o tráiler solo en una ciudad o intersección (R11); el tipo se consulta en PostgreSQL.",
        params: paramsPlaca,
        body: {
          type: "object",
          required: ["idPunto"],
          additionalProperties: false,
          properties: { idPunto: { type: "string", minLength: 1, description: "idCiudad, idInterseccion o idEstacion", examples: ["07094"] } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              placa: { type: "string" },
              anterior: esquemaPunto,
              actual: esquemaPunto,
              fechaHora: { type: "string" },
              avisos: { type: "array", items: { type: "string" } },
            },
          },
          ...respuestasError(400, 404, 503),
        },
      },
    },
    async (req) => cambiarUbicacion(req.params.placa, req.body.idPunto),
  );
}
