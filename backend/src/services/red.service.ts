import { Conflicto, DatosInvalidos, NoEncontrado } from "../errores.js";
import { buscarPunto } from "../repositories/graph/rutas.repository.js";
import {
  actualizarTramoCarretera,
  borrarInterseccion,
  borrarTramoCarretera,
  crearEstacion,
  crearInterseccion,
  crearTramoCarretera,
  crearTramoTren,
  existeTramo,
  incidentesActivosEn,
  leerTramoCarretera,
  vecinosQueQuedarianAislados,
} from "../repositories/graph/red.repository.js";
import { problemasDeTramo } from "./rutas.calculos.js";

// Reglas de la red que Neo4j Community no puede imponer por sí solo.
// Cada regla dice de qué restricción del modelo lógico viene (R2, R5, R7, R12, R14, R15).

export async function altaInterseccion(i: { idInterseccion: string; nombre?: string; tipo: string; latitud: number; longitud: number }) {
  if (await buscarPunto(i.idInterseccion)) throw new Conflicto(`Ya existe un punto con el id ${i.idInterseccion}`);
  await crearInterseccion({ ...i, nombre: i.nombre ?? null });
  return buscarPunto(i.idInterseccion);
}

export async function bajaInterseccion(idInterseccion: string) {
  const punto = await buscarPunto(idInterseccion);
  if (!punto || punto.tipo !== "Interseccion") throw new NoEncontrado(`La intersección ${idInterseccion} no existe`);
  if ((await incidentesActivosEn(idInterseccion)) > 0) {
    throw new Conflicto(`La intersección ${idInterseccion} tiene incidentes activos; ciérralos antes de borrarla`);
  }
  const aislados = await vecinosQueQuedarianAislados(idInterseccion);
  if (aislados.length > 0) {
    throw new Conflicto(`Si se borra ${punto.nombre}, estos puntos se quedarían sin ningún tramo: ${aislados.join(", ")}`, { aislados });
  }
  await borrarInterseccion(idInterseccion);
}

export async function altaEstacion(e: { idEstacion: string; nombre: string; tipoServicio: string; idCiudad: string; tiempoCambioMin: number }) {
  if (await buscarPunto(e.idEstacion)) throw new Conflicto(`Ya existe un punto con el id ${e.idEstacion}`);
  const ciudad = await buscarPunto(e.idCiudad);
  if (!ciudad || ciudad.tipo !== "Ciudad") throw new NoEncontrado(`La ciudad ${e.idCiudad} no existe en la red`);
  if (e.tiempoCambioMin < 0) throw new DatosInvalidos("tiempoCambioMin no puede ser negativo");
  await crearEstacion(e);
  return buscarPunto(e.idEstacion);
}

export type NuevoTramo = {
  tipo: "CARRETERA" | "VIA_FERREA";
  desde: string;
  hasta: string;
  distanciaKm: number;
  tiempoMin: number;
  tiempoVueltaMin?: number;
  dobleSentido?: boolean;
  tipoVia?: string;
  costoCaseta?: number;
  costoPorTonelada?: number;
};

