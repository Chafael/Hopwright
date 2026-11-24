// Pruebas de las consultas de rutas sobre la red de ejemplo (database/graph/data).
// Los resultados esperados salen de esa red: si cambian los datos, cambian estos números.
// Requiere los contenedores arriba: docker compose up -d
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { escribir } from "../../backend/src/db/neo4j.js";

const TUXTLA = "07101";
const SAN_CRISTOBAL = "07078";
const ARRIAGA = "07009";
const TAPACHULA = "07089";
const COMITAN = "07019";

let app: FastifyInstance;
beforeAll(async () => {
  app = await construirApp();
});
afterAll(async () => {
  await app.close();
});

const nombres = (ruta: { nombre: string }[]) => ruta.map((p) => p.nombre);

describe("GET /rutas (C1)", () => {
  it("Tuxtla a San Cristóbal por tiempo usa la autopista", async () => {
    const res = await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}` });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.encontrada).toBe(true);
    expect(nombres(r.ruta)).toEqual(["Tuxtla Gutiérrez", "Chiapa de Corzo", "Caseta Chiapa de Corzo", "San Cristóbal de las Casas"]);
    expect(r.minutos).toBe(72);
    expect(r.kilometros).toBe(60);
    expect(r.costoCasetas).toBe(180);
  });

  it("Tuxtla a San Cristóbal por costo usa la libre y no paga caseta", async () => {
    const r = (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}&criterio=costo` })).json();
    expect(r.costoCasetas).toBe(0);
    expect(r.minutos).toBe(105);
    expect(nombres(r.ruta)).not.toContain("Caseta Chiapa de Corzo");
  });

  it("Tuxtla a Arriaga: la más rápida usa terracería; una carga peligrosa no", async () => {
    const rapida = (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${ARRIAGA}` })).json();
    expect(rapida.minutos).toBe(193);
    expect(rapida.tramos.some((t: { tipoVia: string }) => t.tipoVia === "Terracería")).toBe(true);

    const segura = (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${ARRIAGA}&evitarTerraceria=true` })).json();
    expect(segura.minutos).toBe(218);
    expect(segura.tramos.some((t: { tipoVia: string }) => t.tipoVia === "Terracería")).toBe(false);
  });

  it("si nadie cumple el tiempo máximo, responde encontrada=false con el motivo", async () => {
    const r = (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${ARRIAGA}&tiempoMaxMin=100` })).json();
    expect(r.encontrada).toBe(false);
    expect(r.avisos[0]).toMatch(/100 minutos/);
  });

  it("avisa cuando la ruta pasa por un incidente activo que no bloquea (gravedad Media)", async () => {
    const r = (await app.inject({ url: `/rutas?origen=${SAN_CRISTOBAL}&destino=${COMITAN}` })).json();
    expect(nombres(r.ruta)).toContain("Teopisca");
    expect(r.avisos.some((a: string) => a.includes("Teopisca") && a.includes("Media"))).toBe(true);
  });

  it("esquiva un punto con un incidente activo de gravedad Alta (R16)", async () => {
    await escribir(
      `MATCH (p:Interseccion {idInterseccion: 'INT-CRU'})
       MERGE (i:Incidente {idIncidente: 'INC-PRUEBA'}) SET i.gravedad = 'Alta', i.activo = true
       MERGE (i)-[:BLOQUEA]->(p)`,
    );
    try {
      const r = (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${ARRIAGA}&evitarTerraceria=true` })).json();
      expect(r.encontrada).toBe(true);
      expect(nombres(r.ruta)).not.toContain("Entronque Las Cruces");
      expect(r.minutos).toBe(652); // rodea por San Cristóbal, Comitán, Motozintla y la costa
    } finally {
      await escribir(`MATCH (i:Incidente {idIncidente: 'INC-PRUEBA'}) DETACH DELETE i`);
    }
  });

  it("404 si la ciudad no existe", async () => {
    const res = await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=07999` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No encontrado");
  });

  it("400 si origen y destino son iguales", async () => {
    const res = await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${TUXTLA}` });
    expect(res.statusCode).toBe(400);
  });

  it("400 si la clave de ciudad no tiene 5 dígitos", async () => {
    const res = await app.inject({ url: `/rutas?origen=tuxtla&destino=${ARRIAGA}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Datos inválidos");
  });
});

describe("GET /rutas/camion-tren (C2)", () => {
  it("Tuxtla a Tapachula con 20 toneladas: el camión es más rápido y el tren más barato", async () => {
    const res = await app.inject({ url: `/rutas/camion-tren?origen=${TUXTLA}&destino=${TAPACHULA}&pesoKg=20000` });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.soloCamion.minutos).toBe(438);
    expect(r.soloCamion.costo).toBe(395 * 25); // 395 km sin casetas, a 25 pesos por km
    expect(r.camionTren.estacionSubida).toBe("Estación Arriaga");
    expect(r.camionTren.estacionBajada).toBe("Estación Tapachula");
    expect(r.camionTren.costo).toBe(6260); // 140 km × 25 + 138 $/ton × 20 ton
    expect(r.camionTren.minutos).toBe(683); // 193 camión + 340 tren + 150 de carga y descarga
    expect(r.masBarata).toBe("camion-tren");
    expect(r.masRapida).toBe("camion");
  });

  it("400 si el peso es cero", async () => {
    const res = await app.inject({ url: `/rutas/camion-tren?origen=${TUXTLA}&destino=${TAPACHULA}&pesoKg=0` });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /red/ciudades-aisladas (C4)", () => {
  it("si se cierra el entronque de Oxchuc, Ocosingo y Palenque se quedan sin camino a Tuxtla", async () => {
    const r = (await app.inject({ url: "/red/ciudades-aisladas?punto=INT-OXC" })).json();
    expect(r.aisladas.map((c: { nombre: string }) => c.nombre)).toEqual(["Ocosingo", "Palenque"]);
  });

  it("si se cierra Las Cruces nadie queda aislado, porque hay caminos alternos", async () => {
    const r = (await app.inject({ url: "/red/ciudades-aisladas?punto=INT-CRU" })).json();
    expect(r.aisladas).toEqual([]);
  });

  it("404 si el punto no existe", async () => {
    const res = await app.inject({ url: "/red/ciudades-aisladas?punto=INT-NOEXISTE" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /red/mapa", () => {
  it("regresa los 36 puntos con coordenadas, una línea por tramo, incidentes activos y vehículos", async () => {
    const mapa = (await app.inject({ url: "/red/mapa" })).json();
    expect(mapa.puntos).toHaveLength(36);
    expect(mapa.puntos.every((p: { latitud: number | null }) => typeof p.latitud === "number")).toBe(true);
    // 33 tramos de carretera y 4 de vía férrea, cada uno una sola vez
    expect(mapa.tramos.filter((t: { tipo: string }) => t.tipo === "CARRETERA")).toHaveLength(33);
    expect(mapa.tramos.filter((t: { tipo: string }) => t.tipo === "VIA_FERREA")).toHaveLength(4);
    expect(mapa.incidentes.map((i: { idIncidente: string }) => i.idIncidente)).toContain("INC-0001");
    expect(mapa.vehiculos.length).toBeGreaterThanOrEqual(7);
  });
});

describe("GET /red/puntos", () => {
  it("lista los 36 puntos de la red de ejemplo", async () => {
    const puntos = (await app.inject({ url: "/red/puntos" })).json();
    expect(puntos).toHaveLength(36);
  });
});
