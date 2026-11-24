import { describe, expect, it } from "vitest";
import { enTransaccion, pool } from "../../backend/src/db/postgres.js";
import { asignarVehiculo } from "../../backend/src/services/envios.service.js";

const puedeCorrer = process.env.PG_HOST && process.env.PG_DATABASE;

describe.skipIf(!puedeCorrer)("asignación concurrente de vehículo", () => {
  it("solo permite una asignación simultánea al mismo vehículo", async () => {
    const sufijo = Date.now();
    const envioA = `E-T${sufijo}A`;
    const envioB = `E-T${sufijo}B`;
    const placa = `TST${String(sufijo).slice(-4)}`;
    await pool.query("INSERT INTO cliente (razon_social, rfc) VALUES ($1, $2)", ["Cliente Test", `RFC${sufijo}`]).catch(() => undefined);
    const { rows: cli } = await pool.query("SELECT id_cliente FROM cliente ORDER BY id_cliente DESC LIMIT 1");
    const idCliente = cli[0].id_cliente;
    await pool.query("INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado) VALUES ($1,'Camión',5000,'Disponible')", [placa]);
    await pool.query(
      `INSERT INTO envio (id_envio,id_cliente,id_ciudad_origen,id_ciudad_destino,peso_kg,prioridad,estado)
       VALUES ($1,$4,'07101','07078',1000,'Normal','Pendiente'), ($2,$4,'07101','07089',1000,'Normal','Pendiente')`,
      [envioA, envioB, sufijo, idCliente],
    );

    const [a, b] = await Promise.allSettled([asignarVehiculo(envioA, placa), asignarVehiculo(envioB, placa)]);
    const exitos = [a, b].filter((r) => r.status === "fulfilled").length;
    const fallos = [a, b].filter((r) => r.status === "rejected").length;
    expect(exitos).toBe(1);
    expect(fallos).toBe(1);

    await pool.query("DELETE FROM asignacion WHERE id_envio IN ($1,$2)", [envioA, envioB]);
    await pool.query("DELETE FROM envio WHERE id_envio IN ($1,$2)", [envioA, envioB]);
    await pool.query("DELETE FROM vehiculo WHERE placa = $1", [placa]);
  });
});
