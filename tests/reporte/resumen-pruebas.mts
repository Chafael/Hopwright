// Convierte los reportes JSON de Vitest en docs/pruebas/pruebas-automatizadas.md: cuántas pruebas pasaron,
// por carpeta (unitarias, integración, extremo a extremo, consistencia) y la lista de cada una con su resultado.
// Lo corre `npm run pruebas:reporte` después de generar los JSON; no se usa solo.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

type Asercion = { ancestorTitles: string[]; title: string; status: string; duration?: number };
type Archivo = { name: string; status: string; assertionResults: Asercion[] };
type Reporte = { numTotalTests: number; numPassedTests: number; numFailedTests: number; startTime: number; testResults: Archivo[] };

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const carpeta = resolve(raiz, "docs/pruebas");
const reportes = ["vitest.json", "vitest-consistencia.json"]
  .map((f) => resolve(carpeta, f))
  .filter((f) => existsSync(f))
  .map((f) => JSON.parse(readFileSync(f, "utf8")) as Reporte);

const archivos = reportes.flatMap((r) => r.testResults).sort((a, b) => a.name.localeCompare(b.name));
const grupos: Record<string, string> = {
  unit: "Unitarias (sin bases de datos)",
  integration: "Integración (contra las tres bases en Docker)",
  e2e: "Extremo a extremo (flujo integrado)",
  consistencia: "Consistencia entre bases (apagan Neo4j)",
};
const grupoDe = (archivo: string) => relative(resolve(raiz, "tests"), archivo).split(/[\\/]/)[0];

const total = archivos.reduce((s, a) => s + a.assertionResults.length, 0);
const pasaron = archivos.reduce((s, a) => s + a.assertionResults.filter((t) => t.status === "passed").length, 0);
let commit = "desconocido";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: raiz, encoding: "utf8" }).trim();
} catch {
  // sin git, se queda como desconocido
}
const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

const lineas: string[] = [
  "# Pruebas automatizadas",
  "",
  `Generado por \`npm run pruebas:reporte\` el ${fecha}, commit \`${commit}\`, con las tres bases en Docker y los datos de prueba recién cargados.`,
  "",
  `Resultado: ${pasaron} de ${total} pruebas pasaron.`,
  "",
  "| Grupo | Archivos | Pruebas | Pasaron |",
  "|---|---|---|---|",
];
for (const [clave, nombre] of Object.entries(grupos)) {
  const delGrupo = archivos.filter((a) => grupoDe(a.name) === clave);
  if (delGrupo.length === 0) continue;
  const pruebas = delGrupo.flatMap((a) => a.assertionResults);
  lineas.push(`| ${nombre} | ${delGrupo.length} | ${pruebas.length} | ${pruebas.filter((t) => t.status === "passed").length} |`);
}
lineas.push("");

for (const [clave, nombre] of Object.entries(grupos)) {
  const delGrupo = archivos.filter((a) => grupoDe(a.name) === clave);
  if (delGrupo.length === 0) continue;
  lineas.push(`## ${nombre}`, "");
  for (const a of delGrupo) {
    lineas.push(`### ${relative(raiz, a.name).replace(/\\/g, "/")}`, "");
    for (const t of a.assertionResults) {
      const marca = t.status === "passed" ? "pasó" : t.status === "failed" ? "FALLÓ" : t.status;
      const ms = t.duration !== undefined ? ` (${Math.round(t.duration)} ms)` : "";
      lineas.push(`- ${marca}: ${[...t.ancestorTitles, t.title].join(" › ")}${ms}`);
    }
    lineas.push("");
  }
}

writeFileSync(resolve(carpeta, "pruebas-automatizadas.md"), lineas.join("\n"));
console.log(`${pasaron} de ${total} pruebas pasaron. Reporte en docs/pruebas/pruebas-automatizadas.md`);
if (pasaron !== total) process.exitCode = 1;
