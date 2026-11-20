import { Conflicto, DatosInvalidos, NoEncontrado, esBaseCaida } from "../errores.js";
import { buscarPunto, type PuntoRuta } from "../repositories/graph/rutas.repository.js";
import { guardarIncidenteEnGrafo } from "../repositories/graph/incidentes.repository.js";
import {
  agregarEvidencia,
  buscarReporte,
  cerrarReporte,
  insertarReporte,
  listarReportes,
  marcarSincronizado,
  siguienteNumeroIncidente,
  type Evidencia,
  type FiltroIncidentes,
  type ReporteIncidente,
} from "../repositories/document/incidentes.repository.js";
import { formatearIdIncidente, normalizarDetalle, problemasDelDetalle, tipoDePunto, type Gravedad, type TipoIncidente } from "./incidentes.reglas.js";

// Cómo se mantiene sincronizado un incidente entre MongoDB y Neo4j:
// 1. Se guarda el reporte en MongoDB (fuente de verdad) con sincronizado: false.
// 2. Se crea o actualiza la réplica en Neo4j (Incidente y su arista BLOQUEA).
// 3. Si Neo4j respondió, se marca sincronizado: true y se responde 201 (o 200 al cerrar).
//    Si Neo4j está caído, el reporte ya quedó guardado: se responde 202 con un aviso, y
//    POST /admin/reconciliar copia después los que se quedaron con sincronizado: false.
// No se usa una transacción entre las dos bases porque no existe una que abarque MongoDB y Neo4j;
// el campo sincronizado es lo que permite detectar y corregir la diferencia.

export type ResultadoEscritura = { codigo: 200 | 201 | 202; incidente: ReporteIncidente; aviso?: string };

const AVISO_SIN_GRAFO =
  "El reporte se guardó, pero Neo4j no respondió y el cálculo de rutas todavía no lo toma en cuenta. Se copiará al reconciliar (POST /admin/reconciliar).";

async function copiarAlGrafo(reporte: ReporteIncidente): Promise<boolean> {
  try {
    const guardado = await guardarIncidenteEnGrafo({
      idIncidente: reporte.idIncidente,
      gravedad: reporte.gravedad,
      activo: reporte.activo,
      idPunto: reporte.idPunto,
    });
    if (!guardado) return false; // el punto ya no existe en la red; lo detecta la reconciliación
    await marcarSincronizado(reporte.idIncidente);
    reporte.sincronizado = true;
    return true;
  } catch (error) {
    if (esBaseCaida(error)) return false;
    throw error;
  }
}

export type NuevoIncidente = {
  tipo: TipoIncidente;
  idPunto: string;
  gravedad: Gravedad;
  descripcion: string;
  fechaInicio?: string;
  detalle: Record<string, unknown>;
  evidencias?: { tipo: "Foto" | "Testimonio"; url?: string; texto?: string; autor?: string; fecha?: string }[];
  reportadoPor: string;
};

