// Evidencia de la implementación de las tres bases (Entregable 4).
//
// Corre dentro de cada contenedor los scripts de consultas y de pruebas que están en database/
// (psql, mongosh y cypher-shell, los mismos que se pueden correr a mano) y guarda lo que imprimen en
// docs/pruebas/implementacion-evidencia.md, con un resumen de cuántas pruebas cumplen.
//
// Uso, desde backend/ y con los contenedores arriba:
//   npm run bases
// Para comprobar además que las tres bases se construyen desde cero (BORRA los volúmenes y los vuelve a crear
// con los scripts de database/, igual que la primera vez):
//   npm run bases -- --desde-cero

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Carga el .env de la raíz igual que el backend
await import("../../backend/src/config/env.js");

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const desdeCero = process.argv.includes("--desde-cero");
const e = process.env;

type Salida = { codigo: number; texto: string; ms: number };

function correr(comando: string, args: string[], entrada?: string): Salida {
  const inicio = performance.now();
  try {
    const texto = execFileSync(comando, args, { cwd: raiz, input: entrada, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 });
    return { codigo: 0, texto, ms: Math.round(performance.now() - inicio) };
  } catch (error: any) {
    const texto = `${error.stdout ?? ""}${error.stderr ? `\n${error.stderr}` : ""}`;
    return { codigo: typeof error.status === "number" ? error.status : 1, texto, ms: Math.round(performance.now() - inicio) };
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const psql = (sql: string) => correr("docker", ["exec", "-i", "hopwright-postgres", "psql", "-U", e.PG_USER!, "-d", e.PG_DATABASE!, "-P", "pager=off", "-v", "ON_ERROR_STOP=1"], sql);
const mongosh = (archivo: string) => {
  const destino = `/tmp/hopwright-${basename(archivo)}`;
  const copia = correr("docker", ["cp", resolve(raiz, archivo), `hopwright-mongo:${destino}`]);
  if (copia.codigo !== 0) return copia;
  const r = correr("docker", ["exec", "hopwright-mongo", "mongosh", "-u", e.MONGO_USER!, "-p", e.MONGO_PASSWORD!, "--authenticationDatabase", "admin", e.MONGO_DATABASE!, "--quiet", "--file", destino]);
  correr("docker", ["exec", "hopwright-mongo", "rm", "-f", destino]);
  return r;
};
const mongoEval = (js: string) => correr("docker", ["exec", "hopwright-mongo", "mongosh", "-u", e.MONGO_USER!, "-p", e.MONGO_PASSWORD!, "--authenticationDatabase", "admin", e.MONGO_DATABASE!, "--quiet", "--eval", js]);
const cypher = (archivo: string, parametros?: string) =>
  correr(
    "docker",
    ["exec", "-i", "hopwright-neo4j", "cypher-shell", "-u", e.NEO4J_USER!, "-p", e.NEO4J_PASSWORD!, "--format", "plain", "--fail-at-end", ...(parametros ? ["-P", parametros] : [])],
    readFileSync(resolve(raiz, archivo), "utf8"),
  );

// Espera hasta que la prueba pase tres veces seguidas: los contenedores de PostgreSQL y MongoDB corren sus scripts
// de carga con un servidor temporal y luego se reinician, así que un solo éxito puede caer antes del reinicio.
async function esperarListo(nombre: string, prueba: () => boolean, limiteSeg = 300) {
  let seguidas = 0;
  const fin = Date.now() + limiteSeg * 1000;
  while (Date.now() < fin) {
    seguidas = prueba() ? seguidas + 1 : 0;
    if (seguidas >= 3) return;
    await esperar(2000);
  }
  throw new Error(`${nombre} no quedó lista en ${limiteSeg} segundos`);
}

const secciones: { titulo: string; descripcion: string; comando: string; salida: Salida; resumen?: string }[] = [];
const resumenes: string[] = [];

if (desdeCero) {
  console.log("Borrando los volúmenes y levantando las bases desde cero...");
  const abajo = correr("docker", ["compose", "down", "-v"]);
  const arriba = correr("docker", ["compose", "up", "-d"]);
  if (arriba.codigo !== 0) throw new Error(`docker compose up falló:\n${arriba.texto}`);
  await esperarListo("PostgreSQL", () => psql("SELECT count(*) FROM ciudad;").texto.includes("124"));
  await esperarListo("MongoDB", () => mongoEval("print(db.manifiestos.countDocuments())").texto.trim() === "6");
  await esperarListo("El contenedor neo4j-init", () => correr("docker", ["inspect", "-f", "{{.State.Status}} {{.State.ExitCode}}", "hopwright-neo4j-init"]).texto.trim() === "exited 0");
  const registro = [
    "$ docker compose down -v",
    abajo.texto.trim(),
    "$ docker compose up -d",
    arriba.texto.trim(),
    "",
    "$ docker logs hopwright-postgres (líneas de la carga)",
    ...correr("docker", ["logs", "hopwright-postgres"]).texto.split("\n").filter((l) => /Ejecutando|CREATE TABLE|INSERT 0/.test(l)),
    "",
    "$ docker logs hopwright-mongo (líneas de la carga)",
    ...correr("docker", ["logs", "hopwright-mongo"]).texto.split("\n").filter((l) => /Creando colección|Cargando/.test(l)),
    "",
    "$ docker logs hopwright-neo4j-init",
    ...correr("docker", ["logs", "hopwright-neo4j-init"]).texto.split("\n").filter((l) => l.trim() !== ""),
  ].join("\n");
  secciones.push({
    titulo: "Construcción desde cero",
    descripcion: "Se borraron los volúmenes y se levantaron los contenedores. Cada uno corrió sus scripts de esquema y datos en orden.",
    comando: "docker compose down -v && docker compose up -d",
    salida: { codigo: arriba.codigo, texto: registro, ms: abajo.ms + arriba.ms },
  });
  console.log("Bases listas.");
}

// ---------- PostgreSQL ----------
const pgPruebas = psql(readFileSync(resolve(raiz, "database/relational/tests/01_integridad.sql"), "utf8"));
const pgCumplen = pgPruebas.texto.match(/^\s*(\d+)\s*\|\s*(\d+)\s*$/m);
const pgResumen = pgCumplen ? `${pgCumplen[1]} de ${pgCumplen[2]} pruebas cumplen` : "no se pudo leer el resultado";
resumenes.push(`PostgreSQL, pruebas de humo, integridad, cardinalidad y transacciones: ${pgResumen}.`);
secciones.push({
  titulo: "PostgreSQL: pruebas de humo, integridad, cardinalidad y transacciones",
  descripcion: "database/relational/tests/01_integridad.sql",
  comando: "docker exec -i hopwright-postgres psql -U <usuario> -d <base> < database/relational/tests/01_integridad.sql",
  salida: pgPruebas,
  resumen: pgResumen,
});
const pgConsultas = psql(readFileSync(resolve(raiz, "database/relational/queries/consultas.sql"), "utf8"));
resumenes.push(`PostgreSQL, consultas representativas: ${pgConsultas.codigo === 0 ? "las 11 corrieron sin error" : "hubo un error, ver la salida"}.`);
secciones.push({
  titulo: "PostgreSQL: consultas representativas",
  descripcion: "database/relational/queries/consultas.sql",
  comando: "docker exec -i hopwright-postgres psql -U <usuario> -d <base> < database/relational/queries/consultas.sql",
  salida: pgConsultas,
});

// ---------- MongoDB ----------
const mgPruebas = mongosh("database/document/tests/01_validacion.js");
const mgCumplen = mgPruebas.texto.match(/(\d+) de (\d+) pruebas cumplen/);
const mgResumen = mgCumplen ? `${mgCumplen[1]} de ${mgCumplen[2]} pruebas cumplen` : "no se pudo leer el resultado";
resumenes.push(`MongoDB, pruebas de humo, documentos válidos e inválidos e índices: ${mgResumen}.`);
secciones.push({
  titulo: "MongoDB: pruebas de humo, documentos válidos e inválidos",
  descripcion: "database/document/tests/01_validacion.js",
  comando: "docker exec hopwright-mongo mongosh -u <usuario> -p <contraseña> --authenticationDatabase admin <base> --quiet --file 01_validacion.js",
  salida: mgPruebas,
  resumen: mgResumen,
});
for (const archivo of ["01_consultas_incidentes.js", "02_consultas_manifiestos.js", "03_consultas_bitacora.js"]) {
  const r = mongosh(`database/document/queries/${archivo}`);
  resumenes.push(`MongoDB, ${archivo}: ${r.codigo === 0 ? "corrió sin error" : "hubo un error, ver la salida"}.`);
  secciones.push({
    titulo: `MongoDB: ${archivo.replace(/^\d+_/, "").replace(".js", "").replace(/_/g, " ")}`,
    descripcion: `database/document/queries/${archivo}`,
    comando: `docker exec hopwright-mongo mongosh ... --quiet --file ${archivo}`,
    salida: r,
  });
}

// ---------- Neo4j ----------
const n4Humo = cypher("database/graph/tests/00_humo.cypher");
resumenes.push(`Neo4j, prueba de humo: ${n4Humo.codigo === 0 ? "corrió sin error" : "hubo un error, ver la salida"}.`);
secciones.push({
  titulo: "Neo4j: prueba de humo",
  descripcion: "database/graph/tests/00_humo.cypher",
  comando: "docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> < database/graph/tests/00_humo.cypher",
  salida: n4Humo,
});
const n4Integridad = cypher("database/graph/tests/01_integridad.cypher");
// Cada fila es "nombre de la prueba", fallas
const filas = [...n4Integridad.texto.matchAll(/^"(.+)", (\d+)\s*$/gm)];
const n4Resumen = filas.length > 0 ? `${filas.filter((f) => f[2] === "0").length} de ${filas.length} pruebas sin fallas` : "no se pudo leer el resultado";
resumenes.push(`Neo4j, pruebas de integridad y cardinalidad: ${n4Resumen}.`);
secciones.push({
  titulo: "Neo4j: pruebas de integridad y cardinalidad",
  descripcion: "database/graph/tests/01_integridad.cypher",
  comando: "docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> < database/graph/tests/01_integridad.cypher",
  salida: n4Integridad,
  resumen: n4Resumen,
});
const n4Consultas = cypher("database/graph/queries/01_consultas_rutas.cypher", "{origen: '07101', destino: '07009'}");
resumenes.push(`Neo4j, consultas representativas: ${n4Consultas.codigo === 0 ? "corrieron sin error" : "hubo un error, ver la salida"}.`);
secciones.push({
  titulo: "Neo4j: consultas representativas",
  descripcion: "database/graph/queries/01_consultas_rutas.cypher, con origen Tuxtla (07101) y destino Arriaga (07009)",
  comando: "docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> -P \"{origen: '07101', destino: '07009'}\" < database/graph/queries/01_consultas_rutas.cypher",
  salida: n4Consultas,
});

// ---------- Reporte ----------
const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
const commit = correr("git", ["rev-parse", "--short", "HEAD"]).texto.trim() || "desconocido";
const md = [
  "# Evidencia de la implementación de las bases",
  "",
  `Generado por \`npm run bases${desdeCero ? " -- --desde-cero" : ""}\` (tests/implementacion/evidencia.mts) el ${fecha}, commit \`${commit}\`. Cada sección es la salida tal cual de un script de \`database/\` corrido dentro de su contenedor.`,
  "",
  desdeCero ? "Antes de correr las pruebas se borraron los volúmenes y las tres bases se construyeron desde cero con los scripts del repositorio." : "Las pruebas corrieron sobre las bases como estaban; para construirlas desde cero antes, se usa `npm run bases -- --desde-cero`.",
  "",
  "## Resumen",
  "",
  ...resumenes.map((r) => `- ${r}`),
  "",
  ...secciones.flatMap((s) => [
    `## ${s.titulo}`,
    "",
    `Archivo: \`${s.descripcion}\`. Comando: \`${s.comando}\`. Código de salida ${s.salida.codigo}, ${s.salida.ms} ms.${s.resumen ? ` Resultado: ${s.resumen}.` : ""}`,
    "",
    "```text",
    s.salida.texto.trim(),
    "```",
    "",
  ]),
].join("\n");

const carpeta = resolve(raiz, "docs/pruebas");
mkdirSync(carpeta, { recursive: true });
writeFileSync(resolve(carpeta, "implementacion-evidencia.md"), md);
for (const r of resumenes) console.log(r);
console.log("\nEvidencia en docs/pruebas/implementacion-evidencia.md");
const fallo = secciones.some((s) => s.salida.codigo !== 0) || !pgCumplen || pgCumplen[1] !== pgCumplen[2] || !mgCumplen || mgCumplen[1] !== mgCumplen[2] || filas.some((f) => f[2] !== "0");
if (fallo) process.exitCode = 1;
