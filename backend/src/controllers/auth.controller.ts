import type { FastifyInstance } from "fastify";
import { respuestasError } from "../schemas/comunes.js";
import { validarCredenciales } from "../services/auth.service.js";

export async function rutasAuth(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { correo: string; password: string } }>(
    "/auth/login",
    {
      schema: {
        tags: ["Autenticación"],
        summary: "Inicia sesión y regresa un token JWT",
        body: {
          type: "object",
          required: ["correo", "password"],
          additionalProperties: false,
          properties: {
            correo: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["token"],
            properties: { token: { type: "string" } },
          },
          ...respuestasError(400, 404),
        },
      },
    },
    async (req) => {
      const usuario = await validarCredenciales(req.body.correo, req.body.password);
      const token = app.jwt.sign({ idUsuario: usuario.idUsuario, rol: usuario.rol, correo: usuario.correo });
      return { token };
    },
  );
}
