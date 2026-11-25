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
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "Token JWT emitido por POST /auth/login",
            },
          },
        },
        tags: [
          { name: "Salud", description: "Estado de las tres bases de datos" },
        { name: "Autenticación", description: "Inicio de sesión y emisión de tokens JWT" },
        { name: "Clientes", description: "Catálogo de clientes de la paquetería" },
        { name: "Conductores", description: "Catálogo de conductores" },
        { name: "Ciudades", description: "Catálogo de ciudades" },
        { name: "Vehículos", description: "Vehículos de la flota y su ubicación en la red" },
        { name: "Envíos", description: "Envíos, asignación, manifiestos y bitácora" },
        { name: "Red", description: "Puntos y tramos de la red de carreteras y tren (Neo4j)" },
        { name: "Rutas", description: "Cálculo de rutas sobre la red (Neo4j)" },
        { name: "Incidentes", description: "Reportes de incidente (MongoDB) y su réplica en la red (Neo4j)" },
        { name: "Administración", description: "Tareas de mantenimiento entre las tres bases" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}
