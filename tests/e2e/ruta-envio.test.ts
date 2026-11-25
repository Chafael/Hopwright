// Flujo integrado de punta a punta: la ruta de un envío usa las tres bases.
// PostgreSQL da el envío y los vehículos que aguantan el peso, MongoDB el manifiesto con sus restricciones
// y Neo4j la ruta y la ubicación de los vehículos. Al final el camión entregado queda en la ciudad de destino.
// Requiere los contenedores arriba: docker compose up -d && docker compose up neo4j-init
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { pool } from "../../backend/src/db/postgres.js";
import { mongoDb } from "../../backend/src/db/mongo.js";
import { escribir } from "../../backend/src/db/neo4j.js";
import { moverVehiculo } from "../../backend/src/repositories/graph/ubicacion.repository.js";
import { procesarEventosPendientes } from "../../backend/src/services/procesadorEventos.service.js";

const TUXTLA = "07101";
const COMITAN = "07019";
const sufijo = String(Date.now()).slice(-6);
const ENVIO = `E-8${sufijo}`;
const ENVIO_SIN_MANIFIESTO = `E-9${sufijo}`;
const PLACA = `PRU-${sufijo}`;

let app: FastifyInstance;
const auth = () => ({ authorization: `Bearer ${app.jwt.sign({ idUsuario: 2, rol: "administrador", correo: "admin@hopwright.local" })}` });
const ruta = (idEnvio: string, criterio = "tiempo") => app.inject({ url: `/envios/${idEnvio}/ruta?criterio=${criterio}` });

beforeAll(async () => {
  app = await construirApp();
  // Camión de prueba: en PostgreSQL con sus datos y en Neo4j solo la placa y su ubicación (Tuxtla)
  await pool.query("INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado) VALUES ($1, 'Camión', 9000, 'Disponible')", [PLACA]);
  await escribir("MERGE (:Vehiculo {placa: $placa})", { placa: PLACA });
  await moverVehiculo(PLACA, TUXTLA);
});

afterAll(async () => {
  const ids = [ENVIO, ENVIO_SIN_MANIFIESTO];
  await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' = ANY($1) OR payload->>'placa' = $2", [ids, PLACA]);
  await pool.query("DELETE FROM asignacion WHERE id_envio = ANY($1)", [ids]);
  await pool.query("DELETE FROM envio WHERE id_envio = ANY($1)", [ids]);
  await pool.query("DELETE FROM vehiculo WHERE placa = $1", [PLACA]);
  const db = await mongoDb();
  await db.collection("manifiestos").deleteMany({ idEnvio: { $in: ids } });
  await db.collection("bitacora_envio").deleteMany({ idEnvio: { $in: ids } });
  await escribir("MATCH (v:Vehiculo {placa: $placa}) DETACH DELETE v", { placa: PLACA });
  await app.close();
});

describe("ruta de un envío con los datos de ejemplo", () => {
  it("carga peligrosa (E-103): la ruta evita terracería y el vehículo sugerido aguanta el peso", async () => {
    const res = await ruta("E-103");
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.tipoCarga).toBe("peligrosa");
    expect(r.restricciones.evitarTerraceria).toBe(true);
    expect(r.encontrada).toBe(true);
    expect(r.ruta[0].idPunto).toBe(r.origen);
    expect(r.ruta.at(-1).idPunto).toBe(r.destino);
    expect(r.tramos.every((t: { tipoVia: string }) => t.tipoVia !== "Terracería")).toBe(true);
    // E-103 pesa 3000 kg: el sugerido debe ser uno de los candidatos de PostgreSQL y nunca el tren
    expect(r.candidatos).not.toContain("CHP-1005"); // aguanta 3500 kg pero está en ruta
    expect(r.vehiculoSugerido).not.toBeNull();
    expect(r.candidatos).toContain(r.vehiculoSugerido.placa);
    expect(r.vehiculoSugerido.placa).not.toBe("TREN-01");
  });

  it("da la misma ruta que GET /rutas con las restricciones del manifiesto", async () => {
    const integrada = (await ruta("E-103")).json();
    const directa = (await app.inject({ url: `/rutas?origen=${integrada.origen}&destino=${integrada.destino}&criterio=tiempo&evitarTerraceria=true` })).json();
    expect(integrada.minutos).toBe(directa.minutos);
    expect(integrada.ruta.map((p: { idPunto: string }) => p.idPunto)).toEqual(directa.ruta.map((p: { idPunto: string }) => p.idPunto));
  });

  it("carga refrigerada (E-102): respeta el tiempo máximo del manifiesto", async () => {
    const r = (await ruta("E-102")).json();
    expect(r.tipoCarga).toBe("refrigerada");
    expect(r.restricciones.tiempoMaxMin).toBe(480);
    // San Cristóbal a Tapachula: la más rápida tarda 384 minutos, dentro del máximo
    expect(r.encontrada).toBe(true);
    expect(r.minutos).toBe(384);
  });

  it("un envío entregado se puede consultar, con aviso", async () => {
    const r = (await ruta("E-105")).json();
    expect(r.avisos.join(" ")).toMatch(/entregado/);
  });

  it("un envío que no existe responde 404 y un criterio inválido 400", async () => {
    expect((await ruta("E-999999")).statusCode).toBe(404);
    expect((await ruta("E-103", "barata")).statusCode).toBe(400);
  });
});

