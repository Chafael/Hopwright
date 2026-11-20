// Reglas de los reportes de incidente que se revisan antes de guardar.
// Repiten lo que exige el validador de MongoDB (database/document/validators/reportes_incidente.js)
// para poder responder con un mensaje claro; el validador queda como última barrera.

export const TIPOS_INCIDENTE = ["Bloqueo", "Accidente", "Obra", "Derrumbe"] as const;
export type TipoIncidente = (typeof TIPOS_INCIDENTE)[number];

export const GRAVEDADES = ["Baja", "Media", "Alta"] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

// Un incidente solo puede estar en una ciudad (clave INEGI de 5 dígitos) o en una intersección (INT-...).
// En una estación de tren no aplica: la vía férrea no se bloquea en este modelo.
export function tipoDePunto(idPunto: string): "Ciudad" | "Interseccion" | null {
  if (/^[0-9]{5}$/.test(idPunto)) return "Ciudad";
  if (/^INT-[A-Z0-9]{2,10}$/.test(idPunto)) return "Interseccion";
  return null;
}

type Campo = { nombre: string; tipo: "texto" | "numero" | "booleano" | "fecha" | "opcion"; obligatorio: boolean; minimo?: number; opciones?: string[] };

const camposPorTipo: Record<TipoIncidente, Campo[]> = {
  Bloqueo: [
    { nombre: "causa", tipo: "opcion", obligatorio: true, opciones: ["Manifestación", "Retén", "Vehículo varado", "Otro"] },
    { nombre: "carrilesCerrados", tipo: "numero", obligatorio: true, minimo: 1 },
    { nombre: "pasoAlternado", tipo: "booleano", obligatorio: false },
  ],
  Accidente: [
    { nombre: "vehiculosInvolucrados", tipo: "numero", obligatorio: true, minimo: 1 },
    { nombre: "hayLesionados", tipo: "booleano", obligatorio: true },
    { nombre: "autoridadEnSitio", tipo: "booleano", obligatorio: false },
  ],
  Obra: [
    { nombre: "dependencia", tipo: "texto", obligatorio: true },
    { nombre: "fechaFinEstimada", tipo: "fecha", obligatorio: true },
    { nombre: "horario", tipo: "texto", obligatorio: false },
  ],
  Derrumbe: [
    { nombre: "volumenEstimadoM3", tipo: "numero", obligatorio: true, minimo: 0.1 },
    { nombre: "requiereMaquinaria", tipo: "booleano", obligatorio: true },
  ],
};

export function camposDelDetalle(tipo: TipoIncidente): string[] {
  return camposPorTipo[tipo].map((c) => c.nombre);
}

// Regresa la lista de problemas del detalle; vacía si está bien.
export function problemasDelDetalle(tipo: TipoIncidente, detalle: Record<string, unknown>): string[] {
  const campos = camposPorTipo[tipo];
  const problemas: string[] = [];

  for (const extra of Object.keys(detalle).filter((k) => !campos.some((c) => c.nombre === k))) {
    problemas.push(`El campo ${extra} no corresponde a un incidente de tipo ${tipo}`);
  }

  for (const campo of campos) {
    const valor = detalle[campo.nombre];
    if (valor === undefined || valor === null) {
      if (campo.obligatorio) problemas.push(`Falta ${campo.nombre}, obligatorio para un incidente de tipo ${tipo}`);
      continue;
    }
    switch (campo.tipo) {
      case "texto":
        if (typeof valor !== "string" || valor.trim().length < 2) problemas.push(`${campo.nombre} debe ser un texto de al menos 2 caracteres`);
        break;
      case "numero":
        if (typeof valor !== "number" || !Number.isFinite(valor)) problemas.push(`${campo.nombre} debe ser un número`);
        else if (campo.minimo !== undefined && valor < campo.minimo) problemas.push(`${campo.nombre} debe ser al menos ${campo.minimo}`);
        break;
      case "booleano":
        if (typeof valor !== "boolean") problemas.push(`${campo.nombre} debe ser true o false`);
        break;
      case "fecha":
        if (!(valor instanceof Date) && (typeof valor !== "string" || Number.isNaN(Date.parse(valor)))) problemas.push(`${campo.nombre} debe ser una fecha`);
        break;
      case "opcion":
        if (!campo.opciones!.includes(valor as string)) problemas.push(`${campo.nombre} debe ser una de: ${campo.opciones!.join(", ")}`);
        break;
    }
  }
  return problemas;
}

// Convierte las fechas que llegan como texto en Date, que es lo que exige el validador de MongoDB.
export function normalizarDetalle(tipo: TipoIncidente, detalle: Record<string, unknown>): Record<string, unknown> {
  const resultado = { ...detalle };
  for (const campo of camposPorTipo[tipo]) {
    if (campo.tipo === "fecha" && typeof resultado[campo.nombre] === "string") {
      resultado[campo.nombre] = new Date(resultado[campo.nombre] as string);
    }
  }
  return resultado;
}

// Formato de los identificadores: INC-0001, INC-0002, ...
export function formatearIdIncidente(numero: number): string {
  return `INC-${String(numero).padStart(4, "0")}`;
}
