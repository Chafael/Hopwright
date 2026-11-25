import type { PasoExploracion } from "./api";

// Convierte los pasos de la búsqueda en una línea de tiempo para animarlos.
// La idea es la de los videos de Dijkstra: la búsqueda avanza como una mancha que se extiende
// a la velocidad del costo acumulado, así que los lugares cercanos se encienden primero y los
// tramos crecen a lo largo del tiempo que les toma recorrerlos.
// El tiempo mezcla el costo (65 %) con el orden de la búsqueda (35 %) para que siempre haya avance,
// incluso con el criterio de casetas, donde muchos tramos cuestan 0.

export type VisitaAnimada = { punto: string; lado: "origen" | "destino"; t: number };
export type TramoAnimado = { desde: string; hasta: string; lado: "origen" | "destino"; mejora: boolean; inicio: number; fin: number };
export type LineaDeTiempo = { visitas: VisitaAnimada[]; tramos: TramoAnimado[]; fin: number };

const PESO_COSTO = 0.65;

// Duración de la búsqueda a velocidad normal, según cuántos lugares revisa
export function duracionBase(visitas: number) {
  return Math.min(22000, Math.max(9000, visitas * 520));
}

export function lineaDeTiempo(pasos: PasoExploracion[], duracion = duracionBase(pasos.filter((p) => p.tipo === "visita").length)): LineaDeTiempo {
  const n = pasos.filter((p) => p.tipo === "visita").length;
  // Costo máximo de cada lado: en la bidireccional cada lado cubre su mitad y deben encontrarse al final
  const maximo = { origen: 0, destino: 0 };
  for (const p of pasos) if (p.tipo === "visita") maximo[p.lado] = Math.max(maximo[p.lado], p.costo);

  const momento = (costo: number, orden: number, lado: "origen" | "destino") => {
    const porOrden = n > 1 ? orden / (n - 1) : 0;
    if (maximo[lado] < 1e-3) return duracion * porOrden;
    return duracion * (PESO_COSTO * Math.min(costo / maximo[lado], 1.15) + (1 - PESO_COSTO) * porOrden);
  };

  const turno = duracion / Math.max(n, 1);
  const visitas: VisitaAnimada[] = [];
  const tramos: TramoAnimado[] = [];
  let orden = -1;
  let ahora = 0;
  let enTurno = 0;
  for (const p of pasos) {
    if (p.tipo === "visita") {
      orden++;
      enTurno = 0;
      // Nunca antes que el lugar anterior: el orden de la búsqueda se respeta
      ahora = Math.max(ahora, momento(p.costo, orden, p.lado));
      visitas.push({ punto: p.punto, lado: p.lado, t: ahora });
      continue;
    }
    const inicio = ahora + enTurno++ * Math.min(60, turno * 0.15);
    const llegada = p.costo === undefined ? inicio + turno * 1.6 : momento(p.costo, orden + 1, p.lado);
    const fin = Math.min(inicio + duracion * 0.3, Math.max(inicio + turno * 0.8, llegada));
    tramos.push({ desde: p.desde, hasta: p.hasta, lado: p.lado, mejora: p.mejora, inicio, fin });
  }
  const fin = Math.max(ahora, ...tramos.map((t) => t.fin), 0);
  return { visitas, tramos, fin };
}
