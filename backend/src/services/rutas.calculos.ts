// Cálculos de rutas que no dependen de ninguna base de datos.
// Están separados del servicio para poder probarlos con pruebas unitarias.

export type Tramo = { distanciaKm: number; tiempoMin: number };

// Velocidad en km/h de un tramo. La regla R15 no permite más de 110 km/h.
export function velocidadKmH(t: Tramo): number {
  return (t.distanciaKm / t.tiempoMin) * 60;
}

export const VELOCIDAD_MAXIMA = 110;

// Valida los pesos de un tramo nuevo o modificado (R4, R5 y R15).
// Regresa la lista de problemas; si está vacía, el tramo es válido.
export function problemasDeTramo(t: { distanciaKm: number; tiempoMin: number; costo?: number }): string[] {
  const problemas: string[] = [];
  if (!(t.distanciaKm > 0)) problemas.push("distanciaKm debe ser mayor que 0");
  if (!(t.tiempoMin > 0)) problemas.push("tiempoMin debe ser mayor que 0");
  if (t.costo !== undefined && t.costo < 0) problemas.push("el costo no puede ser negativo");
  if (t.distanciaKm > 0 && t.tiempoMin > 0 && velocidadKmH(t) > VELOCIDAD_MAXIMA) {
    problemas.push(
      `la velocidad resultante es ${velocidadKmH(t).toFixed(1)} km/h y no puede pasar de ${VELOCIDAD_MAXIMA} km/h; revisa la distancia o el tiempo`,
    );
  }
  return problemas;
}

// Costo de mover una carga en camión: casetas más el costo de operar el camión por kilómetro
export function costoCamion(kilometros: number, casetas: number, costoKm: number): number {
  return redondear(casetas + kilometros * costoKm);
}

// Costo de mover una carga en tren: lo que cobra cada tramo por tonelada, por las toneladas que pesa
export function costoTren(costoPorTonelada: number, pesoKg: number): number {
  return redondear(costoPorTonelada * (pesoKg / 1000));
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// Una opción de viaje completa, en camión solo o combinando camión y tren
export type OpcionViaje = { minutos: number; kilometros: number; costo: number };

// Elige la opción más barata y la más rápida de una lista (las que sean null se ignoran)
export function elegirMejores<T extends OpcionViaje>(opciones: (T | null)[]): { masBarata: T | null; masRapida: T | null } {
  const validas = opciones.filter((o): o is T => o !== null);
  if (validas.length === 0) return { masBarata: null, masRapida: null };
  const masBarata = validas.reduce((a, b) => (b.costo < a.costo || (b.costo === a.costo && b.minutos < a.minutos) ? b : a));
  const masRapida = validas.reduce((a, b) => (b.minutos < a.minutos || (b.minutos === a.minutos && b.costo < a.costo) ? b : a));
  return { masBarata, masRapida };
}
