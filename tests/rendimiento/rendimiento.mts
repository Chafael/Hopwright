// Prueba de rendimiento básica de los flujos principales de la API.
//
// Levanta la aplicación en un puerto libre (no hace falta tener `npm run dev` corriendo), manda
// peticiones HTTP reales con varios clientes a la vez y mide cuánto tarda cada una.
// Al final escribe los resultados en docs/pruebas/rendimiento.md y docs/pruebas/rendimiento.json,
// junto con el equipo en el que se corrió y cuántos datos había en cada base.
//
// Uso, desde backend/ y con los contenedores arriba:
//   npm run rendimiento
// Opcional: PETICIONES=500 CONCURRENCIA=20 npm run rendimiento
// Solo algunos escenarios: ESCENARIOS="rutas,incidentes" npm run rendimiento (busca esos textos en el nombre)
//
// Lo que la prueba crea (incidentes, movimientos de vehículo) se borra o se regresa al terminar.

import { cpus, totalmem, platform, release, arch } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Antes de cargar la app: sin logs por petición (ensuciarían la medición)
process.env.NODE_ENV = "test";

const { construirApp } = await import("../../backend/src/server.js");
const { leer, escribir } = await import("../../backend/src/db/neo4j.js");
const { mongoDb } = await import("../../backend/src/db/mongo.js");
const { pool } = await import("../../backend/src/db/postgres.js");

const PETICIONES = Number(process.env.PETICIONES ?? 200);
const CONCURRENCIA = Number(process.env.CONCURRENCIA ?? 10);
const CALENTAMIENTO = 10;

type Peticion = { method: "GET" | "POST" | "PATCH"; url: string; body?: unknown };

type Escenario = {
  nombre: string;
  bases: string;
  // Recibe el número de petición para poder variar los datos (por ejemplo, alternar destinos)
  peticion: (i: number) => Peticion;
  alTerminar?: () => Promise<void>;
};

type Resultado = {
  nombre: string;
  bases: string;
  peticiones: number;
  errores: number;
  codigos: Record<string, number>;
  porSegundo: number;
  ms: { min: number; p50: number; p95: number; p99: number; max: number; promedio: number };
};

const app = await construirApp();
await app.listen({ port: 0, host: "127.0.0.1" });
const direccion = app.server.address();
const base = `http://127.0.0.1:${typeof direccion === "object" && direccion ? direccion.port : 0}`;

// Incidentes que crea el escenario de alta, para borrarlos al final de las dos bases
const incidentesCreados: string[] = [];

