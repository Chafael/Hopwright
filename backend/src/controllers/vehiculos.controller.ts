import type { FastifyInstance } from "fastify";
import { respuestasError, conToken } from "../schemas/comunes.js";
import { modificarVehiculo, obtenerVehiculo, obtenerVehiculos, registrarVehiculo } from "../services/vehiculos.service.js";

const esquemaVehiculo = {
  type: "object",
  properties: {
    placa: { type: "string" },
    tipo: { type: "string" },
    capacidadKg: { type: "number" },
    estado: { type: "string" },
    idConductor: { type: ["integer", "null"] },
  },
} as const;

export async function rutasVehiculos(app: FastifyInstance): Promise<void> {
  app.get("/vehiculos", { schema: { tags: ["Vehículos"], summary: "Lista vehículos", response: { 200: { type: "array", items: esquemaVehiculo } } } }, async () => obtenerVehiculos());

  app.post<{ Body: { placa: string; tipo: string; capacidadKg: number; estado: string; idConductor?: number | null } }>(
    "/vehiculos",
    {
      preHandler: app.requiereRol("administrador"),
      schema: {
        security: conToken,
        tags: ["Vehículos"],
        summary: "Crea un vehículo",
        body: {
          type: "object",
          required: ["placa", "tipo", "capacidadKg", "estado"],
          additionalProperties: false,
          properties: {
            placa: { type: "string" },
            tipo: { type: "string", enum: ["Camión", "Tráiler", "Tren"] },
            capacidadKg: { type: "number", exclusiveMinimum: 0 },
            estado: { type: "string", enum: ["Disponible", "En ruta", "En taller"] },
            idConductor: { type: ["integer", "null"] },
          },
        },
        response: { 201: esquemaVehiculo, ...respuestasError(400, 401, 403, 409) },
      },
    },
    async (req, reply) => reply.code(201).send(await registrarVehiculo(req.body)),
  );

  app.get<{ Params: { placa: string } }>("/vehiculos/:placa", {
    schema: { tags: ["Vehículos"], summary: "Obtiene un vehículo", params: { type: "object", properties: { placa: { type: "string" } } }, response: { 200: esquemaVehiculo, ...respuestasError(404) } },
  }, async (req) => obtenerVehiculo(req.params.placa));

  app.patch<{ Params: { placa: string }; Body: { tipo?: string; capacidadKg?: number; estado?: string; idConductor?: number | null } }>("/vehiculos/:placa", {
    preHandler: app.requiereRol("administrador"), schema: { security: conToken,
      tags: ["Vehículos"],
      summary: "Actualiza un vehículo",
      params: { type: "object", properties: { placa: { type: "string" } } },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          tipo: { type: "string", enum: ["Camión", "Tráiler", "Tren"] },
          capacidadKg: { type: "number", exclusiveMinimum: 0 },
          estado: { type: "string", enum: ["Disponible", "En ruta", "En taller"] },
          idConductor: { type: ["integer", "null"] },
        },
      },
      response: { 200: esquemaVehiculo, ...respuestasError(401, 403, 400, 404) },
    },
  }, async (req) => modificarVehiculo(req.params.placa, req.body));
}
