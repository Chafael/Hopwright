import { Conflicto, DatosInvalidos, NoEncontrado } from "../errores.js";
import { enTransaccion } from "../db/postgres.js";
import { buscarCliente } from "../repositories/relational/clientes.repository.js";
import { buscarCiudad } from "../repositories/relational/ciudades.repository.js";
import { buscarEnvio, buscarEnvioParaActualizar, cambiarEstadoEnvio, crearEnvio, listarEnvios, type EnvioEntrada } from "../repositories/relational/envios.repository.js";
import { buscarVehiculoParaActualizar, listarVehiculosDisponiblesConCapacidad } from "../repositories/relational/vehiculos.repository.js";
import { buscarAsignacionActivaPorEnvio, buscarAsignacionActivaPorPlaca, crearAsignacion, desactivarAsignacionActiva } from "../repositories/relational/asignaciones.repository.js";
import { encolarEvento } from "../repositories/relational/eventos.repository.js";
import { buscarManifiesto, crearManifiesto, type Manifiesto } from "../repositories/document/manifiestos.repository.js";

const PRIORIDADES = new Set(["Normal", "Urgente"]);

export async function obtenerEnvios(estado?: string) {
  return listarEnvios(estado);
}

export async function obtenerEnvio(idEnvio: string) {
  const envio = await buscarEnvio(idEnvio);
  if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
  return envio;
}

export async function registrarEnvio(datos: EnvioEntrada) {
  if (!datos.idEnvio?.trim()) throw new DatosInvalidos("idEnvio es obligatorio");
  if (!(Number(datos.pesoKg) > 0)) throw new DatosInvalidos("pesoKg debe ser mayor que 0");
  if (!PRIORIDADES.has(datos.prioridad)) throw new DatosInvalidos("Prioridad inválida");
  if (datos.idCiudadOrigen === datos.idCiudadDestino) throw new DatosInvalidos("El origen y destino deben ser distintos");

  return enTransaccion(async (cliente) => {
    const cli = await buscarCliente(datos.idCliente);
    if (!cli) throw new DatosInvalidos("El cliente indicado no existe");
    const origen = await buscarCiudad(datos.idCiudadOrigen, cliente);
    const destino = await buscarCiudad(datos.idCiudadDestino, cliente);
    if (!origen || !destino) throw new DatosInvalidos("La ciudad de origen o destino no existe");
    const existente = await buscarEnvio(datos.idEnvio, cliente);
    if (existente) throw new Conflicto(`El envío ${datos.idEnvio} ya existe`);
    return crearEnvio({ ...datos, idEnvio: datos.idEnvio.trim() }, cliente);
  });
}

export async function asignarVehiculo(idEnvio: string, placa: string) {
  return enTransaccion(async (cliente) => {
    const envio = await buscarEnvioParaActualizar(idEnvio, cliente);
    if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
    if (envio.estado !== "Pendiente") throw new Conflicto("Solo se pueden asignar envíos pendientes");

    const vehiculo = await buscarVehiculoParaActualizar(placa, cliente);
    if (!vehiculo) throw new NoEncontrado(`El vehículo ${placa} no existe`);
    if (vehiculo.estado !== "Disponible") throw new Conflicto("El vehículo no está disponible");
    if (vehiculo.capacidadKg < envio.pesoKg) throw new Conflicto("El vehículo no tiene capacidad suficiente");

    const asignacionEnvio = await buscarAsignacionActivaPorEnvio(idEnvio, cliente);
    if (asignacionEnvio) throw new Conflicto("El envío ya tiene una asignación activa");
    const asignacionVehiculo = await buscarAsignacionActivaPorPlaca(placa, cliente);
    if (asignacionVehiculo) throw new Conflicto("El vehículo ya tiene una asignación activa");

    const asignacion = await crearAsignacion(idEnvio, placa, cliente);
    await cliente.query("UPDATE envio SET estado = 'Asignado' WHERE id_envio = $1", [idEnvio]);
    await cliente.query("UPDATE vehiculo SET estado = 'En ruta' WHERE placa = $1", [placa]);
    await encolarEvento("ASIGNACION_CREADA", { idEnvio, placa, fecha: asignacion.fechaAsignacion }, cliente);
    return asignacion;
  });
}

