import type { FastifyInstance } from "fastify";
import { calcularCiudadesAisladas } from "../services/rutas.service.js";
import { altaEstacion, altaInterseccion, altaTramo, bajaInterseccion, bajaTramo, cambioTramo, type NuevoTramo } from "../services/red.service.js";
import { listarPuntos } from "../repositories/graph/rutas.repository.js";
import { mapaDeLaRed } from "../repositories/graph/mapa.repository.js";
import { esquemaIdCiudad, respuestasError } from "../schemas/comunes.js";

const esquemaPunto = {
  type: "object",
  properties: { idPunto: { type: "string" }, nombre: { type: "string" }, tipo: { type: "string" } },
} as const;

const tiposVia = ["Autopista", "Federal", "Estatal", "Terracería"];

// Pendiente: cuando exista el login (tarea del compañero), las rutas que modifican la red
// llevarán preHandler: requiereRol("administrador").

export async function rutasRed(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { idInterseccion: string; nombre?: string; tipo: string; latitud: number; longitud: number } }>(
    "/red/intersecciones",
    {
      schema: {
        tags: ["Red"],
        summary: "Da de alta una intersección (cruce, glorieta o caseta)",
        body: {
          type: "object",
          required: ["idInterseccion", "tipo", "latitud", "longitud"],
          additionalProperties: false,
          properties: {
            idInterseccion: { type: "string", pattern: "^INT-[A-Z0-9]{2,10}$", examples: ["INT-PUE"] },
            nombre: { type: "string", minLength: 1, maxLength: 100 },
            tipo: { type: "string", enum: ["Cruce", "Glorieta", "Caseta"] },
            latitud: { type: "number", minimum: -90, maximum: 90 },
            longitud: { type: "number", minimum: -180, maximum: 180 },
          },
        },
        response: { 201: esquemaPunto, ...respuestasError(400, 409, 503) },
      },
    },
    async (req, reply) => reply.code(201).send(await altaInterseccion(req.body)),
  );

  app.delete<{ Params: { id: string } }>(
    "/red/intersecciones/:id",
    {
      schema: {
        tags: ["Red"],
        summary: "Borra una intersección y sus tramos",
        description: "No se permite si tiene incidentes activos o si algún punto vecino se quedaría sin tramos.",
        params: { type: "object", properties: { id: { type: "string" } } },
        response: { 204: { type: "null" }, ...respuestasError(404, 409, 503) },
      },
    },
    async (req, reply) => {
      await bajaInterseccion(req.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { idEstacion: string; nombre: string; tipoServicio: string; idCiudad: string; tiempoCambioMin: number } }>(
    "/red/estaciones",
    {
      schema: {
        tags: ["Red"],
        summary: "Da de alta una estación de tren y la ciudad donde está",
        body: {
          type: "object",
          required: ["idEstacion", "nombre", "tipoServicio", "idCiudad", "tiempoCambioMin"],
          additionalProperties: false,
          properties: {
            idEstacion: { type: "string", pattern: "^EST-[A-Z0-9]{2,10}$", examples: ["EST-MAP"] },
            nombre: { type: "string", minLength: 1, maxLength: 100 },
            tipoServicio: { type: "string", minLength: 1 },
            idCiudad: esquemaIdCiudad,
            tiempoCambioMin: { type: "integer", minimum: 0, description: "Minutos para pasar la carga del camión al tren" },
          },
        },
        response: { 201: esquemaPunto, ...respuestasError(400, 404, 409, 503) },
      },
    },
    async (req, reply) => reply.code(201).send(await altaEstacion(req.body)),
  );

  app.post<{ Body: NuevoTramo }>(
    "/red/tramos",
    {
      schema: {
        tags: ["Red"],
        summary: "Da de alta un tramo de carretera o de vía de tren",
        description:
          "Por defecto crea los dos sentidos (R14). Valida que los pesos sean positivos (R5), que la velocidad no pase de 110 km/h (R15), que el tipo de tramo una los nodos correctos (R12) y que no exista ya (R2).",
        body: {
          type: "object",
          required: ["tipo", "desde", "hasta", "distanciaKm", "tiempoMin"],
          additionalProperties: false,
          properties: {
            tipo: { type: "string", enum: ["CARRETERA", "VIA_FERREA"] },
            desde: { type: "string", minLength: 1 },
            hasta: { type: "string", minLength: 1 },
            distanciaKm: { type: "number" },
            tiempoMin: { type: "integer" },
            tiempoVueltaMin: { type: "integer", description: "Si el regreso tarda distinto (por ejemplo, una subida)" },
            dobleSentido: { type: "boolean", default: true },
            tipoVia: { type: "string", enum: tiposVia, description: "Obligatorio para CARRETERA" },
            costoCaseta: { type: "number", description: "Solo CARRETERA, pesos" },
            costoPorTonelada: { type: "number", description: "Solo VIA_FERREA, pesos por tonelada" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: { creados: { type: "integer" }, desde: { type: "string" }, hasta: { type: "string" }, tipo: { type: "string" } },
          },
          ...respuestasError(400, 404, 409, 503),
        },
      },
    },
    async (req, reply) => reply.code(201).send(await altaTramo(req.body)),
  );

  const consultaTramo = {
    type: "object",
    required: ["desde", "hasta", "tipoVia"],
    properties: {
      desde: { type: "string", minLength: 1 },
      hasta: { type: "string", minLength: 1 },
      tipoVia: { type: "string", enum: tiposVia },
    },
  } as const;

  app.patch<{
    Querystring: { desde: string; hasta: string; tipoVia: string; ambosSentidos?: boolean };
    Body: { abierto?: boolean; distanciaKm?: number; tiempoMin?: number; costoCaseta?: number };
  }>(
    "/red/tramos",
    {
      schema: {
        tags: ["Red"],
        summary: "Cambia un tramo de carretera (por ejemplo, cerrarlo o corregir su tiempo)",
        querystring: {
          ...consultaTramo,
          properties: { ...consultaTramo.properties, ambosSentidos: { type: "boolean", default: true } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            abierto: { type: "boolean" },
            distanciaKm: { type: "number" },
            tiempoMin: { type: "integer" },
            costoCaseta: { type: "number" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                desde: { type: "string" },
                hasta: { type: "string" },
                distanciaKm: { type: "number" },
                tiempoMin: { type: "number" },
                costoCaseta: { type: "number" },
                tipoVia: { type: "string" },
                abierto: { type: "boolean" },
              },
            },
          },
          ...respuestasError(400, 404, 503),
        },
      },
    },
    async (req) => cambioTramo(req.query.desde, req.query.hasta, req.query.tipoVia, req.body, req.query.ambosSentidos ?? true),
  );

  app.delete<{ Querystring: { desde: string; hasta: string; tipoVia: string } }>(
    "/red/tramos",
    {
      schema: {
        tags: ["Red"],
        summary: "Borra un tramo de carretera en los dos sentidos",
        querystring: consultaTramo,
        response: { 200: { type: "object", properties: { borradas: { type: "integer" } } }, ...respuestasError(404, 503) },
      },
    },
    async (req) => bajaTramo(req.query.desde, req.query.hasta, req.query.tipoVia),
  );

  app.get(
    "/red/puntos",
    {
      schema: {
        tags: ["Red"],
        summary: "Lista las ciudades, intersecciones y estaciones de la red",
        response: { 200: { type: "array", items: esquemaPunto }, ...respuestasError(503) },
      },
    },
    async () => listarPuntos(),
  );

  app.get(
    "/red/mapa",
    {
      schema: {
        tags: ["Red"],
        summary: "La red completa para dibujarla: puntos con coordenadas, tramos, incidentes activos y vehículos",
        description: "Cada tramo de doble sentido aparece una sola vez. Los puntos sin coordenadas (por ejemplo, una ciudad recién copiada de PostgreSQL) traen latitud y longitud en null.",
        response: {
          200: {
            type: "object",
            properties: {
              puntos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    idPunto: { type: "string" },
                    nombre: { type: "string" },
                    tipo: { type: "string" },
                    latitud: { type: ["number", "null"] },
                    longitud: { type: ["number", "null"] },
                  },
                },
              },
              tramos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    desde: { type: "string" },
                    hasta: { type: "string" },
                    tipo: { type: "string" },
                    tipoVia: { type: ["string", "null"] },
                    abierto: { type: "boolean" },
                    distanciaKm: { type: "number" },
                    tiempoMin: { type: "number" },
                    costoCaseta: { type: "number" },
                  },
                },
              },
              incidentes: {
                type: "array",
                items: { type: "object", properties: { idIncidente: { type: "string" }, gravedad: { type: "string" }, idPunto: { type: "string" } } },
              },
              vehiculos: {
                type: "array",
                items: { type: "object", properties: { placa: { type: "string" }, idPunto: { type: "string" } } },
              },
            },
          },
          ...respuestasError(503),
        },
      },
    },
    async () => mapaDeLaRed(),
  );

  app.get<{ Querystring: { punto: string; destino?: string } }>(
    "/red/ciudades-aisladas",
    {
      schema: {
        tags: ["Red"],
        summary: "Ciudades que se quedan sin camino si se cierra un punto (consulta C4)",
        description: "Por defecto revisa quién se queda sin camino hacia Tuxtla Gutiérrez (07101).",
        querystring: {
          type: "object",
          required: ["punto"],
          properties: {
            punto: { type: "string", minLength: 1, description: "idCiudad o idInterseccion que se cierra", examples: ["INT-OXC"] },
            destino: { ...esquemaIdCiudad, default: "07101" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              puntoCerrado: esquemaPunto,
              destino: esquemaPunto,
              aisladas: {
                type: "array",
                items: { type: "object", properties: { idCiudad: { type: "string" }, nombre: { type: "string" } } },
              },
            },
          },
          ...respuestasError(400, 404, 503),
        },
      },
    },
    async (req) => calcularCiudadesAisladas(req.query.punto, req.query.destino ?? "07101"),
  );
}
