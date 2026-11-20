// Regla R11: un tren solo puede estar en una estación, y un camión o tráiler solo en una ciudad
// o intersección. Son funciones puras para poder probarlas sin bases de datos.

export type TipoPunto = "Ciudad" | "Interseccion" | "Estacion";

const esDeCarretera = (tipo: string) => tipo === "Ciudad" || tipo === "Interseccion";

// Regresa el motivo por el que no se puede mover, o null si sí se puede.
// tipoVehiculo viene de PostgreSQL; si no se pudo consultar, se usa dónde está ahora el vehículo:
// uno que está en una estación es un tren, y uno que está en carretera no lo es.
export function motivoParaNoMover(params: { tipoVehiculo: string | null; tipoPuntoActual: string | null; tipoPuntoNuevo: string }): string | null {
  const { tipoVehiculo, tipoPuntoActual, tipoPuntoNuevo } = params;

  if (tipoVehiculo !== null) {
    if (tipoVehiculo === "Tren" && tipoPuntoNuevo !== "Estacion") return "Un tren solo puede estar en una estación (R11)";
    if (tipoVehiculo !== "Tren" && !esDeCarretera(tipoPuntoNuevo)) return `Un vehículo de tipo ${tipoVehiculo} solo puede estar en una ciudad o intersección (R11)`;
    return null;
  }

  if (tipoPuntoActual === null) return null; // sin tipo ni ubicación previa no hay con qué comparar
  if (tipoPuntoActual === "Estacion" && tipoPuntoNuevo !== "Estacion") return "El vehículo está en una estación, así que es un tren y solo puede pasar a otra estación (R11)";
  if (esDeCarretera(tipoPuntoActual) && tipoPuntoNuevo === "Estacion") return "El vehículo circula por carretera y no puede ubicarse en una estación (R11)";
  return null;
}