export async function registrarSalida(idEnvio: string) {
  return enTransaccion(async (cliente) => {
    const envio = await buscarEnvioParaActualizar(idEnvio, cliente);
    if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
    if (envio.estado !== "Asignado") throw new Conflicto("Solo se puede marcar salida de un envío asignado");
    const fecha = new Date();
    const actualizado = await cambiarEstadoEnvio(idEnvio, "En camino", cliente, fecha);
    await encolarEvento("ENVIO_SALIO", { idEnvio, fecha: fecha.toISOString() }, cliente);
    return actualizado;
  });
}

export async function registrarEntrega(idEnvio: string) {
  return enTransaccion(async (cliente) => {
    const envio = await buscarEnvioParaActualizar(idEnvio, cliente);
    if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
    if (envio.estado !== "En camino") throw new Conflicto("Solo se puede entregar un envío en camino");
    const asignacion = await desactivarAsignacionActiva(idEnvio, cliente);
    if (!asignacion) throw new Conflicto("El envío no tiene una asignación activa");
    const { rows } = await cliente.query<{ tipo: string }>("UPDATE vehiculo SET estado = 'Disponible' WHERE placa = $1 RETURNING tipo", [asignacion.placa]);
    const actualizado = await cambiarEstadoEnvio(idEnvio, "Entregado", cliente);
    const fecha = new Date().toISOString();
    // El camión se queda en la ciudad de destino; el procesador de eventos lo mueve en Neo4j.
    // Un tren no se mueve: solo puede estar en una estación (R11).
    const moverA = rows[0]?.tipo === "Tren" ? null : envio.idCiudadDestino;
    await encolarEvento("ENVIO_ENTREGADO", { idEnvio, fecha, placa: asignacion.placa, moverA }, cliente);
    return actualizado;
  });
}

export async function cancelarEnvio(idEnvio: string) {
  return enTransaccion(async (cliente) => {
    const envio = await buscarEnvioParaActualizar(idEnvio, cliente);
    if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
    if (envio.estado !== "Pendiente" && envio.estado !== "Asignado") {
      throw new Conflicto("Solo se pueden cancelar envíos pendientes o asignados");
    }
    const asignacion = await buscarAsignacionActivaPorEnvio(idEnvio, cliente);
    if (asignacion) {
      await desactivarAsignacionActiva(idEnvio, cliente);
      await cliente.query("UPDATE vehiculo SET estado = 'Disponible' WHERE placa = $1", [asignacion.placa]);
    }
    const actualizado = await cambiarEstadoEnvio(idEnvio, "Cancelado", cliente);
    const fecha = new Date().toISOString();
    await encolarEvento("ENVIO_CANCELADO", { idEnvio, fecha }, cliente);
    return actualizado;
  });
}

