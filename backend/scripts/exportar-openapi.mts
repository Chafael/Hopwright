// Exporta el contrato de la API (OpenAPI 3) a docs/api/openapi.json, para que se pueda revisar sin levantar
// el backend. Sale de los mismos esquemas de Fastify que validan cada ruta y que muestra Swagger en /docs.
// No necesita las bases de datos. Uso, desde backend/: npm run openapi

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "test";
const { construirApp } = await import("../src/server.js");

const app = await construirApp();
await app.ready();
const contrato = app.swagger();
const destino = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/api/openapi.json");
writeFileSync(destino, JSON.stringify(contrato, null, 2) + "\n");
console.log(`Contrato con ${Object.keys(contrato.paths ?? {}).length} rutas guardado en docs/api/openapi.json`);
await app.close().catch(() => undefined);
process.exit(0);
