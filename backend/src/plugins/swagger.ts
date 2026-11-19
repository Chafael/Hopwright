import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// El contrato OpenAPI se genera con los mismos esquemas que validan cada ruta.
// Así la documentación no se puede quedar atrás del código.
export async function registrarSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Hopwright API",
        description: "API de Hopwright: asignación de vehículos, manifiestos de carga, incidentes y cálculo de rutas.",
        version: "0.1.0",
      },
      tags: [{ name: "Salud", description: "Estado de las tres bases de datos" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}
