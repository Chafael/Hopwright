import { pool } from "../../db/postgres.js";

// Consulta mínima para saber si PostgreSQL responde
export async function pingPostgres(): Promise<void> {
  await pool.query("SELECT 1");
}
