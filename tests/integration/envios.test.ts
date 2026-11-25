// Login, permisos y flujo de un envío (alta, asignación, salida y entrega) contra PostgreSQL.
// Requiere los contenedores arriba: docker compose up -d
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { pool } from "../../backend/src/db/postgres.js";

const sufijo = String(Date.now()).slice(-7);
const ENVIO_FLUJO = `E-7${sufijo}`;
const ENVIO_DOBLE = `E-6${sufijo}`;
const creados = [ENVIO_FLUJO, ENVIO_DOBLE];

let app: FastifyInstance;
let tokenDespacho: string;

beforeAll(async () => {
  app = await construirApp();
  const r = await app.inject({ method: "POST", url: "/auth/login", payload: { correo: "despacho@hopwright.local", password: "hopwright123" } });
  tokenDespacho = r.json().token;
});

afterAll(async () => {
  // Borra lo que creó la prueba y deja los vehículos como estaban en los datos de ejemplo
  await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' = ANY($1)", [creados]);
  await pool.query("DELETE FROM asignacion WHERE id_envio = ANY($1)", [creados]);
  await pool.query("DELETE FROM envio WHERE id_envio = ANY($1)", [creados]);
  await pool.query("UPDATE vehiculo SET estado = 'Disponible' WHERE placa IN ('CHP-1002', 'CHP-1006')");
  await app.close();
});

const conToken = (token: string) => ({ authorization: `Bearer ${token}` });
const nuevoEnvio = (idEnvio: string) => ({ idEnvio, idCliente: 1, idCiudadOrigen: "07101", idCiudadDestino: "07078", pesoKg: 500, prioridad: "Normal" });

describe("login", () => {
  it("con la contraseña de prueba regresa un token", () => {
    expect(tokenDespacho).toEqual(expect.any(String));
  });

  it("con una contraseña incorrecta responde 401", async () => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { correo: "despacho@hopwright.local", password: "otra" } });
    expect(r.statusCode).toBe(401);
  });

  it("con un correo que no existe también responde 401, sin decir cuál de los dos falló", async () => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { correo: "nadie@hopwright.local", password: "hopwright123" } });
    expect(r.statusCode).toBe(401);
  });
});

describe("permisos", () => {
  it("sin token no se puede registrar un envío", async () => {
    const r = await app.inject({ method: "POST", url: "/envios", payload: nuevoEnvio(ENVIO_FLUJO) });
    expect(r.statusCode).toBe(401);
  });

  it("un despachador no puede cambiar los datos de un vehículo", async () => {
    const r = await app.inject({ method: "PATCH", url: "/vehiculos/CHP-1006", headers: conToken(tokenDespacho), payload: { estado: "En taller" } });
    expect(r.statusCode).toBe(403);
  });

  it("las consultas no piden token", async () => {
    expect((await app.inject({ url: "/envios/E-101" })).statusCode).toBe(200);
  });
});

describe("flujo de un envío", () => {
  it("se registra, se asigna, sale y se entrega; el vehículo queda libre al final", async () => {
    const h = conToken(tokenDespacho);
    expect((await app.inject({ method: "POST", url: "/envios", headers: h, payload: nuevoEnvio(ENVIO_FLUJO) })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/envios/${ENVIO_FLUJO}/asignacion`, headers: h, payload: { placa: "CHP-1006" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/envios/${ENVIO_FLUJO}/salida`, headers: h })).json().estado).toBe("En camino");
    expect((await app.inject({ method: "POST", url: `/envios/${ENVIO_FLUJO}/entrega`, headers: h })).json().estado).toBe("Entregado");
    expect((await app.inject({ url: "/vehiculos/CHP-1006" })).json().estado).toBe("Disponible");

    // Los eventos para la bitácora quedan en el outbox en el orden en que pasaron
    const { rows } = await pool.query("SELECT tipo FROM eventos_pendientes WHERE payload->>'idEnvio' = $1 ORDER BY id", [ENVIO_FLUJO]);
    expect(rows.map((f) => f.tipo)).toEqual(["ASIGNACION_CREADA", "ENVIO_SALIO", "ENVIO_ENTREGADO"]);
  });

  it("si el mismo envío se asigna a dos vehículos a la vez, la segunda petición ve que ya no está pendiente", async () => {
    const h = conToken(tokenDespacho);
    expect((await app.inject({ method: "POST", url: "/envios", headers: h, payload: nuevoEnvio(ENVIO_DOBLE) })).statusCode).toBe(201);
    const [a, b] = await Promise.all(
      ["CHP-1002", "CHP-1006"].map((placa) => app.inject({ method: "POST", url: `/envios/${ENVIO_DOBLE}/asignacion`, headers: h, payload: { placa } })),
    );
    const codigos = [a.statusCode, b.statusCode].sort();
    expect(codigos).toEqual([201, 409]);
    const perdedora = a.statusCode === 409 ? a : b;
    expect(perdedora.json().mensaje).toBe("Solo se pueden asignar envíos pendientes");
  });
});
