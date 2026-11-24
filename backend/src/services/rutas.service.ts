import { env } from "../config/env.js";
import { DatosInvalidos, NoEncontrado } from "../errores.js";
import {
  buscarPunto,
  ciudadesAisladas,
  estacionesConCiudad,
  rutaCarretera,
  redDeCarreteras,
  rutaTren,
  ubicacionesDeVehiculos,
  type Criterio,
  type PuntoRuta,
  type RutaCarretera,
} from "../repositories/graph/rutas.repository.js";
import { costoCamion, costoTren, elegirMejores, redondear } from "./rutas.calculos.js";
import { explorar, type Algoritmo } from "./rutas.exploracion.js";

export type ResultadoRuta = {
  encontrada: boolean;
  ruta: PuntoRuta[];
  tramos: RutaCarretera["tramos"];
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  avisos: string[];
};

async function exigirCiudad(idCiudad: string, campo: string): Promise<PuntoRuta> {
  const punto = await buscarPunto(idCiudad);
  if (!punto || punto.tipo !== "Ciudad") throw new NoEncontrado(`La ciudad ${idCiudad} (${campo}) no existe en la red`);
  return punto;
}

// Avisos por incidentes activos que no bloquean (Baja o Media) pero están en el camino
function avisosDeIncidentes(ruta: RutaCarretera): string[] {
  return ruta.incidentes
    .filter((i) => i.gravedad !== "Alta")
    .map((i) => `La ruta pasa por ${i.punto}, donde hay un incidente activo de gravedad ${i.gravedad} (${i.idIncidente})`);
}

function sinRuta(avisos: string[]): ResultadoRuta {
  return { encontrada: false, ruta: [], tramos: [], minutos: 0, kilometros: 0, costoCasetas: 0, avisos };
}

// C1: ruta más rápida, más corta o con menos casetas entre dos ciudades
export async function calcularRuta(params: {
  origen: string;
  destino: string;
  criterio: Criterio;
  evitarTerraceria?: boolean;
  tiempoMaxMin?: number | null;
}): Promise<ResultadoRuta> {
  if (params.origen === params.destino) throw new DatosInvalidos("El origen y el destino deben ser ciudades distintas");
  await exigirCiudad(params.origen, "origen");
  await exigirCiudad(params.destino, "destino");

  const ruta = await rutaCarretera({
    origen: params.origen,
    destino: params.destino,
    criterio: params.criterio,
    evitarTerraceria: params.evitarTerraceria ?? false,
    tiempoMaxMin: params.tiempoMaxMin ?? null,
    candidatas: env.rutas.candidatas,
  });

  if (!ruta) {
    const motivos = ["No hay una ruta por carretera que cumpla las condiciones."];
    if (params.evitarTerraceria) motivos.push("Se excluyeron los tramos de terracería.");
    if (params.tiempoMaxMin) motivos.push(`Se pidió llegar en máximo ${params.tiempoMaxMin} minutos.`);
    motivos.push("También se excluyen los tramos cerrados y los puntos con incidentes activos de gravedad Alta.");
    return sinRuta([motivos.join(" ")]);
  }

  return {
    encontrada: true,
    ruta: ruta.puntos,
    tramos: ruta.tramos,
    minutos: ruta.minutos,
    kilometros: redondear(ruta.kilometros),
    costoCasetas: redondear(ruta.costoCasetas),
    avisos: avisosDeIncidentes(ruta),
  };
}

