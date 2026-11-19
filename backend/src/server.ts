import Fastify, { type FastifyInstance } from "fastify";
import { registrarSwagger } from "./plugins/swagger.js";
import { rutasSalud } from "./controllers/salud.controller.js";
import { cerrarPostgres } from "./db/postgres.js";
import { cerrarMongo } from "./db/mongo.js";
import { cerrarNeo4j } from "./db/neo4j.js";

// Construye la aplicación sin ponerla a escuchar. Las pruebas usan esta función con app.inject().
export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.NODE_ENV === "test" ? "silent" : "info" } });

  await registrarSwagger(app);

  // Todos los errores salen con la misma forma: { error, mensaje, statusCode }
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    const statusCode = error.validation ? 400 : error.statusCode ?? 500;
    if (statusCode >= 500) req.log.error(error);
    reply.code(statusCode).send({
      error: error.validation ? "Datos inválidos" : statusCode >= 500 ? "Error interno" : error.name,
      mensaje: statusCode >= 500 ? "Ocurrió un error inesperado" : error.message,
      statusCode,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: "No encontrado", mensaje: `La ruta ${req.method} ${req.url} no existe`, statusCode: 404 });
  });

  await app.register(rutasSalud);

  app.addHook("onClose", async () => {
    await Promise.allSettled([cerrarPostgres(), cerrarMongo(), cerrarNeo4j()]);
  });

  return app;
}
