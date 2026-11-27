// Pruebas de los reportes de incidente (MongoDB) y su réplica en la red (Neo4j).
// Usan los reportes de ejemplo de database/document/data y la red de database/graph/data.
// Requiere los contenedores arriba: docker compose up -d
// Los incidentes que crean estas pruebas se borran al final de las dos bases.
import type { FastifyInstance } from "fastify";
import { construirApp } from "../../backend/src/server.js";
import { mongoDb } from "../../backend/src/db/mongo.js";
import { escribir } from "../../backend/src/db/neo4j.js";
import { leerIncidenteEnGrafo } from "../../backend/src/repositories/graph/incidentes.repository.js";
import { conAdmin } from "../token.js";

const TUXTLA = "07101";
const SAN_CRISTOBAL = "07078";

let app: FastifyInstance;
const creados: string[] = [];

beforeAll(async () => {
  app = await construirApp();
});

afterAll(async () => {
  if (creados.length > 0) {
    await (await mongoDb()).collection("reportes_incidente").deleteMany({ idIncidente: { $in: creados } });
    await escribir(`MATCH (i:Incidente) WHERE i.idIncidente IN $ids DETACH DELETE i`, { ids: creados });
  }
  await app.close();
});

const bloqueoAlta = {
  tipo: "Bloqueo",
  idPunto: "INT-CHC",
  gravedad: "Alta",
  descripcion: "Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos",
  detalle: { causa: "Manifestación", carrilesCerrados: 2, pasoAlternado: false },
  evidencias: [{ tipo: "Testimonio", texto: "No dejan pasar ni a los de carga", autor: "Conductor de CHP-1004" }],
  reportadoPor: "Despacho Tuxtla",
};

const reportar = async (cuerpo: object) => {
  const res = await app.inject({ method: "POST", url: "/incidentes", headers: conAdmin(app), payload: cuerpo });
  const id = res.json().incidente?.idIncidente;
  if (id) creados.push(id);
  return res;
};

