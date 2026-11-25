import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";

const puedeCorrer = Boolean(process.env.PG_HOST && process.env.PG_DATABASE);
const sufijo = Date.now();
const ids = [`E-9${sufijo}1`, `E-9${sufijo}2`, `E-9${sufijo}3`];

describe.skipIf(!puedeCorrer)("restricciones relacionales", () => {
  it("rechaza peso_kg <= 0", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ($1,1,'07101','07078',0,'Normal','Pendiente')`,
        [ids[0]],
      ),
    ).rejects.toBeTruthy();
  });

  it("rechaza origen igual a destino", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ($1,1,'07101','07101',10,'Normal','Pendiente')`,
        [ids[1]],
      ),
    ).rejects.toBeTruthy();
  });

  it("rechaza id_cliente inexistente", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ($1,999999,'07101','07078',10,'Normal','Pendiente')`,
        [ids[2]],
      ),
    ).rejects.toBeTruthy();
  });

  it("rechaza id_envio sin el formato acordado", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ('E-BAD',1,'07101','07078',10,'Normal','Pendiente')`,
      ),
    ).rejects.toBeTruthy();
  });
});