const escenarios: Escenario[] = [
  {
    nombre: "GET /health",
    bases: "PostgreSQL, MongoDB y Neo4j (ping)",
    peticion: () => ({ method: "GET", url: "/health" }),
  },
  {
    nombre: "GET /rutas (C1, por tiempo)",
    bases: "Neo4j",
    // Alterna tres pares origen-destino para no medir siempre el mismo camino
    peticion: (i) => {
      const pares = [
        ["07101", "07089"],
        ["07078", "07009"],
        ["07065", "07019"],
      ];
      const [o, d] = pares[i % pares.length];
      return { method: "GET", url: `/rutas?origen=${o}&destino=${d}&criterio=tiempo` };
    },
  },
  {
    nombre: "GET /rutas (C1, con restricciones)",
    bases: "Neo4j",
    peticion: () => ({ method: "GET", url: "/rutas?origen=07101&destino=07009&criterio=costo&evitarTerraceria=true&tiempoMaxMin=400" }),
  },
  {
    nombre: "GET /rutas/camion-tren (C2)",
    bases: "Neo4j",
    peticion: () => ({ method: "GET", url: "/rutas/camion-tren?origen=07101&destino=07089&pesoKg=20000" }),
  },
  {
    nombre: "GET /red/ciudades-aisladas (C4)",
    bases: "Neo4j",
    peticion: () => ({ method: "GET", url: "/red/ciudades-aisladas?punto=07089" }),
  },
  {
    nombre: "GET /incidentes?activo=true",
    bases: "MongoDB",
    peticion: () => ({ method: "GET", url: "/incidentes?activo=true" }),
  },
  {
    nombre: "POST /incidentes",
    bases: "MongoDB y Neo4j (escritura en las dos)",
    peticion: () => ({
      method: "POST",
      url: "/incidentes",
      body: {
        tipo: "Bloqueo",
        idPunto: "INT-ESC",
        gravedad: "Baja",
        descripcion: "Incidente creado por la prueba de rendimiento",
        detalle: { causa: "Otro", carrilesCerrados: 1 },
        reportadoPor: "Prueba de rendimiento",
      },
    }),
    alTerminar: async () => {
      await (await mongoDb()).collection("reportes_incidente").deleteMany({ reportadoPor: "Prueba de rendimiento" });
      await escribir(`MATCH (i:Incidente) WHERE i.idIncidente IN $ids DETACH DELETE i`, { ids: incidentesCreados }).catch(() => undefined);
    },
  },
  {
    nombre: "GET /incidentes/{id}/envios-afectados (C5)",
    bases: "MongoDB, PostgreSQL y Neo4j",
    peticion: () => ({ method: "GET", url: "/incidentes/INC-0001/envios-afectados" }),
  },
  {
    nombre: "GET /envios",
    bases: "PostgreSQL",
    peticion: () => ({ method: "GET", url: "/envios" }),
  },
  {
    nombre: "GET /envios/{id}/manifiesto",
    bases: "MongoDB",
    peticion: (i) => ({ method: "GET", url: `/envios/${i % 2 === 0 ? "E-102" : "E-103"}/manifiesto` }),
  },
  {
    nombre: "GET /envios/{id}/ruta (flujo integrado)",
    bases: "PostgreSQL, MongoDB y Neo4j",
    // Alterna la carga refrigerada (tiempo máximo) y la peligrosa (sin terracería)
    peticion: (i) => ({ method: "GET", url: `/envios/${i % 2 === 0 ? "E-102" : "E-103"}/ruta` }),
  },
  {
    nombre: "PATCH /vehiculos/{placa}/ubicacion",
    bases: "PostgreSQL (lectura) y Neo4j (escritura)",
    // Va y viene entre San Cristóbal y Teopisca
    peticion: (i) => ({ method: "PATCH", url: "/vehiculos/CHP-1005/ubicacion", body: { idPunto: i % 2 === 0 ? "07094" : "07078" } }),
    alTerminar: async () => {
      await fetch(`${base}/vehiculos/CHP-1005/ubicacion`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...autorizacion },
        body: JSON.stringify({ idPunto: "07078" }),
      });
    },
  },
];

