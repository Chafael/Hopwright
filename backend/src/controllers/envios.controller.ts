import type { FastifyInstance } from "fastify";
import { respuestasError, esquemaIdCiudad, esquemaIdEnvio, paramsIdEnvio, conToken } from "../schemas/comunes.js";
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

// Cuerpo de POST /envios/{id}/manifiesto. Los campos extra dependen de tipoCarga y los revisa el servicio
// (validarManifiesto); aquí se describen para que Swagger muestre qué lleva cada tipo.
const articulo = {
  type: "object",
  required: ["descripcion", "cantidad", "pesoKg"],
  properties: { descripcion: { type: "string" }, cantidad: { type: "integer", minimum: 1 }, pesoKg: { type: "number", exclusiveMinimum: 0 } },
} as const;

const cuerpoManifiesto = {
  type: "object",
  required: ["tipoCarga", "articulos"],
  additionalProperties: true,
  description:
    "general: puede llevar restriccionesRuta. refrigerada: tempMinC, tempMaxC y tiempoMaxMin (la ruta no puede pasar de ese tiempo). " +
    "peligrosa: claseUN (1 a 9), numeroONU, hojaSeguridad y telefonoEmergencia (la ruta evita terracería).",
  properties: {
    tipoCarga: { type: "string", enum: ["general", "refrigerada", "peligrosa"] },
    articulos: { type: "array", minItems: 1, items: articulo },
    restriccionesRuta: {
      type: "object",
      properties: { evitarTerraceria: { type: "boolean" }, tiempoMaxMin: { type: ["integer", "null"], minimum: 1 } },
    },
    tempMinC: { type: "number" },
    tempMaxC: { type: "number" },
    tiempoMaxMin: { type: "integer", minimum: 1 },
    claseUN: { type: "integer", minimum: 1, maximum: 9 },
    numeroONU: { type: "string", examples: ["UN1993"] },
    hojaSeguridad: { type: "string" },
    telefonoEmergencia: { type: "string" },
  },
  examples: [
    {
      tipoCarga: "general",
      articulos: [{ descripcion: "Cajas de café", cantidad: 40, pesoKg: 25 }],
      restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: null },
    },
    {
      tipoCarga: "refrigerada",
      articulos: [{ descripcion: "Vacunas", cantidad: 10, pesoKg: 5 }],
      tempMinC: 2,
      tempMaxC: 8,
      tiempoMaxMin: 240,
    },
    {
      tipoCarga: "peligrosa",
      articulos: [{ descripcion: "Solvente", cantidad: 4, pesoKg: 200 }],
      claseUN: 3,
      numeroONU: "UN1993",
      hojaSeguridad: "https://hopwright.local/hds/UN1993.pdf",
      telefonoEmergencia: "800 002 1400",
    },
  ],
} as const;

export async function rutasEnvios(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { estado?: string } }>("/envios", {
    schema: { tags: ["Envíos"], summary: "Lista envíos", querystring: { type: "object", properties: { estado: { type: "string" } } }, response: { 200: { type: "array", items: esquemaEnvio } } },
  }, async (req) => obtenerEnvios(req.query.estado));

  app.get<{ Params: { id: string } }>("/envios/:id", {
    schema: { tags: ["Envíos"], summary: "Obtiene un envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(404) } },
  }, async (req) => obtenerEnvio(req.params.id));

  app.post<{ Body: { idEnvio: string; idCliente: number; idCiudadOrigen: string; idCiudadDestino: string; pesoKg: number; prioridad: string } }>("/envios", {
    preHandler: app.requiereRol("despachador", "administrador"),
    schema: {
      security: conToken,
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
      response: { 201: esquemaEnvio, ...respuestasError(400, 401, 403, 409) },
    },
  }, async (req, reply) => reply.code(201).send(await registrarEnvio(req.body)));

  app.post<{ Params: { id: string }; Body: { placa: string } }>("/envios/:id/asignacion", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken,
      tags: ["Envíos"],
      summary: "Asigna un vehículo a un envío",
      params: paramsIdEnvio,
      body: { type: "object", required: ["placa"], additionalProperties: false, properties: { placa: { type: "string" } } },
      response: { 201: { type: "object", additionalProperties: true }, ...respuestasError(401, 403, 404, 409) },
    },
  }, async (req, reply) => reply.code(201).send(await asignarVehiculo(req.params.id, req.body.placa)));

  app.post<{ Params: { id: string } }>("/envios/:id/salida", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Envíos"], summary: "Registra salida del envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(401, 403, 404, 409) } },
  }, async (req) => registrarSalida(req.params.id));

  app.post<{ Params: { id: string } }>("/envios/:id/entrega", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Envíos"], summary: "Registra entrega del envío", params: paramsIdEnvio, response: { 200: esquemaEnvio, ...respuestasError(401, 403, 404, 409) } },
  }, async (req) => registrarEntrega(req.params.id));

  app.get<{ Params: { id: string } }>("/envios/:id/manifiesto", {
    schema: { tags: ["Envíos"], summary: "Obtiene manifiesto del envío", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerManifiesto(req.params.id));

  app.post<{ Params: { id: string }; Body: any }>("/envios/:id/manifiesto", {
    preHandler: app.requiereRol("despachador", "administrador"), schema: { security: conToken, tags: ["Envíos"], summary: "Crea manifiesto del envío", params: paramsIdEnvio, body: cuerpoManifiesto, response: { 201: { type: "object", additionalProperties: true }, ...respuestasError(401, 403, 400, 404, 409) } },
  }, async (req, reply) => reply.code(201).send(await guardarManifiesto(req.params.id, req.body)));

  app.get<{ Params: { id: string } }>("/envios/:id/bitacora", {
    schema: { tags: ["Envíos"], summary: "Obtiene bitácora del envío", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => {
    const envio = await obtenerEnvio(req.params.id);
    return (await buscarBitacora(envio.idEnvio)) ?? { idEnvio: envio.idEnvio, eventos: [] };
  });

  // Reúne lo que necesita el cálculo de ruta de un envío: origen, destino, peso y restricciones del manifiesto.
  app.get<{ Params: { id: string } }>("/envios/:id/datos-ruta", {
    schema: { tags: ["Envíos"], summary: "Datos para cálculo de ruta", params: paramsIdEnvio, response: { 200: { type: "object", additionalProperties: true }, ...respuestasError(404) } },
  }, async (req) => obtenerDatosParaRuta(req.params.id));
}
