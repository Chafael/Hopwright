// Prueba de conectividad (guía, punto 9): el backend llega a las tres bases.
// Requiere los contenedores arriba: docker compose up -d
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await construirApp();
});
afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("responde 200 y las tres bases en ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const cuerpo = res.json();
    expect(cuerpo.estado).toBe("ok");
    expect(cuerpo.bases.postgres.estado).toBe("ok");
    expect(cuerpo.bases.mongo.estado).toBe("ok");
    expect(cuerpo.bases.neo4j.estado).toBe("ok");
  });

  it("una ruta que no existe responde 404 con el formato de error común", async () => {
    const res = await app.inject({ method: "GET", url: "/no-existe" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "No encontrado", statusCode: 404 });
  });
});