const filtro = (process.env.ESCENARIOS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
const elegidos = filtro.length === 0 ? escenarios : escenarios.filter((e) => filtro.some((t) => e.nombre.includes(t)));

// Las escrituras piden sesión: se firma un token de administrador con la misma app
const autorizacion = { authorization: `Bearer ${app.jwt.sign({ idUsuario: 2, rol: "administrador", correo: "admin@hopwright.local" })}` };

async function enviar(p: Peticion): Promise<{ ms: number; codigo: number }> {
  const inicio = performance.now();
  const res = await fetch(base + p.url, {
    method: p.method,
    headers: p.body === undefined ? autorizacion : { "content-type": "application/json", ...autorizacion },
    body: p.body === undefined ? undefined : JSON.stringify(p.body),
  });
  const cuerpo = await res.text();
  const ms = performance.now() - inicio;
  if (p.url === "/incidentes" && p.method === "POST" && res.status < 300) {
    const id = JSON.parse(cuerpo)?.incidente?.idIncidente;
    if (id) incidentesCreados.push(id);
  }
  return { ms, codigo: res.status };
}

const percentil = (ordenados: number[], p: number) => ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
const r1 = (n: number) => Math.round(n * 10) / 10;

async function correr(e: Escenario): Promise<Resultado> {
  // Calentamiento: abre conexiones y llena cachés para no medir el primer acceso
  for (let i = 0; i < CALENTAMIENTO; i++) await enviar(e.peticion(i));

  const tiempos: number[] = [];
  const codigos: Record<string, number> = {};
  let siguiente = 0;
  const inicio = performance.now();

  // CONCURRENCIA clientes toman peticiones de la misma cola hasta acabarla
  await Promise.all(
    Array.from({ length: CONCURRENCIA }, async () => {
      while (siguiente < PETICIONES) {
        const i = siguiente++;
        try {
          const { ms, codigo } = await enviar(e.peticion(i));
          tiempos.push(ms);
          codigos[codigo] = (codigos[codigo] ?? 0) + 1;
        } catch {
          codigos["sin respuesta"] = (codigos["sin respuesta"] ?? 0) + 1;
        }
      }
    }),
  );

  const duracion = (performance.now() - inicio) / 1000;
  // Si la limpieza falla, se avisa pero se sigue con los demás escenarios
  await e.alTerminar?.().catch((error: unknown) => console.warn(`  No se pudo limpiar ${e.nombre}: ${(error as Error).message}`));

  const ordenados = [...tiempos].sort((a, b) => a - b);
  const errores = Object.entries(codigos)
    .filter(([c]) => !(Number(c) >= 200 && Number(c) < 300))
    .reduce((s, [, n]) => s + n, 0);

  return {
    nombre: e.nombre,
    bases: e.bases,
    peticiones: PETICIONES,
    errores,
    codigos,
    porSegundo: r1(PETICIONES / duracion),
    ms: {
      min: r1(ordenados[0] ?? 0),
      p50: r1(percentil(ordenados, 50) ?? 0),
      p95: r1(percentil(ordenados, 95) ?? 0),
      p99: r1(percentil(ordenados, 99) ?? 0),
      max: r1(ordenados.at(-1) ?? 0),
      promedio: r1(ordenados.reduce((s, n) => s + n, 0) / (ordenados.length || 1)),
    },
  };
}

// Cuántos datos había en cada base al momento de la prueba. Si una base no responde, se anota y se sigue.
type Volumen = { neo4j: { nodos: { etiqueta: string; total: number }[]; aristas: { tipo: string; total: number }[] } | null; mongo: Record<string, number> | null; postgres: Record<string, number> | null };

async function volumenDeDatos(): Promise<Volumen> {
  const v: Volumen = { neo4j: null, mongo: null, postgres: null };
  try {
    const nodos = await leer<{ etiqueta: string; total: number }>(`MATCH (n) UNWIND labels(n) AS etiqueta RETURN etiqueta, count(*) AS total ORDER BY etiqueta`);
    const aristas = await leer<{ tipo: string; total: number }>(`MATCH ()-[r]->() RETURN type(r) AS tipo, count(*) AS total ORDER BY tipo`);
    v.neo4j = { nodos, aristas };
  } catch { /* Neo4j no respondió */ }
  try {
    const db = await mongoDb();
    v.mongo = {};
    for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) v.mongo[c.name] = await db.collection(c.name).estimatedDocumentCount();
  } catch { /* MongoDB no respondió */ }
  try {
    const { rows } = await pool.query<{ relname: string }>(`SELECT relname FROM pg_stat_user_tables ORDER BY relname`);
    v.postgres = {};
    for (const { relname } of rows) v.postgres[relname] = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "${relname}"`)).rows[0].n);
  } catch { /* PostgreSQL no respondió */ }
  return v;
}

function aMarkdown(resultados: Resultado[], datos: Volumen, equipo: Record<string, string>): string {
  const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const lineas: string[] = [];
  lineas.push("# Prueba de rendimiento", "");
  lineas.push(`Corrida el ${fecha} con \`npm run rendimiento\` (script en \`tests/rendimiento/rendimiento.mts\`).`, "");
  lineas.push(
    `Cada escenario manda ${PETICIONES} peticiones HTTP con ${CONCURRENCIA} clientes a la vez, después de ${CALENTAMIENTO} peticiones de calentamiento que no se cuentan. ` +
      "Los tiempos son de ida y vuelta medidos desde el cliente, en milisegundos. p95 quiere decir que el 95 % de las peticiones tardó eso o menos.",
    "",
  );
  lineas.push("## Equipo", "");
  for (const [k, v] of Object.entries(equipo)) lineas.push(`- ${k}: ${v}`);
  lineas.push("", "Las tres bases corren en Docker en el mismo equipo que el backend.", "");
  lineas.push("## Resultados", "");
  lineas.push("| Escenario | Bases | Peticiones/s | p50 | p95 | p99 | Máx | Errores |");
  lineas.push("|---|---|---:|---:|---:|---:|---:|---:|");
  for (const r of resultados) {
    lineas.push(`| ${r.nombre} | ${r.bases} | ${r.porSegundo} | ${r.ms.p50} | ${r.ms.p95} | ${r.ms.p99} | ${r.ms.max} | ${r.errores} |`);
  }
  const conErrores = resultados.filter((r) => r.errores > 0);
  if (conErrores.length > 0) {
    lineas.push("", "Códigos de respuesta de los escenarios con errores:", "");
    for (const r of conErrores) lineas.push(`- ${r.nombre}: ${Object.entries(r.codigos).map(([c, n]) => `${c} (${n})`).join(", ")}`);
  }
  lineas.push("", "## Datos en las bases al momento de la prueba", "");
  const lista = (o: Record<string, number> | null) => (o === null ? "no respondió" : Object.entries(o).map(([k, n]) => `${k} ${n}`).join(", ") || "vacía");
  lineas.push(`- Neo4j, nodos: ${datos.neo4j ? datos.neo4j.nodos.map((n) => `${n.etiqueta} ${n.total}`).join(", ") : "no respondió"}`);
  lineas.push(`- Neo4j, aristas: ${datos.neo4j ? datos.neo4j.aristas.map((a) => `${a.tipo} ${a.total}`).join(", ") : "no respondió"}`);
  lineas.push(`- MongoDB: ${lista(datos.mongo)}`);
  lineas.push(`- PostgreSQL: ${lista(datos.postgres)}`);
  lineas.push("", "## Cómo leer estos números", "");
  lineas.push(
    "Son los datos de ejemplo del proyecto, no un volumen de producción. La prueba sirve para comparar los flujos entre sí y para detectar si un cambio los vuelve más lentos, " +
      "no para predecir cuántos usuarios aguantaría el sistema en un servidor real. Las escrituras que tocan dos bases (alta de incidente, movimiento de vehículo) " +
      "tienen que esperar a las dos, así que es normal que tarden más que una lectura de una sola base.",
  );
  return lineas.join("\n") + "\n";
}

