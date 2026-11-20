// Prueba de GET /incidentes/{id}/envios-afectados (C5) contra las tres bases.
// Los envíos viven en PostgreSQL (parte del compañero). Mientras esas tablas no existan, la consulta
// responde con un aviso y esta prueba comprueba eso; cuando existan, comprueba la forma de la respuesta.
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

describe("GET /incidentes/{id}/envios-afectados (C5)", () => {
  it("revisa los envíos en camino contra el incidente activo de Teopisca", async () => {
    const res = await app.inject({ url: "/incidentes/INC-0001/envios-afectados" });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.incidente).toMatchObject({ idIncidente: "INC-0001", idPunto: "07094", punto: "Teopisca", activo: true });
    expect(Array.isArray(r.afectados)).toBe(true);
    // INC-0001 es de gravedad Media: no cierra el paso, pero se calcula el desvío
    expect(r.avisos.join(" ")).toMatch(/gravedad Media/);
    for (const a of r.afectados) {
      expect(a.rutaSinIncidente.ruta).toContain("Teopisca");
      if (a.desvio) expect(a.desvio.ruta).not.toContain("Teopisca");
    }
  });

  it("un incidente cerrado no afecta a ningún envío", async () => {
    const r = (await app.inject({ url: "/incidentes/INC-0002/envios-afectados" })).json();
    expect(r.afectados).toEqual([]);
    expect(r.avisos[0]).toMatch(/cerrado/);
  });

  it("404 si el incidente no existe", async () => {
    expect((await app.inject({ url: "/incidentes/INC-9999/envios-afectados" })).statusCode).toBe(404);
  });
});
