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
