import { defineConfig } from "vitest/config";

// Prueba de consistencia entre bases: apaga y enciende el contenedor de Neo4j con docker.
// Va aparte porque tarda alrededor de un minuto y deja Neo4j sin servicio mientras corre.
// Uso: npm run test:consistencia (con los contenedores arriba)
export default defineConfig({
  test: {
    dir: "../tests",
    include: ["consistencia/**/*.test.ts"],
    environment: "node",
    globals: true,
    env: { NODE_ENV: "test" },
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
