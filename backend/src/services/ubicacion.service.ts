import { DatosInvalidos, NoEncontrado } from "../errores.js";
import { buscarPunto } from "../repositories/graph/rutas.repository.js";
import { moverVehiculo, ubicacionDeVehiculo } from "../repositories/graph/ubicacion.repository.js";
import { tipoDeVehiculo } from "../repositories/relational/ubicacion.repository.js";
import { motivoParaNoMover } from "./ubicacion.reglas.js";

export async function consultarUbicacion(placa: string) {
  const ubicacion = await ubicacionDeVehiculo(placa);
  if (!ubicacion) throw new NoEncontrado(`El vehículo ${placa} no existe en la red`);
  return ubicacion;
}

// Mueve un vehículo a otro punto de la red (cambia su arista SE_ENCUENTRA_EN).
export async function cambiarUbicacion(placa: string, idPunto: string) {
  const [actual, punto, tipo] = await Promise.all([ubicacionDeVehiculo(placa), buscarPunto(idPunto), tipoDeVehiculo(placa)]);
  if (!actual) throw new NoEncontrado(`El vehículo ${placa} no existe en la red`);
  if (!punto) throw new NoEncontrado(`El punto ${idPunto} no existe en la red`);

  const avisos: string[] = [];
  if (tipo.disponible && tipo.tipo === null) {
    throw new NoEncontrado(`El vehículo ${placa} no está registrado en PostgreSQL`);
  }
  if (!tipo.disponible) {
    avisos.push(`No se pudo confirmar el tipo del vehículo (${tipo.motivo}); se validó con su ubicación actual`);
  }

  const motivo = motivoParaNoMover({
    tipoVehiculo: tipo.disponible ? tipo.tipo : null,
    tipoPuntoActual: actual.punto?.tipo ?? null,
    tipoPuntoNuevo: punto.tipo,
  });
  if (motivo) throw new DatosInvalidos(motivo);

  const movimiento = await moverVehiculo(placa, idPunto);
  // Solo pasa si alguien borró el vehículo o el punto entre la revisión y la escritura
  if (!movimiento) throw new NoEncontrado(`El vehículo ${placa} o el punto ${idPunto} ya no existen`);
  return { placa, ...movimiento, avisos };
}
