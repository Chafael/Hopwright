import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export type Asignacion = {
  idAsignacion: number;
  idEnvio: string;
  placa: string;
  fechaAsignacion: string;
  fechaFin: string | null;
  activa: boolean;
};

function mapear(fila: any): Asignacion {
  return {
    idAsignacion: Number(fila.id_asignacion),
    idEnvio: fila.id_envio,
    placa: fila.placa,
    fechaAsignacion: new Date(fila.fecha_asignacion).toISOString(),
    fechaFin: fila.fecha_fin ? new Date(fila.fecha_fin).toISOString() : null,
    activa: fila.activa,
  };
}

export async function buscarAsignacionActivaPorEnvio(idEnvio: string, cliente: PoolClient): Promise<Asignacion | null> {
  const { rows } = await cliente.query(
    "SELECT id_asignacion, id_envio, placa, fecha_asignacion, fecha_fin, activa FROM asignacion WHERE id_envio = $1 AND activa FOR UPDATE",
    [idEnvio],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function buscarAsignacionActivaPorPlaca(placa: string, cliente: PoolClient): Promise<Asignacion | null> {
  const { rows } = await cliente.query(
    "SELECT id_asignacion, id_envio, placa, fecha_asignacion, fecha_fin, activa FROM asignacion WHERE placa = $1 AND activa FOR UPDATE",
    [placa],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearAsignacion(idEnvio: string, placa: string, cliente: PoolClient): Promise<Asignacion> {
  const { rows } = await cliente.query(
    `INSERT INTO asignacion (id_envio, placa) VALUES ($1, $2)
     RETURNING id_asignacion, id_envio, placa, fecha_asignacion, fecha_fin, activa`,
    [idEnvio, placa],
  );
  return mapear(rows[0]);
}

export async function desactivarAsignacionActiva(idEnvio: string, cliente: PoolClient): Promise<Asignacion | null> {
  const { rows } = await cliente.query(
    `UPDATE asignacion SET activa = FALSE, fecha_fin = NOW()
     WHERE id_envio = $1 AND activa
     RETURNING id_asignacion, id_envio, placa, fecha_asignacion, fecha_fin, activa`,
    [idEnvio],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function listarAsignacionesPorVehiculo(placa: string): Promise<Asignacion[]> {
  const { rows } = await pool.query(
    `SELECT id_asignacion, id_envio, placa, fecha_asignacion, fecha_fin, activa
     FROM asignacion WHERE placa = $1 ORDER BY fecha_asignacion DESC`,
    [placa],
  );
  return rows.map(mapear);
}
