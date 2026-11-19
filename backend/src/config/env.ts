import { config as cargarEnv } from "dotenv";
import { resolve } from "node:path";

// El .env vive en la raíz del proyecto (un nivel arriba de backend/), junto al docker-compose,
// para que las bases y el backend usen las mismas credenciales.
cargarEnv({ path: resolve(process.cwd(), "../.env") });
cargarEnv(); // también acepta un .env dentro de backend/ si alguien lo prefiere

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (usa .env.example como guía).`);
  }
  return valor;
}

function numero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (!valor) return porDefecto;
  const n = Number(valor);
  if (Number.isNaN(n)) throw new Error(`La variable ${nombre} debe ser un número y vale "${valor}".`);
  return n;
}

export const env = {
  port: numero("PORT", 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  postgres: {
    host: requerida("PG_HOST"),
    port: numero("PG_PORT", 5432),
    database: requerida("PG_DATABASE"),
    user: requerida("PG_USER"),
    password: requerida("PG_PASSWORD"),
  },
  mongo: {
    host: requerida("MONGO_HOST"),
    port: numero("MONGO_PORT", 27017),
    database: requerida("MONGO_DATABASE"),
    user: requerida("MONGO_USER"),
    password: requerida("MONGO_PASSWORD"),
  },
  neo4j: {
    host: requerida("NEO4J_HOST"),
    port: numero("NEO4J_BOLT_PORT", 7687),
    user: requerida("NEO4J_USER"),
    password: requerida("NEO4J_PASSWORD"),
  },
} as const;
