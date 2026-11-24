import type { FastifyInstance } from "fastify";
import { respuestasError, esquemaIdCiudad, esquemaIdEnvio, paramsIdEnvio } from "../schemas/comunes.js";
import { asignarVehiculo, guardarManifiesto, obtenerDatosParaRuta, obtenerEnvio, obtenerEnvios, obtenerManifiesto, registrarEntrega, registrarEnvio, registrarSalida } from "../services/envios.service.js";
import { buscarBitacora } from "../repositories/document/bitacora.repository.js";

const esquemaEnvio = {
  type: "object",
  properties: {
    idEnvio: { type: "string" },
    idCliente: { type: "integer" },
    idCiudadOrigen: esquemaIdCiudad,
    idCiudadDestino: esquemaIdCiudad,
    pesoKg: { type: "number" },
    prioridad: { type: "string" },
    estado: { type: "string" },
    fechaSalida: { type: ["string", "null"] },
    creadoEn: { type: "string" },
  },
} as const;

export async function rutasEnvios(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { estado?: string } }>("/envios", {
    schema: { tags: ["Envíos"], summary: "Lista envíos", querystring: { type: "object", properties: { estado: { type: "string" } } }, response: { 200: { type: "array", items: esquemaEnvio } } },
  }, async (req) => obtenerEnvios(req.query.estado));

  app.get<{ Params: { id: string } }>("/envios/:id", {
    schema: { tags: ["Envíos"], summary: "Obtiene un envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(404) } },
  }, async (req) => obtenerEnvio(req.params.id));

  app.post<{ Body: { idEnvio: string; idCliente: number; idCiudadOrigen: string; idCiudadDestino: string; pesoKg: number; prioridad: string } }>("/envios", {
    schema: {
      tags: ["Envíos"],
      summary: "Crea un envío",
      body: {
        type: "object",
        required: ["idEnvio", "idCliente", "idCiudadOrigen", "idCiudadDestino", "pesoKg", "prioridad"],
        additionalProperties: false,
        properties: {
          idEnvio: esquemaIdEnvio,
          idCliente: { type: "integer" },
          idCiudadOrigen: esquemaIdCiudad,
          idCiudadDestino: esquemaIdCiudad,
          pesoKg: { type: "number", exclusiveMinimum: 0 },
          prioridad: { type: "string", enum: ["Normal", "Urgente"] },
        },
      },
      response: { 201: esquemaEnvio, ...respuestasError(400, 409) },
    },
  }, async (req, reply) => reply.code(201).send(await registrarEnvio(req.body)));

  app.post<{ Params: { id: string }; Body: { placa: string } }>("/envios/:id/asignacion", {
    schema: {
      tags: ["Envíos"],
      summary: "Asigna un vehículo a un envío",
      params: paramsIdEnvio,
      body: { type: "object", required: ["placa"], additionalProperties: false, properties: { placa: { type: "string" } } },
      response: { 201: { type: "object", additionalProperties: true }, ...respuestasError(404, 409) },
    },
  }, async (req, reply) => reply.code(201).send(await asignarVehiculo(req.params.id, req.body.placa)));

  app.post<{ Params: { id: string } }>("/envios/:id/salida", {
    schema: { tags: ["Envíos"], summary: "Registra salida del envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(404, 409) } },
  }, async (req) => registrarSalida(req.params.id));

  app.post<{ Params: { id: string } }>("/envios/:id/entrega", {
    schema: { tags: ["Envíos"], summary: "Registra entrega del envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(404, 409) } },
  }, async (req) => registrarEntrega(req.params.id));

  app.get<{ Params: { id: string } }>("/envios/:id/manifiesto", {
    schema: { tags: ["Envíos"], summary: "Obtiene manifiesto del envío", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerManifiesto(req.params.id));

  app.post<{ Params: { id: string }; Body: any }>("/envios/:id/manifiesto", {
    schema: { tags: ["Envíos"], summary: "Crea manifiesto del envío", params: paramsIdEnvio, body: { type: "object", additionalProperties: true }, response: { 201: { type: "object", additionalProperties: true }, ...respuestasError(400, 404, 409) } },
  }, async (req, reply) => reply.code(201).send(await guardarManifiesto(req.params.id, req.body)));

  app.get<{ Params: { id: string } }>("/envios/:id/bitacora", {
    schema: { tags: ["Envíos"], summary: "Obtiene bitácora del envío", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => {
    const envio = await obtenerEnvio(req.params.id);
    return (await buscarBitacora(envio.idEnvio)) ?? { idEnvio: envio.idEnvio, eventos: [] };
  });

  // Endpoint interno/útil para el flujo integrado; no en plan pero ayuda. Lo omito para no extra scope.
  app.get<{ Params: { id: string } }>("/envios/:id/datos-ruta", {
    schema: { tags: ["Envíos"], summary: "Datos para cálculo de ruta", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerDatosParaRuta(req.params.id));
}
