import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";
import { mongoDb } from "../../backend/src/db/mongo.js";
import { construirApp } from "../../backend/src/server.js";
import { procesarEventosPendientes } from "../../backend/src/services/procesadorEventos.service.js";
import { agregarEventoBitacora, buscarBitacora } from "../../backend/src/repositories/document/bitacora.repository.js";

const puedeCorrer = Boolean(process.env.PG_HOST && process.env.PG_DATABASE);

let app: FastifyInstance;

const tokenAdmin = () => app.jwt.sign({ idUsuario: 2, rol: "administrador", correo: "admin@hopwright.local" });
const authAdmin = () => ({ authorization: `Bearer ${tokenAdmin()}` });

async function crearClienteDirecto(rfc: string): Promise<number> {
  const { rows } = await pool.query("INSERT INTO cliente (razon_social, rfc) VALUES ($1, $2) RETURNING id_cliente", ["Cliente prueba envíos", rfc]);
  return Number(rows[0].id_cliente);
}

async function crearEnvioDirecto(idEnvio: string, idCliente: number): Promise<void> {
  await pool.query(
    `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
     VALUES ($1,$2,'07101','07078',1000,'Normal','Pendiente')`,
    [idEnvio, idCliente],
  );
}

async function crearVehiculoDirecto(placa: string): Promise<void> {
  await pool.query("INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado) VALUES ($1,'Camión',5000,'Disponible')", [placa]);
}

async function limpiarEnvio(idEnvio: string, placas: string[], idCliente?: number): Promise<void> {
  await pool.query("DELETE FROM asignacion WHERE id_envio = $1", [idEnvio]);
  await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' = $1", [idEnvio]);
  await (await mongoDb()).collection("manifiestos").deleteOne({ idEnvio });
  await (await mongoDb()).collection("bitacora_envio").deleteOne({ idEnvio });
  await pool.query("DELETE FROM envio WHERE id_envio = $1", [idEnvio]);
  for (const placa of placas) {
    await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'placa' = $1", [placa]);
    await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
  }
  if (idCliente !== undefined) await pool.query("DELETE FROM cliente WHERE id_cliente = $1", [idCliente]);
}

