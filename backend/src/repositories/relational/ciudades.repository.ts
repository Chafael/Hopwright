import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export type Ciudad = { idCiudad: string; nombre: string; estado: string };

function mapear(fila: any): Ciudad {
  return { idCiudad: fila.id_ciudad, nombre: fila.nombre, estado: fila.estado };
}

export async function listarCiudades(): Promise<Ciudad[]> {
  const { rows } = await pool.query("SELECT id_ciudad, nombre, estado FROM ciudad ORDER BY nombre");
  return rows.map(mapear);
}

export async function buscarCiudad(idCiudad: string, cliente?: PoolClient): Promise<Ciudad | null> {
  const db = cliente ?? pool;
  const { rows } = await db.query("SELECT id_ciudad, nombre, estado FROM ciudad WHERE id_ciudad = $1", [idCiudad]);
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearCiudad(datos: Ciudad, cliente?: PoolClient): Promise<Ciudad> {
  const db = cliente ?? pool;
  const { rows } = await db.query(
    "INSERT INTO ciudad (id_ciudad, nombre, estado) VALUES ($1, $2, $3) RETURNING id_ciudad, nombre, estado",
    [datos.idCiudad, datos.nombre, datos.estado],
  );
  return mapear(rows[0]);
}
