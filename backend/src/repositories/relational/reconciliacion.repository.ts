import { pool } from "../../db/postgres.js";

// Lecturas de PostgreSQL que necesita la reconciliación. Las tablas ciudad y vehiculo son del esquema relacional
// (ver docs/plan-de-trabajo.md, sección 7).
// Si la tabla todavía no existe (código 42P01) se regresa null para que la reconciliación salte esa parte con un aviso.

async function consultarSiExiste<T extends object>(sql: string): Promise<T[] | null> {
  try {
    const { rows } = await pool.query<T>(sql);
    return rows;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
}

export async function ciudadesEnPostgres(): Promise<{ idCiudad: string; nombre: string }[] | null> {
  return consultarSiExiste(`SELECT id_ciudad AS "idCiudad", nombre FROM ciudad`);
}

export async function placasEnPostgres(): Promise<string[] | null> {
  const filas = await consultarSiExiste<{ placa: string }>(`SELECT placa FROM vehiculo`);
  return filas?.map((f) => f.placa) ?? null;
}
