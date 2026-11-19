import pg from "pg";
import { env } from "../config/env.js";

// Un solo pool para toda la aplicación. Los repositorios piden conexiones a este pool.
export const pool = new pg.Pool({
  host: env.postgres.host,
  port: env.postgres.port,
  database: env.postgres.database,
  user: env.postgres.user,
  password: env.postgres.password,
  max: 10,
  connectionTimeoutMillis: 3000,
});

// Ejecuta una función dentro de una transacción. Si la función lanza un error, se hace ROLLBACK.
// Lo usará, por ejemplo, la asignación de vehículo a envío.
export async function enTransaccion<T>(trabajo: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cerrarPostgres(): Promise<void> {
  await pool.end();
}