const minutosTuxtlaSanCristobal = async () => (await app.inject({ url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}` })).json().minutos;

describe("consultar incidentes", () => {
  it("lista los reportes de ejemplo", async () => {
    const res = await app.inject({ url: "/incidentes" });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((i: { idIncidente: string }) => i.idIncidente);
    expect(ids).toEqual(expect.arrayContaining(["INC-0001", "INC-0002"]));
  });

  it("filtra por activos", async () => {
    const activos = (await app.inject({ url: "/incidentes?activo=true" })).json();
    expect(activos.every((i: { activo: boolean }) => i.activo)).toBe(true);
    expect(activos.map((i: { idIncidente: string }) => i.idIncidente)).not.toContain("INC-0002");
  });

  it("regresa el reporte completo con su detalle y evidencias", async () => {
    const r = (await app.inject({ url: "/incidentes/INC-0001" })).json();
    expect(r.tipo).toBe("Obra");
    expect(r.detalle.dependencia).toBeTruthy();
    expect(r.evidencias.length).toBeGreaterThan(0);
  });

  it("404 si no existe y 400 si el id está mal escrito", async () => {
    expect((await app.inject({ url: "/incidentes/INC-9999" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/incidentes/incidente1" })).statusCode).toBe(400);
  });
});

describe("reportar y cerrar un incidente", () => {
  it("un bloqueo de gravedad Alta queda en las dos bases y cambia la ruta", async () => {
    expect(await minutosTuxtlaSanCristobal()).toBe(73);

    const res = await reportar(bloqueoAlta);
    expect(res.statusCode).toBe(201);
    const { incidente } = res.json();
    expect(incidente.idIncidente).toMatch(/^INC-\d{4,}$/);
    expect(incidente.tipoPunto).toBe("Interseccion");
    expect(incidente.sincronizado).toBe(true);

    const enGrafo = await leerIncidenteEnGrafo(incidente.idIncidente);
    expect(enGrafo).toEqual({ idIncidente: incidente.idIncidente, gravedad: "Alta", activo: true, idPunto: "INT-CHC" });

    // Con la caseta bloqueada, la ruta rodea por Chiapa de Corzo, Acala y Chiapilla
    expect(await minutosTuxtlaSanCristobal()).toBe(176);

    const cierre = await app.inject({ method: "PATCH", url: `/incidentes/${incidente.idIncidente}/cerrar`, headers: conAdmin(app), payload: { motivoCierre: "Se retiraron los manifestantes" } });
    expect(cierre.statusCode).toBe(200);
    expect(cierre.json().incidente.activo).toBe(false);
    expect(cierre.json().incidente.fechaFin).toBeTruthy();
    expect((await leerIncidenteEnGrafo(incidente.idIncidente))?.activo).toBe(false);
    expect(await minutosTuxtlaSanCristobal()).toBe(73);

    // Cerrarlo otra vez choca con su estado
    expect((await app.inject({ method: "PATCH", url: `/incidentes/${incidente.idIncidente}/cerrar`, headers: conAdmin(app) })).statusCode).toBe(409);
  });

  it("dos reportes seguidos reciben números distintos", async () => {
    const a = await reportar({ ...bloqueoAlta, gravedad: "Baja" });
    const b = await reportar({ ...bloqueoAlta, gravedad: "Baja" });
    expect(a.json().incidente.idIncidente).not.toBe(b.json().incidente.idIncidente);
  });

  it("agrega una evidencia al reporte", async () => {
    const { incidente } = (await reportar({ ...bloqueoAlta, gravedad: "Baja" })).json();
    const res = await app.inject({
      method: "POST",
      url: `/incidentes/${incidente.idIncidente}/evidencias`,
      headers: conAdmin(app),
      payload: { tipo: "Foto", url: "https://evidencias.hopwright.local/prueba.jpg", autor: "Prueba" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().evidencias).toHaveLength(2);
  });
});

describe("reportes inválidos", () => {
  it("400 si el detalle no corresponde al tipo", async () => {
    const res = await reportar({ ...bloqueoAlta, tipo: "Obra" });
    expect(res.statusCode).toBe(400);
    expect(res.json().detalles).toEqual(expect.arrayContaining([expect.stringMatching(/dependencia/)]));
  });

  it("400 si el punto es una estación o tiene un formato inválido", async () => {
    expect((await reportar({ ...bloqueoAlta, idPunto: "EST-TAP" })).statusCode).toBe(400);
    expect((await reportar({ ...bloqueoAlta, idPunto: "tuxtla" })).statusCode).toBe(400);
  });

  it("404 si el punto no existe en la red", async () => {
    expect((await reportar({ ...bloqueoAlta, idPunto: "INT-NOEXISTE" })).statusCode).toBe(404);
  });

  it("400 si falta un campo, la gravedad no existe o una foto no trae url", async () => {
    const { descripcion: _, ...sinDescripcion } = bloqueoAlta;
    expect((await reportar(sinDescripcion)).statusCode).toBe(400);
    expect((await reportar({ ...bloqueoAlta, gravedad: "Extrema" })).statusCode).toBe(400);
    expect((await reportar({ ...bloqueoAlta, evidencias: [{ tipo: "Foto" }] })).statusCode).toBe(400);
  });

  it("el validador de MongoDB rechaza un documento inválido aunque no pase por la API", async () => {
    const coleccion = (await mongoDb()).collection("reportes_incidente");
    await expect(
      coleccion.insertOne({
        idIncidente: "INC-99999",
        tipo: "Derrumbe",
        idPunto: "INT-CRU",
        tipoPunto: "Interseccion",
        gravedad: "Alta",
        descripcion: "Le falta el detalle del derrumbe",
        fechaInicio: new Date(),
        detalle: {},
        evidencias: [],
        activo: true,
        sincronizado: false,
        reportadoPor: "Prueba",
        creadoEn: new Date(),
      }),
    ).rejects.toMatchObject({ code: 121 });
  });
});
