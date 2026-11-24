import { leer } from "../../db/neo4j.js";
import { proyeccionPunto, type PuntoRuta } from "./rutas.repository.js";

// La red completa para dibujarla en un mapa: puntos con coordenadas, tramos, incidentes activos
// y dónde está cada vehículo. Son cuatro lecturas independientes que se piden en paralelo.

export type PuntoMapa = PuntoRuta & { latitud: number | null; longitud: number | null };
export type TramoMapa = {
  desde: string;
  hasta: string;
  tipo: "CARRETERA" | "VIA_FERREA";
  tipoVia: string | null;
  abierto: boolean;
  distanciaKm: number;
  tiempoMin: number;
  costoCaseta: number;
};

export async function mapaDeLaRed() {
  const [puntos, tramos, incidentes, vehiculos] = await Promise.all([
    leer<PuntoMapa>(
      `MATCH (n) WHERE n:Ciudad OR n:Interseccion OR n:Estacion
       WITH n, ${proyeccionPunto("n")} AS p
       RETURN p.idPunto AS idPunto, p.nombre AS nombre, p.tipo AS tipo, n.latitud AS latitud, n.longitud AS longitud
       ORDER BY tipo, nombre`,
    ),
    // Cada tramo de doble sentido son dos aristas; para el mapa basta una línea por par de puntos
    leer<TramoMapa>(
      `MATCH (a)-[r:CARRETERA|VIA_FERREA]->(b)
       WITH r, coalesce(a.idCiudad, a.idInterseccion, a.idEstacion) AS desde, coalesce(b.idCiudad, b.idInterseccion, b.idEstacion) AS hasta, a, b
       WHERE desde < hasta OR NOT EXISTS {
         MATCH (b)-[r2]->(a) WHERE type(r2) = type(r) AND coalesce(r2.tipoVia, '') = coalesce(r.tipoVia, '')
       }
       RETURN desde, hasta, type(r) AS tipo, r.tipoVia AS tipoVia, coalesce(r.abierto, true) AS abierto,
              r.distanciaKm AS distanciaKm, r.tiempoMin AS tiempoMin, coalesce(r.costoCaseta, 0) AS costoCaseta`,
    ),
    leer<{ idIncidente: string; gravedad: string; idPunto: string }>(
      `MATCH (i:Incidente {activo: true})-[:BLOQUEA]->(p)
       RETURN i.idIncidente AS idIncidente, i.gravedad AS gravedad, coalesce(p.idCiudad, p.idInterseccion) AS idPunto`,
    ),
    leer<{ placa: string; idPunto: string }>(
      `MATCH (v:Vehiculo)-[:SE_ENCUENTRA_EN]->(p)
       RETURN v.placa AS placa, coalesce(p.idCiudad, p.idInterseccion, p.idEstacion) AS idPunto
       ORDER BY placa`,
    ),
  ]);
  return { puntos, tramos, incidentes, vehiculos };
}