// C2: compara mandar la carga solo en camión contra combinar camión, tren y camión
export async function compararCamionTren(params: { origen: string; destino: string; pesoKg: number }) {
  if (params.origen === params.destino) throw new DatosInvalidos("El origen y el destino deben ser ciudades distintas");
  if (!(params.pesoKg > 0)) throw new DatosInvalidos("pesoKg debe ser mayor que 0");
  await exigirCiudad(params.origen, "origen");
  await exigirCiudad(params.destino, "destino");

  const costoKm = env.rutas.costoKmCamion;

  // Tramo en camión de un punto a otro (0 si ya está ahí). Siempre por la ruta más rápida.
  const tramosCamion = new Map<string, RutaCarretera | null | "mismo">();
  async function camion(desde: string, hasta: string): Promise<RutaCarretera | null | "mismo"> {
    if (desde === hasta) return "mismo";
    const clave = `${desde}>${hasta}`;
    if (!tramosCamion.has(clave)) {
      tramosCamion.set(
        clave,
        await rutaCarretera({ origen: desde, destino: hasta, criterio: "tiempo", evitarTerraceria: false, tiempoMaxMin: null, candidatas: env.rutas.candidatas }),
      );
    }
    return tramosCamion.get(clave)!;
  }

  // Opción 1: todo en camión
  const directo = await camion(params.origen, params.destino);
  const soloCamion =
    directo && directo !== "mismo"
      ? {
          modo: "camion" as const,
          minutos: directo.minutos,
          kilometros: redondear(directo.kilometros),
          costo: costoCamion(directo.kilometros, directo.costoCasetas, costoKm),
          ruta: directo.puntos,
        }
      : null;

  // Opción 2: camión hasta una estación, tren, y camión desde otra estación hasta el destino.
  // Se prueban todas las parejas de estaciones y se guarda la más barata.
  const estaciones = await estacionesConCiudad();
  type Combinada = {
    modo: "camion-tren";
    minutos: number;
    kilometros: number;
    costo: number;
    estacionSubida: string;
    estacionBajada: string;
    tramos: { modo: "camion" | "tren"; desde: string; hasta: string; minutos: number; kilometros: number; costo: number }[];
  };
  let mejorCombinada: Combinada | null = null;

  for (const subida of estaciones) {
    for (const bajada of estaciones) {
      if (subida.idEstacion === bajada.idEstacion) continue;
      const ida = await camion(params.origen, subida.idCiudad);
      const vuelta = await camion(bajada.idCiudad, params.destino);
      if (ida === null || vuelta === null) continue;
      const tren = await rutaTren(subida.idEstacion, bajada.idEstacion);
      if (!tren) continue;

      const tramos: Combinada["tramos"] = [];
      if (ida !== "mismo") {
        tramos.push({ modo: "camion", desde: params.origen, hasta: subida.idCiudad, minutos: ida.minutos, kilometros: redondear(ida.kilometros), costo: costoCamion(ida.kilometros, ida.costoCasetas, costoKm) });
      }
      tramos.push({ modo: "tren", desde: subida.idEstacion, hasta: bajada.idEstacion, minutos: tren.minutos, kilometros: redondear(tren.kilometros), costo: costoTren(tren.costoPorTonelada, params.pesoKg) });
      if (vuelta !== "mismo") {
        tramos.push({ modo: "camion", desde: bajada.idCiudad, hasta: params.destino, minutos: vuelta.minutos, kilometros: redondear(vuelta.kilometros), costo: costoCamion(vuelta.kilometros, vuelta.costoCasetas, costoKm) });
      }

      // Subir y bajar la carga del tren toma tiempo en cada estación
      const minutosCambio = subida.tiempoCambioMin + bajada.tiempoCambioMin;
      const opcion: Combinada = {
        modo: "camion-tren",
        minutos: tramos.reduce((s, t) => s + t.minutos, 0) + minutosCambio,
        kilometros: redondear(tramos.reduce((s, t) => s + t.kilometros, 0)),
        costo: redondear(tramos.reduce((s, t) => s + t.costo, 0)),
        estacionSubida: subida.nombre,
        estacionBajada: bajada.nombre,
        tramos,
      };
      if (!mejorCombinada || opcion.costo < mejorCombinada.costo) mejorCombinada = opcion;
    }
  }

  const { masBarata, masRapida } = elegirMejores<{ modo: string; minutos: number; kilometros: number; costo: number }>([soloCamion, mejorCombinada]);

  return {
    origen: params.origen,
    destino: params.destino,
    pesoKg: params.pesoKg,
    costoKmCamion: costoKm,
    soloCamion,
    camionTren: mejorCombinada,
    masBarata: masBarata?.modo ?? null,
    masRapida: masRapida?.modo ?? null,
  };
}

// C4: ciudades que se quedan sin camino hacia `destino` si se cierra un punto
export async function calcularCiudadesAisladas(puntoCerrado: string, destino: string) {
  const punto = await buscarPunto(puntoCerrado);
  if (!punto || punto.tipo === "Estacion") throw new NoEncontrado(`El punto ${puntoCerrado} no existe en la red de carreteras`);
  const ciudadDestino = await exigirCiudad(destino, "destino");
  if (puntoCerrado === destino) throw new DatosInvalidos("El punto cerrado no puede ser la misma ciudad de destino");

  const aisladas = await ciudadesAisladas(puntoCerrado, destino);
  return { puntoCerrado: punto, destino: ciudadDestino, aisladas };
}

