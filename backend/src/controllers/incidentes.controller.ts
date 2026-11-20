import type { FastifyInstance } from "fastify";
import {
  cerrarIncidente,
  consultarIncidente,
  listarIncidentes,
  nuevaEvidencia,
  reportarIncidente,
  type NuevoIncidente,
  type ResultadoEscritura,
} from "../services/incidentes.service.js";
import { GRAVEDADES, TIPOS_INCIDENTE, type Gravedad, type TipoIncidente } from "../services/incidentes.reglas.js";
import { respuestasError } from "../schemas/comunes.js";

const fecha = { type: "string", format: "date-time" } as const;

const esquemaEvidencia = {
  type: "object",
  properties: { tipo: { type: "string" }, url: { type: "string" }, texto: { type: "string" }, autor: { type: "string" }, fecha },
} as const;

const esquemaIncidente = {
  type: "object",
  properties: {
    idIncidente: { type: "string" },
    tipo: { type: "string" },
    idPunto: { type: "string" },
    tipoPunto: { type: "string" },
    gravedad: { type: "string" },
    descripcion: { type: "string" },
    fechaInicio: fecha,
    fechaFin: fecha,
    motivoCierre: { type: "string" },
    detalle: { type: "object", additionalProperties: true },
    evidencias: { type: "array", items: esquemaEvidencia },
    activo: { type: "boolean" },
    sincronizado: { type: "boolean", description: "false si el cambio todavía no llega a Neo4j" },
    reportadoPor: { type: "string" },
    creadoEn: fecha,
    actualizadoEn: fecha,
  },
} as const;

// Respuesta de alta y cierre: el incidente y, si Neo4j no respondió, un aviso
const esquemaEscritura = {
  type: "object",
  properties: { incidente: esquemaIncidente, aviso: { type: "string" } },
} as const;

const paramsId = {
  type: "object",
  properties: { id: { type: "string", pattern: "^INC-[0-9]{4,}$", examples: ["INC-0001"] } },
} as const;

const evidenciaEntrada = {
  type: "object",
  required: ["tipo"],
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: ["Foto", "Testimonio"] },
    url: { type: "string", minLength: 5, maxLength: 500 },
    texto: { type: "string", minLength: 2, maxLength: 1000 },
    autor: { type: "string", minLength: 2, maxLength: 150 },
    fecha,
  },
} as const;

const responder = (r: ResultadoEscritura) => ({ incidente: r.incidente, ...(r.aviso ? { aviso: r.aviso } : {}) });

export async function rutasIncidentes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: NuevoIncidente }>(
    "/incidentes",
    {
      schema: {
        tags: ["Incidentes"],
        summary: "Reporta un incidente en un punto de la red",
        description:
          "Guarda el reporte en MongoDB y lo copia a Neo4j para que el cálculo de rutas lo tome en cuenta. " +
          "Responde 201 si quedó en las dos bases y 202 si Neo4j no respondió (el reporte sí se guardó y se copia al reconciliar). " +
          "El detalle depende del tipo: Bloqueo { causa, carrilesCerrados, pasoAlternado? }, Accidente { vehiculosInvolucrados, hayLesionados, autoridadEnSitio? }, " +
          "Obra { dependencia, fechaFinEstimada, horario? }, Derrumbe { volumenEstimadoM3, requiereMaquinaria }.",
        body: {
          type: "object",
          required: ["tipo", "idPunto", "gravedad", "descripcion", "detalle", "reportadoPor"],
          additionalProperties: false,
          properties: {
            tipo: { type: "string", enum: TIPOS_INCIDENTE },
            idPunto: { type: "string", minLength: 1, description: "Clave INEGI de la ciudad o id de la intersección", examples: ["INT-CRU"] },
            gravedad: { type: "string", enum: GRAVEDADES, description: "Solo Alta saca el punto del cálculo de rutas (R16)" },
            descripcion: { type: "string", minLength: 5, maxLength: 1000 },
            fechaInicio: { ...fecha, description: "Si no se manda, se usa la hora actual" },
            detalle: { type: "object", examples: [{ causa: "Manifestación", carrilesCerrados: 2, pasoAlternado: false }] },
            evidencias: { type: "array", maxItems: 50, items: evidenciaEntrada },
            // Cuando exista el login, se tomará del usuario autenticado
            reportadoPor: { type: "string", minLength: 2, maxLength: 150, examples: ["Despacho Tuxtla"] },
          },
        },
        response: { 201: esquemaEscritura, 202: esquemaEscritura, ...respuestasError(400, 404, 503) },
      },
    },
    async (req, reply) => {
      const r = await reportarIncidente(req.body);
      return reply.code(r.codigo).send(responder(r));
    },
  );

  app.get<{ Querystring: { activo?: boolean; gravedad?: Gravedad; tipo?: TipoIncidente; idPunto?: string; sincronizado?: boolean; limite?: number } }>(
    "/incidentes",
    {
      schema: {
        tags: ["Incidentes"],
        summary: "Lista los reportes de incidente, del más reciente al más antiguo",
        querystring: {
          type: "object",
          properties: {
            activo: { type: "boolean" },
            gravedad: { type: "string", enum: GRAVEDADES },
            tipo: { type: "string", enum: TIPOS_INCIDENTE },
            idPunto: { type: "string", minLength: 1 },
            sincronizado: { type: "boolean", description: "false para ver los que no han llegado a Neo4j" },
            limite: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: { 200: { type: "array", items: esquemaIncidente }, ...respuestasError(400, 503) },
      },
    },
    async (req) => {
      const { limite, ...filtro } = req.query;
      return listarIncidentes(filtro, limite ?? 50);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/incidentes/:id",
    {
      schema: {
        tags: ["Incidentes"],
        summary: "Reporte completo de un incidente",
        params: paramsId,
        response: { 200: esquemaIncidente, ...respuestasError(400, 404, 503) },
      },
    },
    async (req) => consultarIncidente(req.params.id),
  );

  app.patch<{ Params: { id: string }; Body: { motivoCierre?: string; fechaFin?: string } }>(
    "/incidentes/:id/cerrar",
    {
      schema: {
        tags: ["Incidentes"],
        summary: "Cierra un incidente y libera el punto para el cálculo de rutas",
        description: "Responde 200 si el cierre llegó a las dos bases y 202 si Neo4j no respondió.",
        params: paramsId,
        body: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            motivoCierre: { type: "string", minLength: 2, maxLength: 500 },
            fechaFin: { ...fecha, description: "Si no se manda, se usa la hora actual" },
          },
        },
        response: { 200: esquemaEscritura, 202: esquemaEscritura, ...respuestasError(400, 404, 409, 503) },
      },
    },
    async (req, reply) => {
      const r = await cerrarIncidente(req.params.id, req.body ?? {});
      return reply.code(r.codigo).send(responder(r));
    },
  );

  app.post<{ Params: { id: string }; Body: { tipo: "Foto" | "Testimonio"; url?: string; texto?: string; autor?: string; fecha?: string } }>(
    "/incidentes/:id/evidencias",
    {
      schema: {
        tags: ["Incidentes"],
        summary: "Agrega una foto o un testimonio a un incidente",
        params: paramsId,
        body: evidenciaEntrada,
        response: { 201: esquemaIncidente, ...respuestasError(400, 404, 503) },
      },
    },
    async (req, reply) => reply.code(201).send(await nuevaEvidencia(req.params.id, req.body)),
  );
}
