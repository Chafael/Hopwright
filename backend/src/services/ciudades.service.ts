import { Conflicto, DatosInvalidos } from "../errores.js";
import { enTransaccion } from "../db/postgres.js";
import { buscarCiudad, crearCiudad, listarCiudades, type Ciudad } from "../repositories/relational/ciudades.repository.js";
import { encolarEvento } from "../repositories/relational/eventos.repository.js";

export async function obtenerCiudades() {
  return listarCiudades();
}

export async function registrarCiudad(datos: Ciudad) {
  if (!/^[0-9]{5}$/.test(datos.idCiudad)) throw new DatosInvalidos("idCiudad debe ser una clave INEGI de 5 dígitos");
  if (!datos.nombre?.trim()) throw new DatosInvalidos("El nombre es obligatorio");
  if (!datos.estado?.trim()) throw new DatosInvalidos("El estado es obligatorio");
  return enTransaccion(async (cliente) => {
    const existente = await buscarCiudad(datos.idCiudad, cliente);
    if (existente) throw new Conflicto(`La ciudad ${datos.idCiudad} ya existe`);
    const ciudad = await crearCiudad({ ...datos, nombre: datos.nombre.trim(), estado: datos.estado.trim() }, cliente);
    await encolarEvento("CIUDAD_GUARDADA", { idCiudad: ciudad.idCiudad, nombre: ciudad.nombre }, cliente);
    return ciudad;
  });
}
