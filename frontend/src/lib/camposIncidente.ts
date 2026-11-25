import type { TipoIncidente } from "./api";

// Los campos del detalle de cada tipo de incidente. Son los mismos que exige el validador de
// reportes_incidente en MongoDB y backend/src/services/incidentes.reglas.ts.
export type Campo = {
  nombre: string;
  etiqueta: string;
  tipo: "texto" | "numero" | "booleano" | "fecha" | "opcion";
  obligatorio: boolean;
  minimo?: number;
  opciones?: string[];
};

export const camposPorTipo: Record<TipoIncidente, Campo[]> = {
  Bloqueo: [
    { nombre: "causa", etiqueta: "Causa", tipo: "opcion", obligatorio: true, opciones: ["Manifestación", "Retén", "Vehículo varado", "Otro"] },
    { nombre: "carrilesCerrados", etiqueta: "Carriles cerrados", tipo: "numero", obligatorio: true, minimo: 1 },
    { nombre: "pasoAlternado", etiqueta: "Hay paso alternado", tipo: "booleano", obligatorio: false },
  ],
  Accidente: [
    { nombre: "vehiculosInvolucrados", etiqueta: "Vehículos involucrados", tipo: "numero", obligatorio: true, minimo: 1 },
    { nombre: "hayLesionados", etiqueta: "Hay lesionados", tipo: "booleano", obligatorio: true },
    { nombre: "autoridadEnSitio", etiqueta: "La autoridad ya está en el lugar", tipo: "booleano", obligatorio: false },
  ],
  Obra: [
    { nombre: "dependencia", etiqueta: "Dependencia a cargo", tipo: "texto", obligatorio: true },
    { nombre: "fechaFinEstimada", etiqueta: "Termina aproximadamente", tipo: "fecha", obligatorio: true },
    { nombre: "horario", etiqueta: "Horario de trabajo", tipo: "texto", obligatorio: false },
  ],
  Derrumbe: [
    { nombre: "volumenEstimadoM3", etiqueta: "Volumen estimado (m³)", tipo: "numero", obligatorio: true, minimo: 0.1 },
    { nombre: "requiereMaquinaria", etiqueta: "Se necesita maquinaria", tipo: "booleano", obligatorio: true },
  ],
};

// Texto legible de un valor del detalle para la vista del incidente
export function valorLegible(campo: Campo | undefined, valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (campo?.tipo === "fecha" && typeof valor === "string") return new Date(valor).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return String(valor);
}
