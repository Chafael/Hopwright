import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";
import { env } from "../config/env.js";

export type UsuarioToken = { idUsuario: number; rol: "despachador" | "administrador"; correo: string };

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: UsuarioToken;
    user: UsuarioToken;
  }
}

export async function registrarAuth(app: FastifyInstance): Promise<void> {
  await app.register(jwt, { secret: env.jwtSecret });

  app.decorate("requiereRol", (...roles: UsuarioToken["rol"][]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "No autorizado", mensaje: "Token inválido o ausente", statusCode: 401 });
      }
      if (roles.length > 0 && !roles.includes(req.user.rol)) {
        return reply.code(403).send({ error: "Prohibido", mensaje: "No tienes permisos para esta operación", statusCode: 403 });
      }
    };
  });
}

declare module "fastify" {
  interface FastifyInstance {
    requiereRol: (...roles: UsuarioToken["rol"][]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
