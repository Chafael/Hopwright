import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";

// Cada prueba revisa que PostgreSQL rechace el dato por la regla que se quiere probar (el nombre de la
// restricción o el código de error), no por otra: los ids cumplen el formato E-<dígitos> para que el
// CHECK de id_envio no sea el que falle.
const puedeCorrer = Boolean(process.env.PG_HOST && process.env.PG_DATABASE);

function insertarEnvio(idEnvio: string, idCliente: number, origen: string, destino: string, pesoKg: number) {
  return pool.query(
    `INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ($1, $2, $3, $4, $5, 'Normal', 'Pendiente')`,
    [idEnvio, idCliente, origen, destino, pesoKg],
  );
}

describe.skipIf(!puedeCorrer)("restricciones relacionales", () => {
  it("rechaza peso_kg <= 0", async () => {
    await expect(insertarEnvio("E-99001", 1, "07101", "07078", 0)).rejects.toMatchObject({ code: "23514", constraint: "envio_peso_kg_check" });
  });

  it("rechaza origen igual a destino", async () => {
    await expect(insertarEnvio("E-99002", 1, "07101", "07101", 10)).rejects.toMatchObject({ code: "23514", constraint: "envio_check" });
  });

  it("rechaza id_cliente inexistente", async () => {
    await expect(insertarEnvio("E-99003", 999999, "07101", "07078", 10)).rejects.toMatchObject({ code: "23503", constraint: "envio_id_cliente_fkey" });
  });

  it("rechaza un id de envío que no tiene el formato E-<dígitos>", async () => {
    await expect(insertarEnvio("pedido 1", 1, "07101", "07078", 10)).rejects.toMatchObject({ code: "23514", constraint: "envio_id_envio_check" });
  });
});
