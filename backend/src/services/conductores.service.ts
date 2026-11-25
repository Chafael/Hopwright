import { Conflicto, DatosInvalidos, NoEncontrado } from "../errores.js";
import { actualizarConductor, borrarConductor, buscarConductor, crearConductor, listarConductores, type ConductorEntrada } from "../repositories/relational/conductores.repository.js";

function validar(datos: ConductorEntrada) {
  if (!datos.nombre?.trim()) throw new DatosInvalidos("El nombre es obligatorio");
  if (!datos.licencia?.trim()) throw new DatosInvalidos("La licencia es obligatoria");
}

export async function obtenerConductores() {
  return listarConductores();
}

export async function obtenerConductor(idConductor: number) {
  const conductor = await buscarConductor(idConductor);
  if (!conductor) throw new NoEncontrado(`El conductor ${idConductor} no existe`);
  return conductor;
}

export async function registrarConductor(datos: ConductorEntrada) {
  validar(datos);
  try {
    return await crearConductor({ ...datos, nombre: datos.nombre.trim(), licencia: datos.licencia.trim() });
  } catch (error: any) {
    if (error?.code === "23505") throw new Conflicto("Ya existe un conductor con esa licencia");
    throw error;
  }
}

export async function eliminarConductor(idConductor: number): Promise<void> {
  if (!await buscarConductor(idConductor)) throw new NoEncontrado(`El conductor ${idConductor} no existe`);
  try {
    if (!await borrarConductor(idConductor)) throw new NoEncontrado(`El conductor ${idConductor} no existe`);
  } catch (error: any) {
    if (error?.code === "23503") throw new Conflicto("Tiene vehículos asociados");
    throw error;
  }
}

export async function modificarConductor(idConductor: number, datos: ConductorEntrada) {
  validar(datos);
  try {
    const conductor = await actualizarConductor(idConductor, { ...datos, nombre: datos.nombre.trim(), licencia: datos.licencia.trim() });
    if (!conductor) throw new NoEncontrado(`El conductor ${idConductor} no existe`);
    return conductor;
  } catch (error: any) {
    if (error?.code === "23505") throw new Conflicto("Ya existe un conductor con esa licencia");
    throw error;
  }
}