describe("flujo completo de un envío nuevo", () => {
  it("sin manifiesto calcula la ruta sin restricciones y lo avisa", async () => {
    const alta = await app.inject({
      method: "POST", url: "/envios", headers: auth(),
      payload: { idEnvio: ENVIO_SIN_MANIFIESTO, idCliente: 1, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 500, prioridad: "Normal" },
    });
    expect(alta.statusCode).toBe(201);
    const r = (await ruta(ENVIO_SIN_MANIFIESTO)).json();
    expect(r.tipoCarga).toBeNull();
    expect(r.restricciones).toEqual({ evitarTerraceria: false, tiempoMaxMin: null });
    expect(r.avisos).toContain("El envío no tiene manifiesto");
    expect(r.fuentes.mongodb).toBe("sin manifiesto");
  });

  it("alta, manifiesto, ruta, asignación, salida y entrega; el camión queda en el destino", async () => {
    const alta = await app.inject({
      method: "POST", url: "/envios", headers: auth(),
      payload: { idEnvio: ENVIO, idCliente: 1, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 8500, prioridad: "Urgente" },
    });
    expect(alta.statusCode).toBe(201);

    const manifiesto = await app.inject({
      method: "POST", url: `/envios/${ENVIO}/manifiesto`, headers: auth(),
      payload: {
        tipoCarga: "peligrosa",
        articulos: [{ descripcion: "Solvente", cantidad: 40, pesoKg: 200 }, { descripcion: "Pintura", cantidad: 10, pesoKg: 50 }],
        claseUN: 3, numeroONU: "UN1263", hojaSeguridad: "https://docs.hopwright.local/hs-prueba.pdf", telefonoEmergencia: "9615550000",
      },
    });
    expect(manifiesto.statusCode).toBe(201);

    // 8500 kg: solo aguantan los tráileres y el camión de prueba (9000 kg). El de prueba está en el origen.
    const r = (await ruta(ENVIO)).json();
    expect(r.encontrada).toBe(true);
    expect(r.restricciones.evitarTerraceria).toBe(true);
    expect(r.candidatos).toContain(PLACA);
    expect(r.candidatos).not.toContain("CHP-1006"); // 8000 kg no alcanza
    expect(r.vehiculoSugerido).toEqual({ placa: expect.any(String), minutosAlOrigen: 0 });

    const asignar = await app.inject({ method: "POST", url: `/envios/${ENVIO}/asignacion`, headers: auth(), payload: { placa: PLACA } });
    expect(asignar.statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/envios/${ENVIO}/salida`, headers: auth() })).statusCode).toBe(200);
    const entrega = await app.inject({ method: "POST", url: `/envios/${ENVIO}/entrega`, headers: auth() });
    expect(entrega.statusCode).toBe(200);
    expect(entrega.json().estado).toBe("Entregado");

    // El procesador de eventos pasa la entrega a la bitácora (MongoDB) y mueve el camión (Neo4j)
    await procesarEventosPendientes();
    const ubicacion = await app.inject({ url: `/vehiculos/${PLACA}/ubicacion` });
    expect(ubicacion.json().punto.idPunto).toBe(COMITAN);
    const bitacora = (await app.inject({ url: `/envios/${ENVIO}/bitacora` })).json();
    expect(bitacora.eventos.map((e: { tipo: string }) => e.tipo)).toEqual(["ASIGNACION_CREADA", "ENVIO_SALIO", "ENVIO_ENTREGADO"]);
  });
});
