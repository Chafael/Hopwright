// Errores de la aplicación. Los servicios lanzan uno de estos y el manejador global de server.ts
// los convierte en la respuesta { error, mensaje, statusCode } con el código HTTP correcto.

export class ErrorApp extends Error {
  readonly statusCode: number;
  readonly detalles?: unknown;

  constructor(statusCode: number, nombre: string, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.statusCode = statusCode;
    this.name = nombre;
    this.detalles = detalles;
  }
}

// 400: los datos llegaron con el formato correcto pero no cumplen una regla de negocio
export class DatosInvalidos extends ErrorApp {
  constructor(mensaje: string, detalles?: unknown) {
    super(400, "Datos inválidos", mensaje, detalles);
  }
}

// 404: lo que se busca no existe
export class NoEncontrado extends ErrorApp {
  constructor(mensaje: string) {
    super(404, "No encontrado", mensaje);
  }
}

// 409: la operación choca con el estado actual (duplicado, vehículo ya asignado, etc.)
export class Conflicto extends ErrorApp {
  constructor(mensaje: string, detalles?: unknown) {
    super(409, "Conflicto", mensaje, detalles);
  }
}

// 503: una base de datos no respondió
export class ServicioNoDisponible extends ErrorApp {
  constructor(mensaje: string) {
    super(503, "Servicio no disponible", mensaje);
  }
}

// Reconoce los errores de conexión de los tres drivers: PostgreSQL (ECONNREFUSED, timeout),
// Neo4j (ServiceUnavailable) y MongoDB (MongoServerSelectionError).
// Lo usa el manejador global para responder 503, y los servicios que deben seguir aunque una base esté caída
// (por ejemplo, guardar un incidente en MongoDB aunque Neo4j no responda).
export function esBaseCaida(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const codigo = (error as { code?: unknown }).code;
  return (
    codigo === "ECONNREFUSED" ||
    codigo === "ServiceUnavailable" ||
    codigo === "SessionExpired" ||
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    /Connection terminated|timeout exceeded when trying to connect/i.test(error.message)
  );
}
