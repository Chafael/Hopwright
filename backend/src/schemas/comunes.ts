// Esquemas que comparten varias rutas. Se usan dentro de `schema.response` para que Swagger
// documente también las respuestas de error.

export const esquemaError = {
  type: "object",
  required: ["error", "mensaje", "statusCode"],
  properties: {
    error: { type: "string", examples: ["No encontrado"] },
    mensaje: { type: "string", examples: ["La ciudad 07999 no existe"] },
    statusCode: { type: "integer", examples: [404] },
    detalles: {},
  },
} as const;

// Devuelve { 400: esquemaError, 404: esquemaError, ... } para los códigos que se le pasen.
// Marca en Swagger que la ruta pide token (botón "Authorize"). Va junto con preHandler: app.requiereRol(...)
export const conToken = [{ bearerAuth: [] }];

// Uso: response: { 200: miRespuesta, ...respuestasError(400, 404) }
export function respuestasError(...codigos: number[]): Record<number, typeof esquemaError> {
  return Object.fromEntries(codigos.map((c) => [c, esquemaError]));
}

// Clave de municipio del INEGI: 5 dígitos, por ejemplo "07101" (Tuxtla Gutiérrez)
export const esquemaIdCiudad = {
  type: "string",
  pattern: "^[0-9]{5}$",
  description: "Clave de municipio del INEGI, 5 dígitos",
  examples: ["07101"],
} as const;

// Mismo formato que exigen la tabla envio de PostgreSQL y los validadores de manifiestos y bitacora_envio
export const esquemaIdEnvio = {
  type: "string",
  pattern: "^E-[0-9]+$",
  description: "Identificador del envío: E- seguido de dígitos",
  examples: ["E-101"],
} as const;

export const paramsIdEnvio = {
  type: "object",
  required: ["id"],
  properties: { id: esquemaIdEnvio },
} as const;
