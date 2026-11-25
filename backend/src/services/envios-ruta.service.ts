import { obtenerDatosParaRuta } from "./envios.service.js";
import { calcularRutaConRestricciones } from "./rutas.service.js";
import type { Criterio } from "../repositories/graph/rutas.repository.js";

// Flujo integrado (punto 8.1 de la guía): planear la ruta de un envío con las tres bases.
// 1. PostgreSQL: origen, destino, peso y vehículos disponibles que aguantan ese peso.
// 2. MongoDB: el manifiesto dice si la carga es peligrosa (sin terracería) o refrigerada (tiempo máximo).
// 3. Neo4j: la ruta que cumple esas condiciones esquivando incidentes, y el vehículo que llega antes al origen.
export async function planearRutaDeEnvio(idEnvio: string, criterio: Criterio = "tiempo") {
  const datos = await obtenerDatosParaRuta(idEnvio);
  const avisos = [...datos.avisos];
  if (datos.estado === "Entregado" || datos.estado === "Cancelado") {
    avisos.push(`El envío está ${datos.estado.toLowerCase()}; la ruta es solo de consulta`);
  }
  if (datos.candidatos.length === 0) avisos.push("No hay vehículos disponibles que aguanten el peso de la carga");

  const calculo = await calcularRutaConRestricciones({
    origen: datos.origen,
    destino: datos.destino,
    criterio,
    evitarTerraceria: datos.restricciones.evitarTerraceria,
    tiempoMaxMin: datos.restricciones.tiempoMaxMin,
    candidatos: datos.candidatos,
  });

  return {
    idEnvio: datos.idEnvio,
    estado: datos.estado,
    origen: datos.origen,
    destino: datos.destino,
    pesoKg: datos.pesoKg,
    tipoCarga: datos.tipoCarga,
    criterio,
    restricciones: datos.restricciones,
    candidatos: datos.candidatos,
    encontrada: calculo.encontrada,
    ruta: calculo.ruta,
    tramos: calculo.tramos,
    minutos: calculo.minutos,
    kilometros: calculo.kilometros,
    costoCasetas: calculo.costoCasetas,
    vehiculoSugerido: calculo.vehiculoSugerido,
    avisos: [...avisos, ...calculo.avisos],
    // Qué base aportó cada parte, para que la respuesta sirva de evidencia del flujo integrado
    fuentes: {
      postgresql: "origen, destino, peso, estado y vehículos candidatos",
      mongodb: datos.tipoCarga ? `manifiesto (${datos.tipoCarga})` : "sin manifiesto",
      neo4j: "ruta, incidentes en el camino y ubicación de los vehículos",
    },
  };
}
