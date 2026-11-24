import { Conflicto, DatosInvalidos, NoEncontrado } from "../errores.js";
import { enTransaccion } from "../db/postgres.js";
import { buscarConductor } from "../repositories/relational/conductores.repository.js";
import { actualizarVehiculo, buscarVehiculo, crearVehiculo, listarVehiculos, type VehiculoEntrada } from "../repositories/relational/vehiculos.repository.js";
import { encolarEvento } from "../repositories/relational/eventos.repository.js";

const TIPOS = new Set(["Camión", "Tráiler", "Tren"]);
const ESTADOS = new Set(["Disponible", "En ruta", "En taller"]);

function validar(datos: VehiculoEntrada, parcial = false) {
  if (!parcial || datos.placa !== undefined) {
    if (!datos.placa?.trim()) throw new DatosInvalidos("La placa es obligatoria");
  }
  if (!parcial || datos.tipo !== undefined) {
    if (!TIPOS.has(datos.tipo)) throw new DatosInvalidos("Tipo de vehículo inválido");
  }
  if (!parcial || datos.capacidadKg !== undefined) {
    if (!(Number(datos.capacidadKg) > 0)) throw new DatosInvalidos("capacidadKg debe ser mayor que 0");
  }
  if (!parcial || datos.estado !== undefined) {
    if (!ESTADOS.has(datos.estado)) throw new DatosInvalidos("Estado de vehículo inválido");
  }
}

export async function obtenerVehiculos() {
  return listarVehiculos();
}

export async function obtenerVehiculo(placa: string) {
  const vehiculo = await buscarVehiculo(placa);
  if (!vehiculo) throw new NoEncontrado(`El vehículo ${placa} no existe`);
  return vehiculo;
}

export async function registrarVehiculo(datos: VehiculoEntrada) {
  validar(datos);
  return enTransaccion(async (cliente) => {
    if (datos.idConductor) {
      const conductor = await buscarConductor(datos.idConductor);
      if (!conductor) throw new DatosInvalidos("El conductor indicado no existe");
    }
    const existente = await buscarVehiculo(datos.placa, cliente);
    if (existente) throw new Conflicto(`El vehículo ${datos.placa} ya existe`);
    const vehiculo = await crearVehiculo({ ...datos, placa: datos.placa.trim().toUpperCase() }, cliente);
    await encolarEvento("VEHICULO_GUARDADO", { placa: vehiculo.placa }, cliente);
    return vehiculo;
  });
}

export async function modificarVehiculo(placa: string, datos: Partial<VehiculoEntrada>) {
  validar({ placa, tipo: datos.tipo ?? "Camión", capacidadKg: datos.capacidadKg ?? 1, estado: datos.estado ?? "Disponible", idConductor: datos.idConductor }, true);
  return enTransaccion(async (cliente) => {
    if (datos.idConductor) {
      const conductor = await buscarConductor(datos.idConductor);
      if (!conductor) throw new DatosInvalidos("El conductor indicado no existe");
    }
    const vehiculo = await actualizarVehiculo(placa, datos, cliente);
    if (!vehiculo) throw new NoEncontrado(`El vehículo ${placa} no existe`);
    await encolarEvento("VEHICULO_GUARDADO", { placa: vehiculo.placa }, cliente);
    return vehiculo;
  });
}
