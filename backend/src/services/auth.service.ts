import bcrypt from "bcryptjs";
import { DatosInvalidos, NoAutorizado } from "../errores.js";
import { buscarUsuarioPorCorreo } from "../repositories/relational/usuarios.repository.js";

export async function validarCredenciales(correo: string, password: string) {
  if (!correo?.trim() || !password) throw new DatosInvalidos("Correo y contraseña son obligatorios");
  const usuario = await buscarUsuarioPorCorreo(correo.trim().toLowerCase());
  if (!usuario || !usuario.activo) throw new NoAutorizado("Correo o contraseña incorrectos");
  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) throw new NoAutorizado("Correo o contraseña incorrectos");
  return { idUsuario: usuario.idUsuario, rol: usuario.rol, nombre: usuario.nombre, correo: usuario.correo };
}
