import { defineConfig } from "vitest/config";

// Las pruebas viven en la carpeta tests/ de la raíz del proyecto (unit, integration, e2e),
// como propone la guía. Se corren desde backend/ con `npm test`.
export default defineConfig({
  test: {
    dir: "../tests",
    include: ["**/*.test.ts"],
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
