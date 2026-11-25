import { execSync } from "node:child_process";
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { pool } from "../../backend/src/db/postgres.js";
import { escribir } from "../../backend/src/db/neo4j.js";
import { vehiculosEnGrafo } from "../../backend/src/repositories/graph/reconciliacion.repository.js";
import { procesarEventosPendientes } from "../../backend/src/services/procesadorEventos.service.js";

const CONTENEDOR = "hopwright-neo4j";
const docker = (comando: string) => execSync(`docker ${comando} ${CONTENEDOR}`, { stdio: "pipe" });

let app: FastifyInstance;
let placa: string | undefined;

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
  docker("start");
  await esperarNeo4j(120_000).catch(() => undefined);
  if (placa) {
    await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'placa' = $1", [placa]);
    await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
    await escribir("MATCH (v:Vehiculo {placa: $placa}) DETACH DELETE v", { placa }).catch(() => undefined);
  }
  await app.close();
});

it("un vehículo registrado con Neo4j apagado se guarda en PostgreSQL y se replica al reconectar", async () => {
  placa = `TSN${String(Date.now()).slice(-6)}`;
  docker("stop");

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { correo: "admin@hopwright.local", password: "hopwright123" },
  });
  expect(login.statusCode).toBe(200);

  const respuesta = await app.inject({
    method: "POST",
    url: "/vehiculos",
    headers: { authorization: `Bearer ${login.json().token}` },
    payload: { placa, tipo: "Camión", capacidadKg: 4000, estado: "Disponible" },
  });
  expect(respuesta.statusCode).toBe(201);

  const { rows: vehiculos } = await pool.query("SELECT placa, estado FROM vehiculo WHERE placa = $1", [placa]);
  expect(vehiculos).toHaveLength(1);
  expect(vehiculos[0].estado).toBe("Disponible");

  const { rows: eventos } = await pool.query(
    "SELECT id, tipo, estado FROM eventos_pendientes WHERE tipo = 'VEHICULO_GUARDADO' AND payload->>'placa' = $1",
    [placa],
  );
  expect(eventos).toHaveLength(1);
  expect(eventos[0].estado).toBe("pendiente");

  docker("start");
  await esperarNeo4j(120_000);
  expect((await vehiculosEnGrafo()).some((v) => v.placa === placa)).toBe(false);

  await procesarEventosPendientes();
  expect((await vehiculosEnGrafo()).some((v) => v.placa === placa)).toBe(true);
  const { rows: aplicados } = await pool.query("SELECT estado FROM eventos_pendientes WHERE id = $1", [eventos[0].id]);
  expect(aplicados[0].estado).toBe("aplicado");
});
