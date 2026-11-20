// Corre las consultas de database/graph/tests/01_integridad.cypher contra Neo4j.
// Cada consulta cuenta las violaciones de una regla del modelo; todas deben dar 0.
// Requiere los contenedores arriba: docker compose up -d
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leer, cerrarNeo4j } from "../../backend/src/db/neo4j.js";

const archivo = fileURLToPath(new URL("../../database/graph/tests/01_integridad.cypher", import.meta.url));
// Primero se quitan los comentarios (pueden llevar ";") y luego se separa por consulta
const consultas = readFileSync(archivo, "utf-8")
  .split("\n")
  .filter((linea) => !linea.trim().startsWith("//"))
  .join("\n")
  .split(";")
  .map((c) => c.trim())
  .filter((c) => /\bRETURN\b/.test(c));

afterAll(async () => {
  await cerrarNeo4j();
});

describe("integridad de la base de grafos", () => {
  it("el archivo trae consultas", () => {
    expect(consultas.length).toBeGreaterThan(10);
  });

  it.each(consultas.map((c) => [c.match(/'([^']+)' AS prueba/)?.[1] ?? c.slice(0, 40), c]))("%s", async (_nombre, consulta) => {
    const filas = await leer<{ prueba: string; fallas: number }>(consulta);
    expect(filas).toHaveLength(1);
    expect(filas[0].fallas).toBe(0);
  });
});
