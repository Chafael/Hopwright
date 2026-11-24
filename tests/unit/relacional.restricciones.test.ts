import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";

const puedeCorrer = Boolean(process.env.PG_HOST && process.env.PG_DATABASE);

describe.skipIf(!puedeCorrer)("restricciones relacionales", () => {
  it("rechaza peso_kg <= 0", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ('E-BAD1',1,'07101','07078',0,'Normal','Pendiente')`,
      ),
    ).rejects.toBeTruthy();
  });

  it("rechaza origen igual a destino", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ('E-BAD2',1,'07101','07101',10,'Normal','Pendiente')`,
      ),
    ).rejects.toBeTruthy();
  });

  it("rechaza id_cliente inexistente", async () => {
    await expect(
      pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ('E-BAD3',999999,'07101','07078',10,'Normal','Pendiente')`,
      ),
    ).rejects.toBeTruthy();
  });
});
