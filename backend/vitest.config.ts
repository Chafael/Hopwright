import { defineConfig } from "vitest/config";

// Las pruebas viven en la carpeta tests/ de la raíz del proyecto (unit, integration, e2e),
// como propone la guía. Se corren desde backend/ con `npm test`.
export default defineConfig({
  test: {
    dir: "../tests",
    include: ["**/*.test.ts"],
    // La prueba de consistencia apaga Neo4j; se corre aparte con npm run test:consistencia
    exclude: ["**/node_modules/**", "consistencia/**"],
    environment: "node",
    globals: true,
    env: { NODE_ENV: "test" },
    // Las pruebas de integración abren conexiones reales a las tres bases
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Las pruebas de integración comparten las mismas bases; corren una después de otra
    fileParallelism: false,
  },
});
