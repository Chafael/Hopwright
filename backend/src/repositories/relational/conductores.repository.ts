import { pool } from "../../db/postgres.js";

export type Conductor = { idConductor: number; nombre: string; licencia: string; telefono: string | null; activo: boolean };
export type ConductorEntrada = { nombre: string; licencia: string; telefono?: string | null; activo?: boolean };

function mapear(fila: any): Conductor {
  return { idConductor: fila.id_conductor, nombre: fila.nombre, licencia: fila.licencia, telefono: fila.telefono, activo: fila.activo };
}

export async function listarConductores(): Promise<Conductor[]> {
  const { rows } = await pool.query("SELECT id_conductor, nombre, licencia, telefono, activo FROM conductor ORDER BY id_conductor");
  return rows.map(mapear);
}

export async function buscarConductor(idConductor: number): Promise<Conductor | null> {
  const { rows } = await pool.query("SELECT id_conductor, nombre, licencia, telefono, activo FROM conductor WHERE id_conductor = $1", [idConductor]);
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearConductor(datos: ConductorEntrada): Promise<Conductor> {
  const { rows } = await pool.query(
    "INSERT INTO conductor (nombre, licencia, telefono, activo) VALUES ($1, $2, $3, $4) RETURNING id_conductor, nombre, licencia, telefono, activo",
    [datos.nombre, datos.licencia, datos.telefono ?? null, datos.activo ?? true],
  );
  return mapear(rows[0]);
}

export async function actualizarConductor(idConductor: number, datos: ConductorEntrada): Promise<Conductor | null> {
  const { rows } = await pool.query(
    `UPDATE conductor SET nombre = $2, licencia = $3, telefono = $4, activo = $5
     WHERE id_conductor = $1 RETURNING id_conductor, nombre, licencia, telefono, activo`,
    [idConductor, datos.nombre, datos.licencia, datos.telefono ?? null, datos.activo ?? true],
  );
  return rows[0] ? mapear(rows[0]) : null;
}