const resultados: Resultado[] = [];
try {
  // Antes de medir, las tres bases tienen que estar arriba; si no, los números no significan nada
  const salud = await (await fetch(`${base}/health`)).json();
  const caidas = Object.entries(salud.bases ?? {}).filter(([, b]) => (b as { estado: string }).estado !== "ok").map(([n]) => n);
  if (caidas.length > 0 && !process.env.FORZAR) {
    console.error(`No responden: ${caidas.join(", ")}. Levanta los contenedores (docker compose up -d) y vuelve a intentar.`);
    process.exitCode = 1;
  }
  for (const e of process.exitCode ? [] : elegidos) {
    process.stdout.write(`${e.nombre.padEnd(46)}`);
    const r = await correr(e);
    resultados.push(r);
    console.log(`${String(r.porSegundo).padStart(7)} pet/s   p50 ${String(r.ms.p50).padStart(6)} ms   p95 ${String(r.ms.p95).padStart(6)} ms   errores ${r.errores}`);
  }

  if (resultados.length > 0) {
  const equipo = {
    Procesador: `${cpus()[0]?.model.trim() ?? "desconocido"} (${cpus().length} hilos)`,
    Memoria: `${Math.round(totalmem() / 1024 ** 3)} GB`,
    "Sistema operativo": `${platform()} ${release()} (${arch()})`,
    "Node.js": process.version,
  };
  const datos = await volumenDeDatos();

  const carpeta = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/pruebas");
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(resolve(carpeta, "rendimiento.md"), aMarkdown(resultados, datos, equipo));
  writeFileSync(
    resolve(carpeta, "rendimiento.json"),
    JSON.stringify({ fecha: new Date().toISOString(), peticiones: PETICIONES, concurrencia: CONCURRENCIA, equipo, datos, resultados }, null, 2) + "\n",
  );
  console.log(`\nResultados guardados en docs/pruebas/rendimiento.md y rendimiento.json`);
  }
} finally {
  await app.close();
}