describe.skipIf(!puedeCorrer)("envíos, flota y usuarios", () => {
  beforeAll(async () => {
    app = await construirApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("no revela cuál credencial falló en el login", async () => {
    const contrasena = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { correo: "admin@hopwright.local", password: "incorrecta" },
    });
    const correo = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { correo: "nadie@hopwright.local", password: "hopwright123" },
    });
    expect(contrasena.statusCode).toBe(401);
    expect(correo.statusCode).toBe(401);
    expect(correo.json().mensaje).toBe(contrasena.json().mensaje);
    expect(contrasena.json().error).toBe("No autorizado");
  });

  it("rechaza ids de envío que no cumplen el formato acordado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/envios",
      headers: authAdmin(),
      payload: { idEnvio: "E-ABC", idCliente: 1, idCiudadOrigen: "07101", idCiudadDestino: "07078", pesoKg: 10, prioridad: "Normal" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("cancela un envío asignado, desactiva la asignación y escribe el evento en la bitácora", async () => {
    const sufijo = String(Date.now()).slice(-8);
    const idEnvio = `E-71${sufijo}`;
    const placa = `TCS${String(Date.now()).slice(-5)}`;
    let idCliente: number | undefined;
    try {
      idCliente = await crearClienteDirecto(`RC${sufijo}`);
      await crearEnvioDirecto(idEnvio, idCliente);
      await crearVehiculoDirecto(placa);

      const asignacion = await app.inject({ method: "POST", url: `/envios/${idEnvio}/asignacion`, headers: authAdmin(), payload: { placa } });
      expect(asignacion.statusCode).toBe(201);
      expect(typeof asignacion.json().idAsignacion).toBe("number");

      const cancelacion = await app.inject({ method: "POST", url: `/envios/${idEnvio}/cancelacion`, headers: authAdmin() });
      expect(cancelacion.statusCode).toBe(200);
      expect(cancelacion.json().estado).toBe("Cancelado");

      const { rows: asignaciones } = await pool.query("SELECT activa, fecha_fin FROM asignacion WHERE id_envio = $1", [idEnvio]);
      expect(asignaciones[0].activa).toBe(false);
      expect(asignaciones[0].fecha_fin).not.toBeNull();
      const { rows: vehiculos } = await pool.query("SELECT estado FROM vehiculo WHERE placa = $1", [placa]);
      expect(vehiculos[0].estado).toBe("Disponible");

      const { rows: eventos } = await pool.query(
        "SELECT id, tipo, estado, payload FROM eventos_pendientes WHERE tipo = 'ENVIO_CANCELADO' AND payload->>'idEnvio' = $1",
        [idEnvio],
      );
      expect(eventos).toHaveLength(1);
      expect(Number(eventos[0].id)).toBeGreaterThan(0);
      expect(eventos[0].payload).toMatchObject({ idEnvio });

      await procesarEventosPendientes();
      const { rows: aplicados } = await pool.query("SELECT estado FROM eventos_pendientes WHERE id = $1", [eventos[0].id]);
      expect(aplicados[0].estado).toBe("aplicado");
      const bitacora = (await app.inject({ url: `/envios/${idEnvio}/bitacora` })).json();
      expect(bitacora.eventos.some((e: { tipo: string }) => e.tipo === "ENVIO_CANCELADO")).toBe(true);
    } finally {
      await limpiarEnvio(idEnvio, [placa], idCliente);
    }
  });

  it("rechaza la cancelación de un envío en camino con 409", async () => {
    const sufijo = String(Date.now()).slice(-8);
    const idEnvio = `E-72${sufijo}`;
    const placa = `TCU${String(Date.now()).slice(-5)}`;
    let idCliente: number | undefined;
    try {
      idCliente = await crearClienteDirecto(`RU${sufijo}`);
      await crearEnvioDirecto(idEnvio, idCliente);
      await crearVehiculoDirecto(placa);
      expect((await app.inject({ method: "POST", url: `/envios/${idEnvio}/asignacion`, headers: authAdmin(), payload: { placa } })).statusCode).toBe(201);
      expect((await app.inject({ method: "POST", url: `/envios/${idEnvio}/salida`, headers: authAdmin() })).statusCode).toBe(200);
      const res = await app.inject({ method: "POST", url: `/envios/${idEnvio}/cancelacion`, headers: authAdmin() });
      expect(res.statusCode).toBe(409);
      expect(res.json().mensaje).toMatch(/cancelar envíos pendientes o asignados/);
    } finally {
      await limpiarEnvio(idEnvio, [placa], idCliente);
    }
  });

  it("borra clientes y conductores con 204, 404 y 409 según sus relaciones", async () => {
    const sufijo = String(Date.now()).slice(-8);
    const clienteLibre = await app.inject({
      method: "POST",
      url: "/clientes",
      headers: authAdmin(),
      payload: { razonSocial: "Cliente libre", rfc: `CL${sufijo}` },
    });
    expect(clienteLibre.statusCode).toBe(201);
    const idLibre = clienteLibre.json().idCliente;
    expect((await app.inject({ method: "DELETE", url: `/clientes/${idLibre}`, headers: authAdmin() })).statusCode).toBe(204);
    expect((await app.inject({ url: `/clientes/${idLibre}` })).statusCode).toBe(404);

    const clienteOcupado = await app.inject({
      method: "POST",
      url: "/clientes",
      headers: authAdmin(),
      payload: { razonSocial: "Cliente con envíos", rfc: `CO${sufijo}` },
    });
    const idOcupado = clienteOcupado.json().idCliente;
    const idEnvio = `E-74${sufijo}`;
    await crearEnvioDirecto(idEnvio, idOcupado);
    const ocupado = await app.inject({ method: "DELETE", url: `/clientes/${idOcupado}`, headers: authAdmin() });
    expect(ocupado.statusCode).toBe(409);
    expect(ocupado.json().mensaje).toBe("Tiene envíos asociados");
    await limpiarEnvio(idEnvio, [], idOcupado);

    expect((await app.inject({ method: "DELETE", url: "/clientes/999999", headers: authAdmin() })).statusCode).toBe(404);

    const conductorLibre = await app.inject({
      method: "POST",
      url: "/conductores",
      headers: authAdmin(),
      payload: { nombre: "Conductor libre", licencia: `DL${sufijo}` },
    });
    expect(conductorLibre.statusCode).toBe(201);
    const idConductorLibre = conductorLibre.json().idConductor;
    expect((await app.inject({ method: "DELETE", url: `/conductores/${idConductorLibre}`, headers: authAdmin() })).statusCode).toBe(204);
    expect((await app.inject({ url: `/conductores/${idConductorLibre}` })).statusCode).toBe(404);

    const conductorOcupado = await app.inject({
      method: "POST",
      url: "/conductores",
      headers: authAdmin(),
      payload: { nombre: "Conductor con vehículo", licencia: `DO${sufijo}` },
    });
    const idConductorOcupado = conductorOcupado.json().idConductor;
    const placa = `TCD${String(Date.now()).slice(-4)}`;
    const vehiculo = await app.inject({
      method: "POST",
      url: "/vehiculos",
      headers: authAdmin(),
      payload: { placa, tipo: "Camión", capacidadKg: 5000, estado: "Disponible", idConductor: idConductorOcupado },
    });
    expect(vehiculo.statusCode).toBe(201);
    const ocupadoConductor = await app.inject({ method: "DELETE", url: `/conductores/${idConductorOcupado}`, headers: authAdmin() });
    expect(ocupadoConductor.statusCode).toBe(409);
    expect(ocupadoConductor.json().mensaje).toBe("Tiene vehículos asociados");
    await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'placa' = $1", [placa]);
    await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
    await pool.query("DELETE FROM conductor WHERE id_conductor = $1", [idConductorOcupado]);

    expect((await app.inject({ method: "DELETE", url: "/conductores/999999", headers: authAdmin() })).statusCode).toBe(404);
  });

  it("crea y valida manifiestos, con 400 claro cuando MongoDB rechaza el documento", async () => {
    const sufijo = String(Date.now()).slice(-8);
    const idEnvio = `E-75${sufijo}`;
    let idCliente: number | undefined;
    try {
      idCliente = await crearClienteDirecto(`RM${sufijo}`);
      await crearEnvioDirecto(idEnvio, idCliente);
      const valido = await app.inject({
        method: "POST",
        url: `/envios/${idEnvio}/manifiesto`,
        headers: authAdmin(),
        payload: {
          tipoCarga: "general",
          articulos: [{ descripcion: "Caja", cantidad: 2, pesoKg: 15 }],
          restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: 240 },
        },
      });
      expect(valido.statusCode).toBe(201);
      expect((await app.inject({ url: `/envios/${idEnvio}/manifiesto` })).statusCode).toBe(200);
      await (await mongoDb()).collection("manifiestos").deleteOne({ idEnvio });

      const invalido = await app.inject({
        method: "POST",
        url: `/envios/${idEnvio}/manifiesto`,
        headers: authAdmin(),
        payload: {
          tipoCarga: "peligrosa",
          articulos: [{ descripcion: "Químico", cantidad: 1, pesoKg: 0.005 }],
          claseUN: 3,
          numeroONU: "UN1993",
          hojaSeguridad: "hs",
          telefonoEmergencia: "12345",
          restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: 240 },
        },
      });
      expect(invalido.statusCode).toBe(400);
      expect(invalido.json().mensaje).toMatch(/manifiesto|esquema/i);
    } finally {
      await limpiarEnvio(idEnvio, [], idCliente);
    }
  });

  it("ordena los eventos de la bitácora por fecha y no duplica uno repetido", async () => {
    const idEnvio = `E-76${String(Date.now()).slice(-8)}`;
    try {
      await agregarEventoBitacora(idEnvio, { tipo: "ENVIO_SALIO", fecha: new Date("2026-01-02T10:00:00Z"), detalle: {} });
      await agregarEventoBitacora(idEnvio, { tipo: "ASIGNACION_CREADA", fecha: new Date("2026-01-01T10:00:00Z"), detalle: {} });
      await agregarEventoBitacora(idEnvio, { tipo: "ASIGNACION_CREADA", fecha: new Date("2026-01-01T10:00:00Z"), detalle: {} });
      const bitacora = await buscarBitacora(idEnvio);
      expect(bitacora?.eventos).toHaveLength(2);
      expect(bitacora?.eventos.map((e) => e.tipo)).toEqual(["ASIGNACION_CREADA", "ENVIO_SALIO"]);
    } finally {
      await (await mongoDb()).collection("bitacora_envio").deleteOne({ idEnvio });
    }
  });
});