// Parte de grafos del flujo integrado (contrato en docs/plan-de-trabajo.md, sección 9).
// Calcula la ruta con las restricciones de la carga y elige, entre los vehículos candidatos,
// el que llega antes al origen.
export async function calcularRutaConRestricciones(entrada: {
  origen: string;
  destino: string;
  criterio: Criterio;
  evitarTerraceria: boolean;
  tiempoMaxMin: number | null;
  candidatos: string[];
}) {
  const ruta = await calcularRuta(entrada);
  const avisos = [...ruta.avisos];

  let vehiculoSugerido: { placa: string; minutosAlOrigen: number } | null = null;
  if (entrada.candidatos.length > 0) {
    const ubicaciones = await ubicacionesDeVehiculos(entrada.candidatos);
    for (const u of ubicaciones) {
      if (u.tipo === "Estacion") continue; // un tren no puede ir por carretera a recoger la carga
      let minutos: number | null;
      if (u.idPunto === entrada.origen) {
        minutos = 0;
      } else {
        const tramo = await rutaCarretera({ origen: u.idPunto, destino: entrada.origen, criterio: "tiempo", evitarTerraceria: false, tiempoMaxMin: null, candidatas: 1 });
        minutos = tramo?.minutos ?? null;
      }
      if (minutos !== null && (!vehiculoSugerido || minutos < vehiculoSugerido.minutosAlOrigen)) {
        vehiculoSugerido = { placa: u.placa, minutosAlOrigen: minutos };
      }
    }
    const sinUbicacion = entrada.candidatos.filter((p) => !ubicaciones.some((u) => u.placa === p));
    if (sinUbicacion.length > 0) avisos.push(`No se conoce la ubicación de: ${sinUbicacion.join(", ")}`);
    if (!vehiculoSugerido) avisos.push("Ninguno de los vehículos candidatos puede llegar por carretera al origen");
  }

  return {
    ruta: ruta.ruta,
    minutos: ruta.minutos,
    kilometros: ruta.kilometros,
    costo: ruta.costoCasetas,
    vehiculoSugerido,
    avisos,
  };
}

// Exploración paso a paso para la interfaz: repite Dijkstra sobre la misma red de Neo4j guardando el orden
// en que revisa cada punto y tramo, y lo compara con la ruta que calcula Neo4j.
export async function explorarRuta(params: {
  origen: string;
  destino: string;
  criterio: Criterio;
  evitarTerraceria: boolean;
  tiempoMaxMin: number | null;
  algoritmo: Algoritmo;
}) {
  const [neo4j, red] = await Promise.all([calcularRuta(params), redDeCarreteras()]);
  const exploracion = explorar(
    { aristas: red.aristas, bloqueados: new Set(red.bloqueados) },
    { origen: params.origen, destino: params.destino, criterio: params.criterio, evitarTerraceria: params.evitarTerraceria, algoritmo: params.algoritmo },
  );

  const costoNeo4j = !neo4j.encontrada
    ? null
    : params.criterio === "tiempo"
      ? neo4j.minutos
      : params.criterio === "distancia"
        ? neo4j.kilometros
        : neo4j.costoCasetas;
  const avisos: string[] = [];
  let coincide: boolean;
  if (!neo4j.encontrada || !exploracion.encontrada) {
    coincide = neo4j.encontrada === exploracion.encontrada;
  } else {
    coincide = Math.abs(exploracion.costo - costoNeo4j!) < 0.01;
  }
  // El tiempo máximo no es parte de Dijkstra: Neo4j filtra después entre sus rutas candidatas
  if (params.tiempoMaxMin !== null && exploracion.encontrada && exploracion.minutos > params.tiempoMaxMin) {
    avisos.push(
      `La ruta más ${params.criterio === "tiempo" ? "rápida" : params.criterio === "distancia" ? "corta" : "barata"} tarda ${exploracion.minutos} min, más que el máximo de ${params.tiempoMaxMin}. ` +
        (neo4j.encontrada ? "Neo4j eligió la siguiente que sí cumple." : "Ninguna otra cumple."),
    );
  }

  return {
    ...exploracion,
    criterio: params.criterio,
    neo4j: { encontrada: neo4j.encontrada, ruta: neo4j.ruta.map((p) => p.idPunto), costo: costoNeo4j, minutos: neo4j.minutos, kilometros: neo4j.kilometros },
    coincide,
    avisos,
  };
}
