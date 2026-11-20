import { borrarIncidentesDelGrafo, guardarIncidenteEnGrafo, listarIncidentesEnGrafo } from "../repositories/graph/incidentes.repository.js";
import { listarParaReconciliar, marcarSincronizado } from "../repositories/document/incidentes.repository.js";
import { borrarVehiculos, ciudadesEnGrafo, guardarCiudades, guardarVehiculos, vehiculosEnGrafo } from "../repositories/graph/reconciliacion.repository.js";
import { ciudadesEnPostgres, placasEnPostgres } from "../repositories/relational/reconciliacion.repository.js";

// Reconciliación: compara cada réplica del grafo contra su fuente de verdad y corrige las diferencias.
//
// - Incidentes: la fuente de verdad es MongoDB. Se copian al grafo los que falten o no coincidan
//   (gravedad, activo o punto) y se borran del grafo los que ya no existen en MongoDB.
// - Ciudades: la fuente de verdad es PostgreSQL. Se crean en el grafo las que falten y se corrige el nombre.
//   Las que solo están en el grafo no se borran, porque tienen tramos de carretera; solo se reportan.
// - Vehículos: la fuente de verdad es PostgreSQL. Se crean en el grafo los que falten y se borran los que sobran.
//
// Todas las escrituras usan MERGE, así que correr la reconciliación dos veces seguidas no cambia nada la segunda vez.
// Es el respaldo de la sincronización normal: el campo sincronizado de MongoDB y los eventos pendientes
// de PostgreSQL cubren el caso común; esto arregla lo que se haya quedado atrás.

export type ResumenReconciliacion = {
  incidentes: { revisados: number; copiados: string[]; borradosDelGrafo: string[]; conPuntoInexistente: string[] };
  ciudades: { revisadas: number; copiadas: string[]; soloEnGrafo: string[]; sinTramos: string[] } | null;
  vehiculos: { revisados: number; copiados: string[]; borradosDelGrafo: string[]; sinUbicacion: string[] } | null;
  avisos: string[];
  duracionMs: number;
};

async function reconciliarIncidentes(): Promise<ResumenReconciliacion["incidentes"]> {
  const [enMongo, enGrafo] = await Promise.all([listarParaReconciliar(), listarIncidentesEnGrafo()]);
  const grafoPorId = new Map(enGrafo.map((i) => [i.idIncidente, i]));

  const copiados: string[] = [];
  const conPuntoInexistente: string[] = [];
  for (const reporte of enMongo) {
    const replica = grafoPorId.get(reporte.idIncidente);
    const coincide = replica && replica.gravedad === reporte.gravedad && replica.activo === reporte.activo && replica.idPunto === reporte.idPunto;
    if (!coincide) {
      const guardado = await guardarIncidenteEnGrafo(reporte);
      if (!guardado) {
        conPuntoInexistente.push(reporte.idIncidente);
        continue;
      }
      copiados.push(reporte.idIncidente);
    }
    if (!reporte.sincronizado) await marcarSincronizado(reporte.idIncidente);
  }

  const idsEnMongo = new Set(enMongo.map((r) => r.idIncidente));
  const sobrantes = enGrafo.map((i) => i.idIncidente).filter((id) => !idsEnMongo.has(id));
  await borrarIncidentesDelGrafo(sobrantes);

  return { revisados: enMongo.length, copiados, borradosDelGrafo: sobrantes, conPuntoInexistente };
}

async function reconciliarCiudades(avisos: string[]): Promise<ResumenReconciliacion["ciudades"]> {
  const enPostgres = await ciudadesEnPostgres();
  if (enPostgres === null) {
    avisos.push("No se revisaron las ciudades: la tabla ciudad todavía no existe en PostgreSQL");
    return null;
  }
  const enGrafo = await ciudadesEnGrafo();
  const grafoPorId = new Map(enGrafo.map((c) => [c.idCiudad, c]));

  const porCopiar = enPostgres.filter((c) => grafoPorId.get(c.idCiudad)?.nombre !== c.nombre);
  await guardarCiudades(porCopiar);

  const idsEnPostgres = new Set(enPostgres.map((c) => c.idCiudad));
  const soloEnGrafo = enGrafo.filter((c) => !idsEnPostgres.has(c.idCiudad)).map((c) => c.idCiudad);
  if (soloEnGrafo.length > 0) avisos.push(`Hay ciudades en la red que no están en PostgreSQL: ${soloEnGrafo.join(", ")}. No se borran porque tienen tramos.`);

  // Una ciudad nueva llega sin tramos: el administrador tiene que darlos de alta en POST /red/tramos
  const sinTramos = enPostgres
    .filter((c) => (grafoPorId.get(c.idCiudad)?.tramos ?? 0) === 0)
    .map((c) => c.idCiudad);
  if (sinTramos.length > 0) avisos.push(`Estas ciudades no tienen tramos de carretera y no se puede llegar a ellas: ${sinTramos.join(", ")}`);

  return { revisadas: enPostgres.length, copiadas: porCopiar.map((c) => c.idCiudad), soloEnGrafo, sinTramos };
}

async function reconciliarVehiculos(avisos: string[]): Promise<ResumenReconciliacion["vehiculos"]> {
  const enPostgres = await placasEnPostgres();
  if (enPostgres === null) {
    avisos.push("No se revisaron los vehículos: la tabla vehiculo todavía no existe en PostgreSQL");
    return null;
  }
  const enGrafo = await vehiculosEnGrafo();
  const placasEnGrafo = new Set(enGrafo.map((v) => v.placa));
  const placasPostgres = new Set(enPostgres);

  const porCopiar = enPostgres.filter((p) => !placasEnGrafo.has(p));
  await guardarVehiculos(porCopiar);

  // Si PostgreSQL no tiene ningún vehículo, lo más probable es que todavía no se carguen los datos.
  // Borrar toda la flota del grafo por eso sería peor que dejarla: se avisa y no se borra nada.
  let sobrantes = enGrafo.map((v) => v.placa).filter((p) => !placasPostgres.has(p));
  if (enPostgres.length === 0 && sobrantes.length > 0) {
    avisos.push("PostgreSQL no tiene vehículos; por seguridad no se borró ninguno del grafo");
    sobrantes = [];
  }
  await borrarVehiculos(sobrantes);

  const sinUbicacion = [...porCopiar, ...enGrafo.filter((v) => !v.ubicado && placasPostgres.has(v.placa)).map((v) => v.placa)];
  if (sinUbicacion.length > 0) avisos.push(`Estos vehículos no tienen ubicación en la red (PATCH /vehiculos/{placa}/ubicacion): ${sinUbicacion.join(", ")}`);

  return { revisados: enPostgres.length, copiados: porCopiar, borradosDelGrafo: sobrantes, sinUbicacion };
}

export async function reconciliar(): Promise<ResumenReconciliacion> {
  const inicio = Date.now();
  const avisos: string[] = [];
  // Una parte después de otra: si Neo4j o MongoDB fallan a la mitad, el error sale como 503 y lo
  // que ya se corrigió queda corregido (cada paso es idempotente, se puede volver a correr).
  const incidentes = await reconciliarIncidentes();
  const ciudades = await reconciliarCiudades(avisos);
  const vehiculos = await reconciliarVehiculos(avisos);
  return { incidentes, ciudades, vehiculos, avisos, duracionMs: Date.now() - inicio };
}
