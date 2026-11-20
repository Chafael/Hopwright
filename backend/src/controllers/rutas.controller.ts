import type { FastifyInstance } from "fastify";
import { calcularRuta, compararCamionTren } from "../services/rutas.service.js";
import { esquemaIdCiudad, respuestasError } from "../schemas/comunes.js";
import type { Criterio } from "../repositories/graph/rutas.repository.js";

const esquemaPunto = {
  type: "object",
  properties: { idPunto: { type: "string" }, nombre: { type: "string" }, tipo: { type: "string" } },
} as const;

const esquemaTramo = {
  type: "object",
  properties: {
    desde: { type: "string" },
    hacia: { type: "string" },
    distanciaKm: { type: "number" },
    tiempoMin: { type: "number" },
    costoCaseta: { type: "number" },
    tipoVia: { type: "string" },
  },
} as const;

const respuestaRuta = {
  type: "object",
  properties: {
    encontrada: { type: "boolean" },
    ruta: { type: "array", items: esquemaPunto },
    tramos: { type: "array", items: esquemaTramo },
    minutos: { type: "number" },
    kilometros: { type: "number" },
    costoCasetas: { type: "number" },
    avisos: { type: "array", items: { type: "string" } },
  },
} as const;

type ConsultaRuta = { origen: string; destino: string; criterio?: Criterio; evitarTerraceria?: boolean; tiempoMaxMin?: number };
type ConsultaCamionTren = { origen: string; destino: string; pesoKg: number };

export async function rutasRutas(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ConsultaRuta }>(
    "/rutas",
    {
      schema: {
        tags: ["Rutas"],
        summary: "Ruta por carretera entre dos ciudades (consulta C1)",
        description:
          "Calcula la ruta más rápida, más corta o con menos casetas. Excluye tramos cerrados, puntos con incidentes activos de gravedad Alta y, si se pide, tramos de terracería. Si no hay ruta posible responde 200 con encontrada=false y el motivo en avisos.",
        querystring: {
          type: "object",
          required: ["origen", "destino"],
          properties: {
            origen: esquemaIdCiudad,
            destino: esquemaIdCiudad,
            criterio: { type: "string", enum: ["tiempo", "distancia", "costo"], default: "tiempo" },
            evitarTerraceria: { type: "boolean", default: false, description: "Para cargas peligrosas" },
            tiempoMaxMin: { type: "integer", minimum: 1, description: "Para cargas refrigeradas" },
          },
        },
        response: { 200: respuestaRuta, ...respuestasError(400, 404, 503) },
      },
    },
    async (req) =>
      calcularRuta({
        origen: req.query.origen,
        destino: req.query.destino,
        criterio: req.query.criterio ?? "tiempo",
        evitarTerraceria: req.query.evitarTerraceria ?? false,
        tiempoMaxMin: req.query.tiempoMaxMin ?? null,
      }),
  );

  const esquemaOpcion = {
    type: ["object", "null"],
    properties: {
      modo: { type: "string" },
      minutos: { type: "number" },
      kilometros: { type: "number" },
      costo: { type: "number", description: "Pesos" },
      ruta: { type: "array", items: esquemaPunto },
      estacionSubida: { type: "string" },
      estacionBajada: { type: "string" },
      tramos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            modo: { type: "string", enum: ["camion", "tren"] },
            desde: { type: "string" },
            hasta: { type: "string" },
            minutos: { type: "number" },
            kilometros: { type: "number" },
            costo: { type: "number" },
          },
        },
      },
    },
  } as const;

  app.get<{ Querystring: ConsultaCamionTren }>(
    "/rutas/camion-tren",
    {
      schema: {
        tags: ["Rutas"],
        summary: "Compara camión contra camión + tren + camión (consulta C2)",
        description:
          "El costo en camión es casetas + kilómetros × COSTO_KM_CAMION. El costo en tren es lo que cobra cada tramo por tonelada × toneladas de la carga. El tiempo combinado incluye subir y bajar la carga en cada estación.",
        querystring: {
          type: "object",
          required: ["origen", "destino", "pesoKg"],
          properties: {
            origen: esquemaIdCiudad,
            destino: esquemaIdCiudad,
            pesoKg: { type: "number", exclusiveMinimum: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              origen: { type: "string" },
              destino: { type: "string" },
              pesoKg: { type: "number" },
              costoKmCamion: { type: "number" },
              soloCamion: esquemaOpcion,
              camionTren: esquemaOpcion,
              masBarata: { type: ["string", "null"] },
              masRapida: { type: ["string", "null"] },
            },
          },
          ...respuestasError(400, 404, 503),
        },
      },
    },
    async (req) => compararCamionTren(req.query),
  );
}
