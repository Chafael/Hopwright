// Pruebas de la ubicación de vehículos sobre la red de ejemplo (database/graph/data/02_vehiculos.cypher).
// Requiere los contenedores arriba: docker compose up -d
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";

const SAN_CRISTOBAL = "07078";
const TEOPISCA = "07094";

let app: FastifyInstance;
beforeAll(async () => {
  app = await construirApp();
});
afterAll(async () => {
  // Deja el vehículo donde estaba para no afectar las otras pruebas
  await app.inject({ method: "PATCH", url: "/vehiculos/CHP-1005/ubicacion", payload: { idPunto: SAN_CRISTOBAL } });
  await app.close();
});

const mover = (placa: string, idPunto: string) => app.inject({ method: "PATCH", url: `/vehiculos/${placa}/ubicacion`, payload: { idPunto } });

describe("ubicación de vehículos", () => {
  it("consulta dónde está un vehículo", async () => {
    const res = await app.inject({ url: "/vehiculos/CHP-1005/ubicacion" });
    expect(res.statusCode).toBe(200);
    expect(res.json().punto.idPunto).toBe(SAN_CRISTOBAL);
  });

  it("mueve un camión a otra ciudad y deja una sola ubicación", async () => {
    const res = await mover("CHP-1005", TEOPISCA);
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.anterior.idPunto).toBe(SAN_CRISTOBAL);
    expect(r.actual.idPunto).toBe(TEOPISCA);

    const ahora = (await app.inject({ url: "/vehiculos/CHP-1005/ubicacion" })).json();
    expect(ahora.punto.idPunto).toBe(TEOPISCA);
  });

  it("un camión no puede quedar en una estación (R11)", async () => {
    const res = await mover("CHP-1005", "EST-TAP");
    expect(res.statusCode).toBe(400);
    expect(res.json().mensaje).toMatch(/R11/);
  });

  it("el tren no puede salir a una ciudad (R11)", async () => {
    const res = await mover("TREN-01", "07101");
    expect(res.statusCode).toBe(400);
  });

  it("404 si el vehículo o el punto no existen", async () => {
    expect((await mover("XXX-0000", TEOPISCA)).statusCode).toBe(404);
    expect((await mover("CHP-1005", "INT-NOEXISTE")).statusCode).toBe(404);
    expect((await app.inject({ url: "/vehiculos/XXX-0000/ubicacion" })).statusCode).toBe(404);
  });

  it("400 si falta el punto o la placa tiene un formato inválido", async () => {
    expect((await app.inject({ method: "PATCH", url: "/vehiculos/CHP-1005/ubicacion", payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ url: "/vehiculos/chp%201005/ubicacion" })).statusCode).toBe(400);
  });
});