export async function reportarIncidente(entrada: NuevoIncidente): Promise<ResultadoEscritura> {
  const tipoPunto = tipoDePunto(entrada.idPunto);
  if (!tipoPunto) throw new DatosInvalidos("idPunto debe ser la clave INEGI de una ciudad (5 dígitos) o el id de una intersección (INT-...)");

  const problemas = problemasDelDetalle(entrada.tipo, entrada.detalle);
  for (const [i, e] of (entrada.evidencias ?? []).entries()) {
    if (e.tipo === "Foto" && !e.url) problemas.push(`La evidencia ${i + 1} es una foto y no trae url`);
    if (e.tipo === "Testimonio" && !e.texto) problemas.push(`La evidencia ${i + 1} es un testimonio y no trae texto`);
  }
  if (problemas.length > 0) throw new DatosInvalidos(`El reporte de tipo ${entrada.tipo} tiene datos incompletos o inválidos`, problemas);

  const ahora = new Date();
  const fechaInicio = entrada.fechaInicio ? new Date(entrada.fechaInicio) : ahora;
  if (fechaInicio.getTime() > Date.now() + 5 * 60_000) throw new DatosInvalidos("La fecha de inicio no puede estar en el futuro");

  // Se revisa que el punto exista en la red. Si Neo4j está caído no se puede revisar,
  // pero el reporte se guarda de todos modos: perder el reporte sería peor.
  let punto: PuntoRuta | null | undefined;
  try {
    punto = await buscarPunto(entrada.idPunto);
  } catch (error) {
    if (!esBaseCaida(error)) throw error;
    punto = undefined;
  }
  if (punto === null) throw new NoEncontrado(`El punto ${entrada.idPunto} no existe en la red`);

  const reporte: ReporteIncidente = {
    idIncidente: formatearIdIncidente(await siguienteNumeroIncidente()),
    tipo: entrada.tipo,
    idPunto: entrada.idPunto,
    tipoPunto,
    gravedad: entrada.gravedad,
    descripcion: entrada.descripcion.trim(),
    fechaInicio,
    detalle: normalizarDetalle(entrada.tipo, entrada.detalle),
    evidencias: (entrada.evidencias ?? []).map((e) => ({ ...e, fecha: e.fecha ? new Date(e.fecha) : ahora })),
    activo: true,
    sincronizado: false,
    reportadoPor: entrada.reportadoPor.trim(),
    creadoEn: ahora,
  };
  await insertarReporte(reporte);

  // Si Neo4j ya había fallado al buscar el punto, no se vuelve a intentar: se responde rápido
  const sincronizado = punto !== undefined && (await copiarAlGrafo(reporte));
  return sincronizado ? { codigo: 201, incidente: reporte } : { codigo: 202, incidente: reporte, aviso: AVISO_SIN_GRAFO };
}

export async function cerrarIncidente(idIncidente: string, cierre: { motivoCierre?: string; fechaFin?: string }): Promise<ResultadoEscritura> {
  const actual = await buscarReporte(idIncidente);
  if (!actual) throw new NoEncontrado(`El incidente ${idIncidente} no existe`);
  if (!actual.activo) throw new Conflicto(`El incidente ${idIncidente} ya estaba cerrado`);

  const fechaFin = cierre.fechaFin ? new Date(cierre.fechaFin) : new Date();
  if (fechaFin < actual.fechaInicio) throw new DatosInvalidos("La fecha de fin no puede ser anterior a la de inicio");

  const cerrado = await cerrarReporte(idIncidente, { fechaFin, ...(cierre.motivoCierre ? { motivoCierre: cierre.motivoCierre.trim() } : {}) });
  // null: otra petición lo cerró entre la lectura y la escritura
  if (!cerrado) throw new Conflicto(`El incidente ${idIncidente} ya estaba cerrado`);

  const sincronizado = await copiarAlGrafo(cerrado);
  return sincronizado ? { codigo: 200, incidente: cerrado } : { codigo: 202, incidente: cerrado, aviso: AVISO_SIN_GRAFO };
}

export async function consultarIncidente(idIncidente: string): Promise<ReporteIncidente> {
  const reporte = await buscarReporte(idIncidente);
  if (!reporte) throw new NoEncontrado(`El incidente ${idIncidente} no existe`);
  return reporte;
}

export async function listarIncidentes(filtro: FiltroIncidentes, limite = 50): Promise<ReporteIncidente[]> {
  return listarReportes(filtro, limite);
}

// Las evidencias solo viven en MongoDB, así que agregar una no toca el grafo
export async function nuevaEvidencia(idIncidente: string, evidencia: Omit<Evidencia, "fecha"> & { fecha?: string }): Promise<ReporteIncidente> {
  if (evidencia.tipo === "Foto" && !evidencia.url) throw new DatosInvalidos("Una evidencia de tipo Foto necesita url");
  if (evidencia.tipo === "Testimonio" && !evidencia.texto) throw new DatosInvalidos("Una evidencia de tipo Testimonio necesita texto");
  const actualizado = await agregarEvidencia(idIncidente, { ...evidencia, fecha: evidencia.fecha ? new Date(evidencia.fecha) : new Date() });
  if (!actualizado) throw new NoEncontrado(`El incidente ${idIncidente} no existe`);
  return actualizado;
}
