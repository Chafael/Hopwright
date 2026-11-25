import { pool } from "../../db/postgres.js";

export type Usuario = {
  idUsuario: number;
  nombre: string;
  correo: string;
  passwordHash: string;
  rol: "despachador" | "administrador";
  activo: boolean;
};

function mapear(fila: any): Usuario {
  return {
    idUsuario: Number(fila.id_usuario),
    nombre: fila.nombre,
    correo: fila.correo,
    passwordHash: fila.password_hash,
    rol: fila.rol,
    activo: fila.activo,
  };
}

export async function buscarUsuarioPorCorreo(correo: string): Promise<Usuario | null> {
  const { rows } = await pool.query(
    "SELECT id_usuario, nombre, correo, password_hash, rol, activo FROM usuario WHERE correo = $1",
    [correo.toLowerCase()],
  );
  return rows[0] ? mapear(rows[0]) : null;
}

export async function buscarUsuarioPorId(idUsuario: number): Promise<Usuario | null> {
  const { rows } = await pool.query(
    "SELECT id_usuario, nombre, correo, password_hash, rol, activo FROM usuario WHERE id_usuario = $1",
    [idUsuario],
  );
  return rows[0] ? mapear(rows[0]) : null;
}
