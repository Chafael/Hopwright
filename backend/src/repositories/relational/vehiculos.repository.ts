import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export type Vehiculo = { placa: string; tipo: string; capacidadKg: number; estado: string; idConductor: number | null };
export type VehiculoEntrada = { placa: string; tipo: string; capacidadKg: number; estado: string; idConductor?: number | null };

function mapear(fila: any): Vehiculo {
  return {
    placa: fila.placa,
    tipo: fila.tipo,
    capacidadKg: Number(fila.capacidad_kg),
    estado: fila.estado,
    idConductor: fila.id_conductor == null ? null : Number(fila.id_conductor),
  };
}

export async function listarVehiculos(): Promise<Vehiculo[]> {
  const { rows } = await pool.query(
    "SELECT placa, tipo, capacidad_kg, estado, id_conductor FROM vehiculo ORDER BY placa",
  );
  return rows.map(mapear);
}

export async function buscarVehiculo(placa: string, cliente?: PoolClient): Promise<Vehiculo | null> {
  const db = cliente ?? pool;
  const { rows } = await db.query(
    "SELECT placa, tipo, capacidad_kg, estado, id_conductor FROM vehiculo WHERE placa = $1",
    [placa],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function buscarVehiculoParaActualizar(placa: string, cliente: PoolClient): Promise<Vehiculo | null> {
  const { rows } = await cliente.query(
    "SELECT placa, tipo, capacidad_kg, estado, id_conductor FROM vehiculo WHERE placa = $1 FOR UPDATE",
    [placa],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearVehiculo(datos: VehiculoEntrada, cliente?: PoolClient): Promise<Vehiculo> {
  const db = cliente ?? pool;
  const { rows } = await db.query(
    `INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado, id_conductor)
     VALUES ($1, $2, $3, $4, $5) RETURNING placa, tipo, capacidad_kg, estado, id_conductor`,
    [datos.placa, datos.tipo, datos.capacidadKg, datos.estado, datos.idConductor ?? null],
  );
  return mapear(rows[0]);
}

export async function actualizarVehiculo(placa: string, datos: Partial<VehiculoEntrada>, cliente?: PoolClient): Promise<Vehiculo | null> {
  const actual = await buscarVehiculo(placa, cliente);
  if (!actual) return null;
  const merged = {
    tipo: datos.tipo ?? actual.tipo,
    capacidadKg: datos.capacidadKg ?? actual.capacidadKg,
    estado: datos.estado ?? actual.estado,
    idConductor: datos.idConductor === undefined ? actual.idConductor : datos.idConductor,
  };
  const db = cliente ?? pool;
  const { rows } = await db.query(
    `UPDATE vehiculo SET tipo = $2, capacidad_kg = $3, estado = $4, id_conductor = $5
     WHERE placa = $1 RETURNING placa, tipo, capacidad_kg, estado, id_conductor`,
    [placa, merged.tipo, merged.capacidadKg, merged.estado, merged.idConductor],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function listarVehiculosDisponiblesConCapacidad(pesoKg: number): Promise<Vehiculo[]> {
  const { rows } = await pool.query(
    `SELECT placa, tipo, capacidad_kg, estado, id_conductor FROM vehiculo
     WHERE estado = 'Disponible' AND capacidad_kg >= $1 ORDER BY capacidad_kg, placa`,
    [pesoKg],
  );
  return rows.map(mapear);
}
