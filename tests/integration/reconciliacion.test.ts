// Prueba de POST /admin/reconciliar: se descompone a propósito la réplica de incidentes en el grafo
// y se comprueba que la reconciliación la deja igual que MongoDB.
// Requiere los contenedores arriba: docker compose up -d
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { mongoDb } from "../../backend/src/db/mongo.js";
import { escribir } from "../../backend/src/db/neo4j.js";
import { leerIncidenteEnGrafo } from "../../backend/src/repositories/graph/incidentes.repository.js";
import { conAdmin } from "../token.js";

const SIN_COPIAR = "INC-90001"; // está en MongoDB pero nunca llegó al grafo
const HUERFANO = "INC-90002"; // está en el grafo pero no en MongoDB

let app: FastifyInstance;
const reportes = async () => (await mongoDb()).collection("reportes_incidente");

beforeAll(async () => {
  app = await construirApp();

  await (await reportes()).insertOne({
    idIncidente: SIN_COPIAR,
    tipo: "Derrumbe",
    idPunto: "INT-OXC",
    tipoPunto: "Interseccion",
    gravedad: "Alta",
    descripcion: "Derrumbe que se reportó mientras Neo4j estaba caído",
    fechaInicio: new Date(),
    detalle: { volumenEstimadoM3: 80, requiereMaquinaria: true },
    evidencias: [],
    activo: true,
    sincronizado: false,
    reportadoPor: "Prueba de reconciliación",
    creadoEn: new Date(),
  });
  await escribir(
    `MATCH (p:Interseccion {idInterseccion: 'INT-ESC'})
     MERGE (i:Incidente {idIncidente: $id}) SET i.gravedad = 'Alta', i.activo = true
     MERGE (i)-[:BLOQUEA]->(p)`,
    { id: HUERFANO },
  );
  // La réplica de INC-0001 dice Baja, pero en MongoDB es Media
  await escribir(`MATCH (i:Incidente {idIncidente: 'INC-0001'}) SET i.gravedad = 'Baja'`);
});

afterAll(async () => {
  await (await reportes()).deleteOne({ idIncidente: SIN_COPIAR });
  await escribir(`MATCH (i:Incidente) WHERE i.idIncidente IN $ids DETACH DELETE i`, { ids: [SIN_COPIAR, HUERFANO] });
  await escribir(`MATCH (i:Incidente {idIncidente: 'INC-0001'}) SET i.gravedad = 'Media'`);
  await app.close();
});

describe("POST /admin/reconciliar", () => {
  it("solo el administrador puede reconciliar: 401 sin sesión y 403 con un despachador", async () => {
    expect((await app.inject({ method: "POST", url: "/admin/reconciliar" })).statusCode).toBe(401);
    const despachador = { authorization: `Bearer ${app.jwt.sign({ idUsuario: 1, rol: "despachador", correo: "despacho@hopwright.local" })}` };
    expect((await app.inject({ method: "POST", url: "/admin/reconciliar", headers: despachador })).statusCode).toBe(403);
  });

  it("copia lo que falta, corrige lo distinto y borra lo que sobra", async () => {
    const res = await app.inject({ method: "POST", url: "/admin/reconciliar", headers: conAdmin(app) });
    expect(res.statusCode).toBe(200);
    const r = res.json();

    expect(r.incidentes.copiados).toEqual(expect.arrayContaining([SIN_COPIAR, "INC-0001"]));
    expect(r.incidentes.borradosDelGrafo).toContain(HUERFANO);

    expect(await leerIncidenteEnGrafo(SIN_COPIAR)).toEqual({ idIncidente: SIN_COPIAR, gravedad: "Alta", activo: true, idPunto: "INT-OXC" });
    expect(await leerIncidenteEnGrafo(HUERFANO)).toBeNull();
    expect((await leerIncidenteEnGrafo("INC-0001"))?.gravedad).toBe("Media");
    expect((await (await reportes()).findOne({ idIncidente: SIN_COPIAR }))?.sincronizado).toBe(true);
  });

  it("correrla otra vez no cambia nada", async () => {
    const r = (await app.inject({ method: "POST", url: "/admin/reconciliar", headers: conAdmin(app) })).json();
    expect(r.incidentes.copiados).toEqual([]);
    expect(r.incidentes.borradosDelGrafo).toEqual([]);
  });

  it("avisa si todavía no existen las tablas de PostgreSQL", async () => {
    const r = (await app.inject({ method: "POST", url: "/admin/reconciliar", headers: conAdmin(app) })).json();
    if (r.ciudades === null) expect(r.avisos).toEqual(expect.arrayContaining([expect.stringMatching(/tabla ciudad/)]));
    if (r.vehiculos === null) expect(r.avisos).toEqual(expect.arrayContaining([expect.stringMatching(/tabla vehiculo/)]));
  });
});
