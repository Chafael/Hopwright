// Cabecera con un token de administrador firmado por la misma app, para las rutas que piden sesión.
import type { FastifyInstance } from "fastify";

export const conAdmin = (app: FastifyInstance) => ({
  authorization: `Bearer ${app.jwt.sign({ idUsuario: 2, rol: "administrador", correo: "admin@hopwright.local" })}`,
});
