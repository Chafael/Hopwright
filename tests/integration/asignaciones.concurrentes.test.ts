import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";
import { asignarVehiculo } from "../../backend/src/services/envios.service.js";

const puedeCorrer = Boolean(process.env.PG_HOST && process.env.PG_DATABASE);

describe.skipIf(!puedeCorrer)("asignación concurrente de vehículo", () => {
  it("solo permite una asignación simultánea al mismo vehículo", async () => {
    const sufijo = Date.now();
    const envioA = `E-9${sufijo}`;
    const envioB = `E-8${sufijo}`;
    const placa = `TST${String(sufijo).slice(-6)}`;
    let idCliente: number | undefined;

    try {
      const inserted = await pool.query(
        "INSERT INTO cliente (razon_social, rfc) VALUES ($1, $2) RETURNING id_cliente",
        ["Cliente Test Concurrencia", `RFC${sufijo}`],
      );
      idCliente = Number(inserted.rows[0].id_cliente);
      await pool.query("INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado) VALUES ($1,'Camión',5000,'Disponible')", [placa]);
      await pool.query(
        `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
         VALUES ($1,$3,'07101','07078',1000,'Normal','Pendiente'), ($2,$3,'07101','07089',1000,'Normal','Pendiente')`,
        [envioA, envioB, idCliente],
      );

      const [a, b] = await Promise.allSettled([asignarVehiculo(envioA, placa), asignarVehiculo(envioB, placa)]);
      const exitos = [a, b].filter((r) => r.status === "fulfilled").length;
      const fallos = [a, b].filter((r) => r.status === "rejected");
      expect(exitos).toBe(1);
      expect(fallos).toHaveLength(1);
      expect((fallos[0].reason as { statusCode?: number }).statusCode).toBe(409);
    } finally {
      await pool.query("DELETE FROM asignacion WHERE id_envio IN ($1,$2)", [envioA, envioB]);
      await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' IN ($1,$2)", [envioA, envioB]);
      await pool.query("DELETE FROM envio WHERE id_envio IN ($1,$2)", [envioA, envioB]);
      await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
      if (idCliente !== undefined) await pool.query("DELETE FROM cliente WHERE id_cliente = $1", [idCliente]);
    }
  });
});
