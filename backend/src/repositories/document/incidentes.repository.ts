import type { Filter } from "mongodb";
import { mongoDb } from "../../db/mongo.js";
import type { Gravedad, TipoIncidente } from "../../services/incidentes.reglas.js";

// Acceso a la colección reportes_incidente (fuente de verdad de los incidentes).

export type Evidencia = { tipo: "Foto" | "Testimonio"; url?: string; texto?: string; autor?: string; fecha: Date };

export type ReporteIncidente = {
  idIncidente: string;
  tipo: TipoIncidente;
  idPunto: string;
  tipoPunto: "Ciudad" | "Interseccion";
  gravedad: Gravedad;
  descripcion: string;
  fechaInicio: Date;
  fechaFin?: Date;
  motivoCierre?: string;
  detalle: Record<string, unknown>;
  evidencias: Evidencia[];
  activo: boolean;
  sincronizado: boolean;
  reportadoPor: string;
  creadoEn: Date;
  actualizadoEn?: Date;
};

export type FiltroIncidentes = { activo?: boolean; gravedad?: Gravedad; tipo?: TipoIncidente; idPunto?: string; sincronizado?: boolean };

async function coleccion() {
  return (await mongoDb()).collection<ReporteIncidente>("reportes_incidente");
}

// Nunca se regresa el _id de MongoDB: el identificador del dominio es idIncidente
const sinId = { projection: { _id: 0 } } as const;

// Siguiente número de incidente. $inc es atómico, así que dos reportes simultáneos no comparten número.
export async function siguienteNumeroIncidente(): Promise<number> {
  const contadores = (await mongoDb()).collection<{ _id: string; valor: number }>("contadores");
  const doc = await contadores.findOneAndUpdate({ _id: "incidentes" }, { $inc: { valor: 1 } }, { upsert: true, returnDocument: "after" });
  return doc!.valor;
}

export async function insertarReporte(reporte: ReporteIncidente): Promise<void> {
  // insertOne agrega _id al objeto que recibe; se le pasa una copia para no ensuciar el original
  await (await coleccion()).insertOne({ ...reporte });
}

export async function buscarReporte(idIncidente: string): Promise<ReporteIncidente | null> {
  return (await coleccion()).findOne({ idIncidente }, sinId);
}

export async function listarReportes(filtro: FiltroIncidentes, limite: number): Promise<ReporteIncidente[]> {
  const consulta: Filter<ReporteIncidente> = {};
  if (filtro.activo !== undefined) consulta.activo = filtro.activo;
  if (filtro.gravedad) consulta.gravedad = filtro.gravedad;
  if (filtro.tipo) consulta.tipo = filtro.tipo;
  if (filtro.idPunto) consulta.idPunto = filtro.idPunto;
  if (filtro.sincronizado !== undefined) consulta.sincronizado = filtro.sincronizado;
  return (await coleccion()).find(consulta, sinId).sort({ fechaInicio: -1 }).limit(limite).toArray();
}

// Cierra el incidente solo si sigue activo. Regresa el reporte ya cerrado, o null si no estaba activo.
// La condición activo: true en el filtro evita que dos cierres simultáneos pisen la fecha de fin.
export async function cerrarReporte(idIncidente: string, cierre: { fechaFin: Date; motivoCierre?: string }): Promise<ReporteIncidente | null> {
  return (await coleccion()).findOneAndUpdate(
    { idIncidente, activo: true },
    { $set: { activo: false, sincronizado: false, actualizadoEn: new Date(), ...cierre } },
    { returnDocument: "after", ...sinId },
  );
}

export async function marcarSincronizado(idIncidente: string): Promise<void> {
  await (await coleccion()).updateOne({ idIncidente }, { $set: { sincronizado: true } });
}

export async function agregarEvidencia(idIncidente: string, evidencia: Evidencia): Promise<ReporteIncidente | null> {
  return (await coleccion()).findOneAndUpdate(
    { idIncidente },
    { $push: { evidencias: evidencia }, $set: { actualizadoEn: new Date() } },
    { returnDocument: "after", ...sinId },
  );
}
