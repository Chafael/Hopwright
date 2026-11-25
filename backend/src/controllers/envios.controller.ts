import type { FastifyInstance } from "fastify";
import { respuestasError, esquemaIdCiudad, seguridadBearer } from "../schemas/comunes.js";
import { asignarVehiculo, cancelarEnvio, guardarManifiesto, obtenerDatosParaRuta, obtenerEnvio, obtenerEnvios, obtenerManifiesto, registrarEntrega, registrarEnvio, registrarSalida } from "../services/envios.service.js";
import { buscarBitacora } from "../repositories/document/bitacora.repository.js";

const esquemaIdEnvio = { type: "string", pattern: "^E-[0-9]+$", description: "Identificador de envío con prefijo E- y solo dígitos", examples: ["E-101"] } as const;

const paramsEnvio = { type: "object", required: ["id"], properties: { id: esquemaIdEnvio } } as const;

const esquemaAsignacion = {
  type: "object",
  properties: {
    idAsignacion: { type: "integer" },
    idEnvio: esquemaIdEnvio,
    placa: { type: "string" },
    fechaAsignacion: { type: "string" },
    fechaFin: { type: ["string", "null"] },
    activa: { type: "boolean" },
  },
} as const;

const cuerpoManifiesto = {
  type: "object",
  required: ["tipoCarga", "articulos"],
  additionalProperties: false,
  properties: {
    tipoCarga: { type: "string", enum: ["general", "refrigerada", "peligrosa"] },
    articulos: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["descripcion", "cantidad", "pesoKg"],
        additionalProperties: false,
        properties: {
          descripcion: { type: "string", minLength: 1, maxLength: 200 },
          cantidad: { type: "number", minimum: 1 },
          pesoKg: { type: "number", exclusiveMinimum: 0 },
        },
      },
    },
    tempMinC: { type: "number" },
    tempMaxC: { type: "number" },
    tiempoMaxMin: { type: "number", minimum: 1 },
    claseUN: { type: "integer", minimum: 1, maximum: 9 },
    numeroONU: { type: "string", minLength: 1, maxLength: 20 },
    hojaSeguridad: { type: "string", minLength: 1, maxLength: 500 },
    telefonoEmergencia: { type: "string", minLength: 5, maxLength: 30 },
    restriccionesRuta: {
      type: "object",
      required: ["evitarTerraceria", "tiempoMaxMin"],
      additionalProperties: false,
      properties: {
        evitarTerraceria: { type: "boolean" },
        tiempoMaxMin: { type: ["number", "null"], minimum: 1 },
      },
    },
  },
  examples: [
    {
      tipoCarga: "general",
      articulos: [{ descripcion: "Caja de papel", cantidad: 10, pesoKg: 25.5 }],
      restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: 480 },
    },
    {
      tipoCarga: "refrigerada",
      articulos: [{ descripcion: "Vacunas", cantidad: 20, pesoKg: 3 }],
      tempMinC: 2,
      tempMaxC: 8,
      tiempoMaxMin: 120,
      restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: 120 },
    },
    {
      tipoCarga: "peligrosa",
      articulos: [{ descripcion: "Disolvente", cantidad: 4, pesoKg: 40 }],
      claseUN: 3,
      numeroONU: "UN1993",
      hojaSeguridad: "https://ejemplo.local/hs.pdf",
      telefonoEmergencia: "5551234567",
      restriccionesRuta: { evitarTerraceria: true, tiempoMaxMin: null },
    },
  ],
} as const;

const esquemaEnvio = {
  type: "object",
  properties: {
    idEnvio: esquemaIdEnvio,
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
    schema: { tags: ["Envíos"], summary: "Obtiene un envío", params: paramsEnvio, response: { 200: esquemaEnvio, ...respuestasError(404) } },
  }, async (req) => obtenerEnvio(req.params.id));

  app.post<{ Body: { idEnvio: string; idCliente: number; idCiudadOrigen: string; idCiudadDestino: string; pesoKg: number; prioridad: string } }>("/envios", {
    preHandler: app.requiereRol("despachador", "administrador"),
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
      response: { 201: esquemaEnvio, ...respuestasError(400, 401, 403, 404, 409) },
      security: seguridadBearer,
    },
  }, async (req, reply) => reply.code(201).send(await registrarEnvio(req.body)));

  app.post<{ Params: { id: string }; Body: { placa: string } }>("/envios/:id/asignacion", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: {
      tags: ["Envíos"],
      summary: "Asigna un vehículo a un envío",
      params: paramsEnvio,
      body: { type: "object", required: ["placa"], additionalProperties: false, properties: { placa: { type: "string" } } },
      response: { 201: esquemaAsignacion, ...respuestasError(400, 401, 403, 404, 409) },
      security: seguridadBearer,
    },
  }, async (req, reply) => reply.code(201).send(await asignarVehiculo(req.params.id, req.body.placa)));

  app.post<{ Params: { id: string } }>("/envios/:id/salida", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: { tags: ["Envíos"], summary: "Registra salida del envío", params: paramsEnvio, response: { 200: esquemaEnvio, ...respuestasError(400, 401, 403, 404, 409) }, security: seguridadBearer },
  }, async (req) => registrarSalida(req.params.id));

  app.post<{ Params: { id: string } }>("/envios/:id/entrega", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: { tags: ["Envíos"], summary: "Registra entrega del envío", params: paramsEnvio, response: { 200: esquemaEnvio, ...respuestasError(400, 401, 403, 404, 409) }, security: seguridadBearer },
  }, async (req) => registrarEntrega(req.params.id));

  app.post<{ Params: { id: string } }>("/envios/:id/cancelacion", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: { tags: ["Envíos"], summary: "Cancela un envío pendiente o asignado", params: paramsEnvio, response: { 200: esquemaEnvio, ...respuestasError(400, 401, 403, 404, 409) }, security: seguridadBearer },
  }, async (req) => cancelarEnvio(req.params.id));

  app.get<{ Params: { id: string } }>("/envios/:id/manifiesto", {
    schema: { tags: ["Envíos"], summary: "Obtiene manifiesto del envío", params: paramsEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerManifiesto(req.params.id));

  app.post<{ Params: { id: string }; Body: any }>("/envios/:id/manifiesto", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: {
      tags: ["Envíos"],
      summary: "Crea manifiesto del envío",
      params: paramsEnvio,
      body: cuerpoManifiesto,
      response: { 201: { type: "object", additionalProperties: true }, ...respuestasError(400, 401, 403, 404, 409) },
      security: seguridadBearer,
    },
  }, async (req, reply) => reply.code(201).send(await guardarManifiesto(req.params.id, req.body)));

  app.get<{ Params: { id: string } }>("/envios/:id/bitacora", {
    schema: { tags: ["Envíos"], summary: "Obtiene bitácora del envío", params: paramsEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => {
    const envio = await obtenerEnvio(req.params.id);
    return (await buscarBitacora(envio.idEnvio)) ?? { idEnvio: envio.idEnvio, eventos: [] };
  });

  app.get<{ Params: { id: string } }>("/envios/:id/datos-ruta", {
    schema: { tags: ["Envíos"], summary: "Datos para cálculo de ruta", params: paramsEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerDatosParaRuta(req.params.id));
}
