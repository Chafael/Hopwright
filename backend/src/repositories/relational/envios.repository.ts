import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export type Envio = {
  idEnvio: string;
  idCliente: number;
  idCiudadOrigen: string;
  idCiudadDestino: string;
  pesoKg: number;
  prioridad: string;
  estado: string;
  fechaSalida: string | null;
  creadoEn: string;
};

export type EnvioEntrada = {
  idEnvio: string;
  idCliente: number;
  idCiudadOrigen: string;
  idCiudadDestino: string;
  pesoKg: number;
  prioridad: string;
};

function mapear(fila: any): Envio {
  return {
    idEnvio: fila.id_envio,
    idCliente: Number(fila.id_cliente),
    idCiudadOrigen: fila.id_ciudad_origen,
    idCiudadDestino: fila.id_ciudad_destino,
    pesoKg: Number(fila.peso_kg),
    prioridad: fila.prioridad,
    estado: fila.estado,
    fechaSalida: fila.fecha_salida ? new Date(fila.fecha_salida).toISOString() : null,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

export async function listarEnvios(estado?: string): Promise<Envio[]> {
  if (estado) {
    const { rows } = await pool.query(
      `SELECT id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en
       FROM envio WHERE estado = $1 ORDER BY creado_en DESC`,
      [estado],
    );
    return rows.map(mapear);
  }
  const { rows } = await pool.query(
    `SELECT id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en
     FROM envio ORDER BY creado_en DESC`,
  );
  return rows.map(mapear);
}

export async function buscarEnvio(idEnvio: string, cliente?: PoolClient): Promise<Envio | null> {
  const db = cliente ?? pool;
  const { rows } = await db.query(
    `SELECT id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en
     FROM envio WHERE id_envio = $1`,
    [idEnvio],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function buscarEnvioParaActualizar(idEnvio: string, cliente: PoolClient): Promise<Envio | null> {
  const { rows } = await cliente.query(
    `SELECT id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en
     FROM envio WHERE id_envio = $1 FOR UPDATE`,
    [idEnvio],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearEnvio(datos: EnvioEntrada, cliente?: PoolClient): Promise<Envio> {
  const db = cliente ?? pool;
  const { rows } = await db.query(
    `INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente')
     RETURNING id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en`,
    [datos.idEnvio, datos.idCliente, datos.idCiudadOrigen, datos.idCiudadDestino, datos.pesoKg, datos.prioridad],
  );
  return mapear(rows[0]);
}

export async function cambiarEstadoEnvio(idEnvio: string, estado: string, cliente: PoolClient, fechaSalida?: Date): Promise<Envio | null> {
  const { rows } = await cliente.query(
    `UPDATE envio SET estado = $2, fecha_salida = COALESCE($3, fecha_salida)
     WHERE id_envio = $1
     RETURNING id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en`,
    [idEnvio, estado, fechaSalida ?? null],
  );
  return rows[0] ? mapear(rows[0]) : null;
}