export async function altaTramo(t: NuevoTramo) {
  if (t.desde === t.hasta) throw new DatosInvalidos("Un tramo no puede salir y llegar al mismo punto (R12)");

  // R12: CARRETERA solo entre ciudades e intersecciones; VIA_FERREA solo entre estaciones
  const [a, b] = await Promise.all([buscarPunto(t.desde), buscarPunto(t.hasta)]);
  if (!a) throw new NoEncontrado(`El punto ${t.desde} no existe`);
  if (!b) throw new NoEncontrado(`El punto ${t.hasta} no existe`);
  const deCarretera = (tipo: string) => tipo === "Ciudad" || tipo === "Interseccion";
  if (t.tipo === "CARRETERA" && (!deCarretera(a.tipo) || !deCarretera(b.tipo))) {
    throw new DatosInvalidos("Una CARRETERA solo puede unir ciudades e intersecciones (R12)");
  }
  if (t.tipo === "VIA_FERREA" && (a.tipo !== "Estacion" || b.tipo !== "Estacion")) {
    throw new DatosInvalidos("Una VIA_FERREA solo puede unir estaciones (R12)");
  }
  if (t.tipo === "CARRETERA" && !t.tipoVia) throw new DatosInvalidos("Falta tipoVia para un tramo de carretera");

  // R4, R5, R15: pesos válidos en los dos sentidos
  const costo = t.tipo === "CARRETERA" ? t.costoCaseta ?? 0 : t.costoPorTonelada ?? 0;
  const tiempoVuelta = t.tiempoVueltaMin ?? t.tiempoMin;
  const problemas = [
    ...problemasDeTramo({ distanciaKm: t.distanciaKm, tiempoMin: t.tiempoMin, costo }),
    ...(t.dobleSentido !== false && tiempoVuelta !== t.tiempoMin
      ? problemasDeTramo({ distanciaKm: t.distanciaKm, tiempoMin: tiempoVuelta }).map((p) => `vuelta: ${p}`)
      : []),
  ];
  if (problemas.length > 0) throw new DatosInvalidos(`El tramo no es válido: ${problemas.join("; ")}`, { problemas });

  // R2: no duplicar un tramo que ya existe en ese sentido (y tipo de vía, en carretera)
  const tipoVia = t.tipoVia ?? null;
  const sentidos: [string, string, number][] = [[t.desde, t.hasta, t.tiempoMin]];
  // R14: por defecto se crean los dos sentidos
  if (t.dobleSentido !== false) sentidos.push([t.hasta, t.desde, tiempoVuelta]);
  for (const [desde, hasta] of sentidos) {
    if (await existeTramo(t.tipo, desde, hasta, tipoVia)) {
      throw new Conflicto(`Ya existe un tramo ${t.tipo} de ${desde} a ${hasta}${tipoVia ? ` (${tipoVia})` : ""} (R2)`);
    }
  }

  for (const [desde, hasta, tiempoMin] of sentidos) {
    if (t.tipo === "CARRETERA") {
      await crearTramoCarretera({ desde, hasta, distanciaKm: t.distanciaKm, tiempoMin, costoCaseta: t.costoCaseta ?? 0, tipoVia: t.tipoVia! });
    } else {
      await crearTramoTren({ desde, hasta, distanciaKm: t.distanciaKm, tiempoMin, costoPorTonelada: t.costoPorTonelada ?? 0 });
    }
  }
  return { creados: sentidos.length, desde: t.desde, hasta: t.hasta, tipo: t.tipo };
}

// Cambia un tramo de carretera. Por defecto aplica el cambio a los dos sentidos.
export async function cambioTramo(
  desde: string,
  hasta: string,
  tipoVia: string,
  cambios: { abierto?: boolean; distanciaKm?: number; tiempoMin?: number; costoCaseta?: number },
  ambosSentidos = true,
) {
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos("No se mandó ningún cambio");

  const sentidos: [string, string][] = ambosSentidos ? [[desde, hasta], [hasta, desde]] : [[desde, hasta]];
  const actualizados = [];
  for (const [a, b] of sentidos) {
    const actual = await leerTramoCarretera(a, b, tipoVia);
    if (!actual) throw new NoEncontrado(`No existe un tramo de carretera ${tipoVia} de ${a} a ${b}`);
    // Se validan los pesos como quedarían después del cambio (R5, R15)
    const problemas = problemasDeTramo({
      distanciaKm: cambios.distanciaKm ?? actual.distanciaKm,
      tiempoMin: cambios.tiempoMin ?? actual.tiempoMin,
      costo: cambios.costoCaseta,
    });
    if (problemas.length > 0) throw new DatosInvalidos(`El cambio no es válido: ${problemas.join("; ")}`, { problemas });
  }
  for (const [a, b] of sentidos) actualizados.push(await actualizarTramoCarretera(a, b, tipoVia, cambios));
  return actualizados;
}

export async function bajaTramo(desde: string, hasta: string, tipoVia: string) {
  const borradas = await borrarTramoCarretera(desde, hasta, tipoVia);
  if (borradas === 0) throw new NoEncontrado(`No existe un tramo de carretera ${tipoVia} entre ${desde} y ${hasta}`);
  return { borradas };
}
