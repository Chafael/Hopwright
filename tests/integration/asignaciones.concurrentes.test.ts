import { describe, expect, it } from "vitest";
import { pool } from "../../backend/src/db/postgres.js";
import { asignarVehiculo } from "../../backend/src/services/envios.service.js";

const puedeCorrer = process.env.PG_HOST && process.env.PG_DATABASE;

describe.skipIf(!puedeCorrer)("asignación concurrente de vehículo", () => {
  it("solo permite una asignación simultánea al mismo vehículo", async () => {
    // Los ids cumplen el formato E-<dígitos> que exige la tabla envio
    const sufijo = Date.now();
    const envioA = `E-9${sufijo}`;
    const envioB = `E-8${sufijo}`;
    const placa = `TST${String(sufijo).slice(-4)}`;
    let idCliente: number | undefined;

    try {
      const { rows } = await pool.query<{ id_cliente: number }>(
        "INSERT INTO cliente (razon_social, rfc) VALUES ($1, $2) RETURNING id_cliente",
        ["Cliente de prueba", `RFC${sufijo}`],
      );
      idCliente = rows[0].id_cliente;
      await pool.query("INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado) VALUES ($1, 'Camión', 5000, 'Disponible')", [placa]);
      await pool.query(
        `INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
         VALUES ($1, $3, '07101', '07078', 1000, 'Normal', 'Pendiente'), ($2, $3, '07101', '07089', 1000, 'Normal', 'Pendiente')`,
        [envioA, envioB, idCliente],
      );

      const resultados = await Promise.allSettled([asignarVehiculo(envioA, placa), asignarVehiculo(envioB, placa)]);
      const exitos = resultados.filter((r) => r.status === "fulfilled");
      const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(exitos).toHaveLength(1);
      expect(fallos).toHaveLength(1);
      // La que pierde recibe 409: el vehículo ya quedó ocupado por la otra
      expect(fallos[0].reason).toMatchObject({ statusCode: 409 });
    } finally {
      // Se limpia aunque la prueba falle, para no dejar datos de prueba en la base
      await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' IN ($1, $2)", [envioA, envioB]);
      await pool.query("DELETE FROM asignacion WHERE id_envio IN ($1, $2)", [envioA, envioB]);
      await pool.query("DELETE FROM envio WHERE id_envio IN ($1, $2)", [envioA, envioB]);
      await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
      if (idCliente !== undefined) await pool.query("DELETE FROM cliente WHERE id_cliente = $1", [idCliente]);
    }
  });
});
