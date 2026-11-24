import { Conflicto, DatosInvalidos, NoEncontrado } from "../errores.js";
import { actualizarCliente, buscarCliente, crearCliente, listarClientes, type ClienteEntrada } from "../repositories/relational/clientes.repository.js";

function validar(datos: ClienteEntrada) {
  if (!datos.razonSocial?.trim()) throw new DatosInvalidos("La razón social es obligatoria");
  if (!datos.rfc?.trim()) throw new DatosInvalidos("El RFC es obligatorio");
}

export async function obtenerClientes() {
  return listarClientes();
}

export async function obtenerCliente(idCliente: number) {
  const cliente = await buscarCliente(idCliente);
  if (!cliente) throw new NoEncontrado(`El cliente ${idCliente} no existe`);
  return cliente;
}

export async function registrarCliente(datos: ClienteEntrada) {
  validar(datos);
  try {
    return await crearCliente({ ...datos, razonSocial: datos.razonSocial.trim(), rfc: datos.rfc.trim().toUpperCase() });
  } catch (error: any) {
    if (error?.code === "23505") throw new Conflicto("Ya existe un cliente con ese RFC");
    throw error;
  }
}

export async function modificarCliente(idCliente: number, datos: ClienteEntrada) {
  validar(datos);
  try {
    const cliente = await actualizarCliente(idCliente, { ...datos, razonSocial: datos.razonSocial.trim(), rfc: datos.rfc.trim().toUpperCase() });
    if (!cliente) throw new NoEncontrado(`El cliente ${idCliente} no existe`);
    return cliente;
  } catch (error: any) {
    if (error?.code === "23505") throw new Conflicto("Ya existe un cliente con ese RFC");
    throw error;
  }
}