function validarManifiesto(m: any): Manifiesto {
  if (!m || typeof m !== "object") throw new DatosInvalidos("El manifiesto es inválido");
  if (!["general", "refrigerada", "peligrosa"].includes(m.tipoCarga)) throw new DatosInvalidos("tipoCarga inválido");
  if (!Array.isArray(m.articulos) || m.articulos.length === 0) throw new DatosInvalidos("articulos es obligatorio");
  for (const a of m.articulos) {
    if (!a?.descripcion || !(Number(a.cantidad) >= 1) || !(Number(a.pesoKg) > 0)) {
      throw new DatosInvalidos("Cada artículo debe tener descripcion, cantidad >= 1 y pesoKg > 0");
    }
  }
  const base: any = {
    idEnvio: String(m.idEnvio),
    tipoCarga: m.tipoCarga,
    articulos: m.articulos.map((a: any) => ({ descripcion: String(a.descripcion), cantidad: Number(a.cantidad), pesoKg: Number(a.pesoKg) })),
    creadoEn: new Date(),
  };
  if (m.tipoCarga === "refrigerada") {
    if (m.tempMinC === undefined || m.tempMaxC === undefined || !(Number(m.tiempoMaxMin) > 0)) {
      throw new DatosInvalidos("La carga refrigerada requiere tempMinC, tempMaxC y tiempoMaxMin");
    }
    base.tempMinC = Number(m.tempMinC);
    base.tempMaxC = Number(m.tempMaxC);
    base.tiempoMaxMin = Number(m.tiempoMaxMin);
    base.restriccionesRuta = { evitarTerraceria: false, tiempoMaxMin: Number(m.tiempoMaxMin) };
  } else if (m.tipoCarga === "peligrosa") {
    const clase = Number(m.claseUN);
    if (!(clase >= 1 && clase <= 9) || !m.numeroONU || !m.hojaSeguridad || !m.telefonoEmergencia) {
      throw new DatosInvalidos("La carga peligrosa requiere claseUN (1-9), numeroONU, hojaSeguridad y telefonoEmergencia");
    }
    base.claseUN = clase;
    base.numeroONU = String(m.numeroONU);
    base.hojaSeguridad = String(m.hojaSeguridad);
    base.telefonoEmergencia = String(m.telefonoEmergencia);
    base.restriccionesRuta = { evitarTerraceria: true, tiempoMaxMin: null };
  } else {
    base.restriccionesRuta = {
      evitarTerraceria: Boolean(m.restriccionesRuta?.evitarTerraceria),
      tiempoMaxMin: m.restriccionesRuta?.tiempoMaxMin == null ? null : Number(m.restriccionesRuta.tiempoMaxMin),
    };
  }
  return base as Manifiesto;
}

export async function guardarManifiesto(idEnvio: string, entrada: any) {
  const envio = await buscarEnvio(idEnvio);
  if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
  const existente = await buscarManifiesto(idEnvio);
  if (existente) throw new Conflicto(`El envío ${idEnvio} ya tiene manifiesto`);
  const manifiesto = validarManifiesto({ ...entrada, idEnvio });
  try {
    await crearManifiesto(manifiesto);
  } catch (error: any) {
    if (error?.name === "MongoServerError" && error?.code === 121) {
      throw new DatosInvalidos("El manifiesto no cumple el esquema de MongoDB", error.errInfo);
    }
    throw error;
  }
  return manifiesto;
}

export async function obtenerManifiesto(idEnvio: string) {
  const envio = await buscarEnvio(idEnvio);
  if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
  const manifiesto = await buscarManifiesto(idEnvio);
  if (!manifiesto) throw new NoEncontrado(`El envío ${idEnvio} no tiene manifiesto`);
  return manifiesto;
}

export async function obtenerDatosParaRuta(idEnvio: string) {
  const envio = await buscarEnvio(idEnvio);
  if (!envio) throw new NoEncontrado(`El envío ${idEnvio} no existe`);
  const candidatos = (await listarVehiculosDisponiblesConCapacidad(envio.pesoKg)).map((v) => v.placa);
  const manifiesto = await buscarManifiesto(idEnvio);
  const avisos: string[] = [];
  let restricciones = { evitarTerraceria: false, tiempoMaxMin: null as number | null };
  if (!manifiesto) {
    avisos.push("El envío no tiene manifiesto");
  } else {
    const tiempoMax = manifiesto.tipoCarga === "refrigerada" ? manifiesto.tiempoMaxMin ?? manifiesto.restriccionesRuta?.tiempoMaxMin : manifiesto.restriccionesRuta?.tiempoMaxMin;
    restricciones = {
      evitarTerraceria: Boolean(manifiesto.restriccionesRuta?.evitarTerraceria) || manifiesto.tipoCarga === "peligrosa",
      tiempoMaxMin: Number(tiempoMax) > 0 ? Number(tiempoMax) : null,
    };
  }
  return {
    idEnvio: envio.idEnvio,
    estado: envio.estado,
    tipoCarga: manifiesto?.tipoCarga ?? null,
    origen: envio.idCiudadOrigen,
    destino: envio.idCiudadDestino,
    pesoKg: envio.pesoKg,
    candidatos,
    restricciones,
    avisos,
  };
}
