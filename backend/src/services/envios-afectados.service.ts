import { env } from "../config/env.js";
import { NoEncontrado } from "../errores.js";
import { buscarReporte } from "../repositories/document/incidentes.repository.js";
import { evitaTerraceria } from "../repositories/document/restricciones.repository.js";
import { enviosEnCamino } from "../repositories/relational/envios-afectados.repository.js";
import { buscarPunto, rutaCarretera, ubicacionesDeVehiculos, type PuntoRuta, type RutaCarretera } from "../repositories/graph/rutas.repository.js";
import { redondear } from "./rutas.calculos.js";

// C5: qué envíos en camino pasan por el punto de un incidente y cuánto se tardan de más si lo rodean.
//
// Usa las tres bases:
// - MongoDB: el reporte del incidente (dónde está y si sigue activo) y las restricciones del manifiesto.
// - PostgreSQL: los envíos con estado "En camino" y el vehículo asignado a cada uno.
// - Neo4j: dónde está el vehículo, la ruta que llevaría sin el incidente y la ruta que rodea el punto.
//
// Para cada envío se calcula la ruta desde donde está el vehículo hasta el destino como si el incidente
// no existiera. Si esa ruta pasa por el punto, el envío está afectado y se busca la mejor ruta que no
// pase por ahí. La diferencia de minutos es el costo del desvío.

type Resumen = { minutos: number; kilometros: number; ruta: string[] };

export type EnvioAfectado = {
  idEnvio: string;
  placa: string | null;
  prioridad: string;
  partida: string;
  destino: string;
  rutaSinIncidente: Resumen;
  desvio: Resumen | null; // null: no hay forma de llegar sin pasar por el punto
  minutosExtra: number | null;
};

const resumir = (r: RutaCarretera): Resumen => ({
  minutos: r.minutos,
  kilometros: redondear(r.kilometros),
  ruta: r.puntos.map((p) => p.nombre),
});

export async function enviosAfectados(idIncidente: string) {
  const reporte = await buscarReporte(idIncidente);
  if (!reporte) throw new NoEncontrado(`El incidente ${idIncidente} no existe`);

  const punto: PuntoRuta | null = await buscarPunto(reporte.idPunto);
  const incidente = { idIncidente, tipo: reporte.tipo, gravedad: reporte.gravedad, activo: reporte.activo, idPunto: reporte.idPunto, punto: punto?.nombre ?? null };
  const avisos: string[] = [];

  if (!reporte.activo) {
    return { incidente, revisados: 0, afectados: [] as EnvioAfectado[], avisos: ["El incidente ya está cerrado; no afecta a ningún envío"] };
  }
  if (!punto) avisos.push(`El punto ${reporte.idPunto} ya no existe en la red`);
  if (reporte.gravedad !== "Alta") {
    avisos.push(`El incidente es de gravedad ${reporte.gravedad}: no cierra el paso, pero se calcula el desvío por si conviene rodearlo`);
  }

  const envios = await enviosEnCamino();
  if (envios === null) {
    return { incidente, revisados: 0, afectados: [] as EnvioAfectado[], avisos: [...avisos, "No se revisaron envíos: las tablas envio y asignacion todavía no existen en PostgreSQL"] };
  }

  const placas = envios.map((e) => e.placa).filter((p): p is string => p !== null);
  const ubicaciones = new Map((await ubicacionesDeVehiculos(placas)).map((u) => [u.placa, u]));

  const afectados: EnvioAfectado[] = [];
  for (const envio of envios) {
    // Se parte de donde está el vehículo; si no se sabe, o está en una estación de tren, desde el origen
    const ubicacion = envio.placa ? ubicaciones.get(envio.placa) : undefined;
    const partida = ubicacion && ubicacion.tipo !== "Estacion" ? ubicacion.idPunto : envio.origen;
    if (partida === envio.destino) continue; // ya llegó

    const base = {
      origen: partida,
      destino: envio.destino,
      criterio: "tiempo" as const,
      evitarTerraceria: await evitaTerraceria(envio.idEnvio),
      tiempoMaxMin: null,
      candidatas: env.rutas.candidatas,
    };

    const sinIncidente = await rutaCarretera({ ...base, ignorarIncidentes: [idIncidente] });
    if (!sinIncidente) {
      avisos.push(`No se encontró ruta para ${envio.idEnvio} ni aun sin el incidente`);
      continue;
    }
    if (!sinIncidente.puntos.some((p) => p.idPunto === reporte.idPunto)) continue;

    const desvio = await rutaCarretera({ ...base, ignorarIncidentes: [idIncidente], evitarPuntos: [reporte.idPunto] });
    afectados.push({
      idEnvio: envio.idEnvio,
      placa: envio.placa,
      prioridad: envio.prioridad,
      partida,
      destino: envio.destino,
      rutaSinIncidente: resumir(sinIncidente),
      desvio: desvio ? resumir(desvio) : null,
      minutosExtra: desvio ? desvio.minutos - sinIncidente.minutos : null,
    });
  }

  // Primero los urgentes; dentro de cada prioridad, los que se retrasan más (o no tienen desvío)
  afectados.sort(
    (a, b) =>
      Number(b.prioridad === "Urgente") - Number(a.prioridad === "Urgente") ||
      (b.minutosExtra ?? Number.POSITIVE_INFINITY) - (a.minutosExtra ?? Number.POSITIVE_INFINITY),
  );
  const sinDesvio = afectados.filter((a) => a.desvio === null).map((a) => a.idEnvio);
  if (sinDesvio.length > 0) avisos.push(`Estos envíos no tienen otra forma de llegar: ${sinDesvio.join(", ")}`);

  return { incidente, revisados: envios.length, afectados, avisos };
}
