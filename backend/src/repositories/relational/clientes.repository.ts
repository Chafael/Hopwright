import { pool } from "../../db/postgres.js";

export type Cliente = { idCliente: number; razonSocial: string; rfc: string; telefono: string | null; correo: string | null };
export type ClienteEntrada = { razonSocial: string; rfc: string; telefono?: string | null; correo?: string | null };

function mapear(fila: any): Cliente {
  return { idCliente: fila.id_cliente, razonSocial: fila.razon_social, rfc: fila.rfc, telefono: fila.telefono, correo: fila.correo };
}

export async function listarClientes(): Promise<Cliente[]> {
  const { rows } = await pool.query("SELECT id_cliente, razon_social, rfc, telefono, correo FROM cliente ORDER BY id_cliente");
  return rows.map(mapear);
}

export async function buscarCliente(idCliente: number): Promise<Cliente | null> {
  const { rows } = await pool.query("SELECT id_cliente, razon_social, rfc, telefono, correo FROM cliente WHERE id_cliente = $1", [idCliente]);
  return rows[0] ? mapear(rows[0]) : null;
}

export async function crearCliente(datos: ClienteEntrada): Promise<Cliente> {
  const { rows } = await pool.query(
    "INSERT INTO cliente (razon_social, rfc, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING id_cliente, razon_social, rfc, telefono, correo",
    [datos.razonSocial, datos.rfc, datos.telefono ?? null, datos.correo ?? null],
  );
  return mapear(rows[0]);
}

export async function actualizarCliente(idCliente: number, datos: ClienteEntrada): Promise<Cliente | null> {
  const { rows } = await pool.query(
    `UPDATE cliente SET razon_social = $2, rfc = $3, telefono = $4, correo = $5
     WHERE id_cliente = $1 RETURNING id_cliente, razon_social, rfc, telefono, correo`,
    [idCliente, datos.razonSocial, datos.rfc, datos.telefono ?? null, datos.correo ?? null],
  );
  return rows[0] ? mapear(rows[0]) : null;
}
