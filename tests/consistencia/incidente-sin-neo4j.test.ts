// Prueba de consistencia: qué pasa con un incidente si Neo4j se cae a la mitad.
//
// 1. Se apaga el contenedor de Neo4j.
// 2. Se reporta un incidente: debe guardarse en MongoDB y responder 202 con sincronizado: false.
// 3. Se enciende Neo4j y se espera a que responda.
// 4. Se corre la reconciliación: debe copiar el incidente al grafo y marcarlo sincronizado.
//
// Se corre con: npm run test:consistencia (necesita docker y los contenedores arriba).
import { execSync } from "node:child_process";
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { mongoDb } from "../../backend/src/db/mongo.js";
import { escribir } from "../../backend/src/db/neo4j.js";
import { leerIncidenteEnGrafo } from "../../backend/src/repositories/graph/incidentes.repository.js";
import { conAdmin } from "../token.js";

const CONTENEDOR = "hopwright-neo4j";

let app: FastifyInstance;
let idIncidente: string | undefined;

const docker = (comando: string) => execSync(`docker ${comando} ${CONTENEDOR}`, { stdio: "pipe" });

async function esperarNeo4j(limiteMs: number): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const salud = (await app.inject({ url: "/health" })).json();
    if (salud.bases?.neo4j?.estado === "ok") return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Neo4j no volvió a responder en ${limiteMs / 1000} s`);
}

beforeAll(async () => {
  app = await construirApp();
});

afterAll(async () => {
  // Pase lo que pase, Neo4j tiene que quedar encendido
  docker("start");
  await esperarNeo4j(120_000).catch(() => undefined);
  if (idIncidente) {
    await (await mongoDb()).collection("reportes_incidente").deleteOne({ idIncidente });
    await escribir(`MATCH (i:Incidente {idIncidente: $id}) DETACH DELETE i`, { id: idIncidente }).catch(() => undefined);
  }
  await app.close();
});

it("un incidente reportado con Neo4j apagado llega al grafo al reconciliar", async () => {
  docker("stop");

  const res = await app.inject({
    method: "POST",
    url: "/incidentes",
    headers: conAdmin(app),
    payload: {
      tipo: "Accidente",
      idPunto: "INT-CRU",
      gravedad: "Alta",
      descripcion: "Choque de dos tráileres en el Entronque Las Cruces (prueba de consistencia)",
      detalle: { vehiculosInvolucrados: 2, hayLesionados: false },
      reportadoPor: "Prueba de consistencia",
    },
  });
  expect(res.statusCode).toBe(202);
  const { incidente, aviso } = res.json();
  idIncidente = incidente.idIncidente;
  expect(incidente.sincronizado).toBe(false);
  expect(aviso).toMatch(/reconciliar/);

  // El reporte no se perdió: está en MongoDB
  const enMongo = await (await mongoDb()).collection("reportes_incidente").findOne({ idIncidente });
  expect(enMongo?.sincronizado).toBe(false);

  docker("start");
  await esperarNeo4j(120_000);
  expect(await leerIncidenteEnGrafo(idIncidente!)).toBeNull();

  const resumen = (await app.inject({ method: "POST", url: "/admin/reconciliar", headers: conAdmin(app) })).json();
  expect(resumen.incidentes.copiados).toContain(idIncidente);

  expect(await leerIncidenteEnGrafo(idIncidente!)).toMatchObject({ gravedad: "Alta", activo: true, idPunto: "INT-CRU" });
  expect((await app.inject({ url: `/incidentes/${idIncidente}` })).json().sincronizado).toBe(true);

  // Una segunda reconciliación ya no tiene nada que copiar de este incidente
  const otraVez = (await app.inject({ method: "POST", url: "/admin/reconciliar", headers: conAdmin(app) })).json();
  expect(otraVez.incidentes.copiados).not.toContain(idIncidente);
});
