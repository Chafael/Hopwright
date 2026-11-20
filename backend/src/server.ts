import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { registrarSwagger } from "./plugins/swagger.js";
import { ErrorApp } from "./errores.js";
import { rutasSalud } from "./controllers/salud.controller.js";
import { rutasRed } from "./controllers/red.controller.js";
import { rutasRutas } from "./controllers/rutas.controller.js";
import { cerrarPostgres } from "./db/postgres.js";
import { cerrarMongo } from "./db/mongo.js";
import { cerrarNeo4j } from "./db/neo4j.js";

// Reconoce los errores de conexión de los tres drivers: PostgreSQL (ECONNREFUSED, timeout),
// Neo4j (ServiceUnavailable) y MongoDB (MongoServerSelectionError).
function esBaseCaida(error: Error & { code?: string }): boolean {
  return (
    error.code === "ECONNREFUSED" ||
    error.code === "ServiceUnavailable" ||
    error.code === "SessionExpired" ||
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    /Connection terminated|timeout exceeded when trying to connect/i.test(error.message)
  );
}

// Construye la aplicación sin ponerla a escuchar. Las pruebas usan esta función con app.inject().
export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === "test" ? "silent" : "info" },
    // Convierte "true"/"false" y números del querystring a su tipo según el esquema
    ajv: { customOptions: { coerceTypes: true, removeAdditional: false, allErrors: true } },
  });

  // La interfaz web corre en otro puerto, así que el navegador necesita permiso (CORS)
  await app.register(cors, { origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",") });

  await registrarSwagger(app);

  // Todos los errores salen con la misma forma: { error, mensaje, statusCode, detalles? }
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (error instanceof ErrorApp) {
      return reply.code(error.statusCode).send({
        error: error.name,
        mensaje: error.message,
        statusCode: error.statusCode,
        ...(error.detalles !== undefined ? { detalles: error.detalles } : {}),
      });
    }
    if (esBaseCaida(error)) {
      req.log.warn({ err: error }, "Una base de datos no respondió");
      return reply.code(503).send({
        error: "Servicio no disponible",
        mensaje: "Una de las bases de datos no responde. Intenta de nuevo en unos momentos.",
        statusCode: 503,
      });
    }
    if (error.validation) {
      // Error de validación del esquema de la ruta (tipo equivocado, campo faltante, etc.)
      return reply.code(400).send({ error: "Datos inválidos", mensaje: error.message, statusCode: 400 });
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) req.log.error(error);
    return reply.code(statusCode).send({
      error: statusCode >= 500 ? "Error interno" : error.name,
      mensaje: statusCode >= 500 ? "Ocurrió un error inesperado" : error.message,
      statusCode,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: "No encontrado", mensaje: `La ruta ${req.method} ${req.url} no existe`, statusCode: 404 });
  });

  await app.register(rutasSalud);
  await app.register(rutasRed);
  await app.register(rutasRutas);

  app.addHook("onClose", async () => {
    await Promise.allSettled([cerrarPostgres(), cerrarMongo(), cerrarNeo4j()]);
  });

  return app;
}
