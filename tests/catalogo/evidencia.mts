// Evidencia del catálogo de operaciones (Entregable 5).
//
// Corre cada caso del catálogo (normal, límite y error) con peticiones HTTP reales contra la API,
// guarda lo que respondió y lo compara con lo esperado. Algunos casos se revisan directo en la base
// (por ejemplo, que un evento ya llegó a Neo4j) para que se vea la sincronización.
// Al final escribe docs/pruebas/catalogo-evidencia.md y catalogo-evidencia.json.
//
// Uso, desde backend/ y con los contenedores arriba:
//   npm run catalogo
//
// Todo lo que crea (cliente, ciudad, vehículo, envío, manifiesto, bitácora e incidente) lleva un sufijo
// único y se borra de las tres bases al terminar, aunque algún caso falle.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// Sin logs por petición y sin el procesador de eventos automático: aquí se llama a mano para ver el antes y el después
process.env.NODE_ENV = "test";

const { construirApp } = await import("../../backend/src/server.js");
const { pool } = await import("../../backend/src/db/postgres.js");
const { mongoDb } = await import("../../backend/src/db/mongo.js");
const { leer, escribir } = await import("../../backend/src/db/neo4j.js");
const { procesarEventosPendientes } = await import("../../backend/src/services/procesadorEventos.service.js");

type Tipo = "normal" | "límite" | "error" | "verificación";
type Metodo = "GET" | "POST" | "PATCH";

type Registro = {
  op: string;
  id: string;
  tipo: Tipo;
  descripcion: string;
  solicitud: string;
  cuerpo?: unknown;
  esperado: string;
  obtenido: string;
  extracto: unknown;
  ms: number;
  cumple: boolean;
  motivo?: string;
};

const OPERACIONES: Record<string, string> = {
  "OP-R01": "Iniciar sesión",
  "OP-R02": "Registrar cliente",
  "OP-R03": "Registrar vehículo",
  "OP-R04": "Registrar envío",
  "OP-R05": "Asignar vehículo a un envío",
  "OP-R06": "Salida, entrega y cancelación de un envío",
  "OP-R07": "Consultar envíos",
  "OP-D01": "Registrar manifiesto de carga",
  "OP-D02": "Consultar manifiesto",
  "OP-D03": "Consultar bitácora de un envío",
  "OP-D04": "Reportar incidente",
  "OP-D05": "Agregar evidencia a un incidente",
  "OP-D06": "Consultar incidentes",
  "OP-D07": "Cerrar incidente",
  "OP-G01": "Ruta más corta (C1)",
  "OP-G02": "Exploración paso a paso de la ruta",
  "OP-G03": "Camión contra camión y tren (C2)",
  "OP-G04": "Ciudades aisladas (C4)",
  "OP-G05": "Mapa de la red",
  "OP-G06": "Ubicación de un vehículo",
  "OP-I01": "Flujo integrado: ruta de un envío",
  "OP-I02": "Envíos afectados por un incidente (C5)",
  "OP-I03": "Alta de ciudad replicada al grafo",
  "OP-I04": "Reconciliación de réplicas",
  "OP-I05": "Estado de las tres bases",
};

const registros: Registro[] = [];
const sufijo = String(Date.now()).slice(-6);
const ENVIO = `E-7${sufijo}`;
const PLACA = `PRU-${sufijo}`;
const RFC = `PRU${sufijo}AB1`;
const RFC_CORTO = `p${sufijo.slice(-4)}`;
const TUXTLA = "07101";
const SAN_CRISTOBAL = "07078";
const COMITAN = "07019";
const TAPACHULA = "07089";

const app = await construirApp();
await app.listen({ port: 0, host: "127.0.0.1" });
const direccion = app.server.address();
const base = `http://127.0.0.1:${typeof direccion === "object" && direccion ? direccion.port : 0}`;

let tokenDespacho = "";
let tokenAdmin = "";
const despacho = () => ({ authorization: `Bearer ${tokenDespacho}` });
const admin = () => ({ authorization: `Bearer ${tokenAdmin}` });

// Recorta respuestas largas para que la evidencia se pueda leer
function recortar(valor: unknown, max = 700): unknown {
  const texto = JSON.stringify(valor);
  if (texto === undefined || texto.length <= max) return valor;
  return texto.slice(0, max) + " …";
}

type Opciones = {
  op: string;
  id: string;
  tipo: Tipo;
  descripcion: string;
  metodo?: Metodo;
  url: string;
  cuerpo?: unknown;
  headers?: Record<string, string>;
  esperado: number;
  // Revisión extra del cuerpo; regresa el motivo si no cumple
  revisar?: (json: any) => string | null;
  // Qué parte de la respuesta se guarda como evidencia
  extracto?: (json: any) => unknown;
  detalleEsperado?: string;
};

async function caso(o: Opciones): Promise<any> {
  const metodo = o.metodo ?? "GET";
  const inicio = performance.now();
  let status = 0;
  let json: any = null;
  try {
    const res = await fetch(base + o.url, {
      method: metodo,
      headers: { ...(o.cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...(o.headers ?? {}) },
      body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
    });
    status = res.status;
    const texto = await res.text();
    json = texto ? JSON.parse(texto) : null;
  } catch (error) {
    json = { error: error instanceof Error ? error.message : String(error) };
  }
  const ms = Math.round((performance.now() - inicio) * 10) / 10;
  let motivo: string | null = status === o.esperado ? null : `se esperaba ${o.esperado} y respondió ${status}`;
  if (!motivo && o.revisar) {
    try {
      motivo = o.revisar(json);
    } catch (error) {
      motivo = `no se pudo revisar la respuesta: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  registros.push({
    op: o.op,
    id: o.id,
    tipo: o.tipo,
    descripcion: o.descripcion,
    solicitud: `${metodo} ${o.url}`,
    ...(o.cuerpo !== undefined ? { cuerpo: o.cuerpo } : {}),
    esperado: `${o.esperado}${o.detalleEsperado ? `, ${o.detalleEsperado}` : ""}`,
    obtenido: String(status),
    extracto: recortar(o.extracto && json && status === o.esperado ? o.extracto(json) : json),
    ms,
    cumple: motivo === null,
    ...(motivo ? { motivo } : {}),
  });
  console.log(`${motivo ? "NO " : "OK "} ${o.id.padEnd(8)} ${metodo.padEnd(5)} ${o.url.slice(0, 70).padEnd(70)} ${status}`);
  return json;
}

// Revisión directa en una base, para mostrar que un cambio llegó (o todavía no) a su réplica
async function verificacion(op: string, id: string, descripcion: string, consulta: string, esperado: string, fn: () => Promise<{ obtenido: unknown; ok: boolean }>) {
  const inicio = performance.now();
  let r: { obtenido: unknown; ok: boolean };
  try {
    r = await fn();
  } catch (error) {
    r = { obtenido: { error: error instanceof Error ? error.message : String(error) }, ok: false };
  }
  registros.push({
    op,
    id,
    tipo: "verificación",
    descripcion,
    solicitud: consulta,
    esperado,
    obtenido: r.ok ? "coincide" : "no coincide",
    extracto: recortar(r.obtenido),
    ms: Math.round((performance.now() - inicio) * 10) / 10,
    cumple: r.ok,
  });
  console.log(`${r.ok ? "OK " : "NO "} ${id.padEnd(8)} ${consulta.slice(0, 76)}`);
}

const nombres = (ruta: { nombre: string }[]) => ruta.map((p) => p.nombre);
const resumenRuta = (r: any) => ({
  encontrada: r.encontrada,
  ruta: r.ruta ? nombres(r.ruta) : undefined,
  minutos: r.minutos,
  kilometros: r.kilometros,
  costoCasetas: r.costoCasetas,
  avisos: r.avisos,
  motivo: r.motivo,
});

// Clave de ciudad libre para la prueba (07900 a 07999 no son municipios de Chiapas)
async function ciudadLibre(): Promise<string> {
  const { rows } = await pool.query("SELECT id_ciudad FROM ciudad WHERE id_ciudad LIKE '079%'");
  const usadas = new Set(rows.map((r) => r.id_ciudad));
  for (let n = 900 + (Number(sufijo) % 90); n < 1000; n++) if (!usadas.has(`07${n}`)) return `07${n}`;
  return "07999";
}
const CIUDAD = await ciudadLibre();

const clientesCreados: number[] = [];
let incidenteNuevo = "INC-0000";

try {
  // ---------- Estado de las bases ----------
  await caso({
    op: "OP-I05", id: "I05-N1", tipo: "normal", descripcion: "Las tres bases responden", url: "/health", esperado: 200,
    detalleEsperado: "estado ok en postgres, mongo y neo4j",
    revisar: (j) => (j.estado === "ok" ? null : `estado ${j.estado}`),
  });

  // ---------- OP-R01 Iniciar sesión ----------
  const login = await caso({
    op: "OP-R01", id: "R01-N1", tipo: "normal", descripcion: "Despachador con credenciales correctas", metodo: "POST", url: "/auth/login",
    cuerpo: { correo: "despacho@hopwright.local", password: "hopwright123" }, esperado: 200, detalleEsperado: "regresa un token JWT",
    revisar: (j) => (typeof j.token === "string" && j.token.split(".").length === 3 ? null : "no regresó un JWT"),
    extracto: (j) => ({ token: `${String(j.token).slice(0, 24)}…` }),
  });
  tokenDespacho = login?.token ?? "";
  const loginAdmin = await caso({
    op: "OP-R01", id: "R01-N2", tipo: "normal", descripcion: "Administrador con credenciales correctas", metodo: "POST", url: "/auth/login",
    cuerpo: { correo: "admin@hopwright.local", password: "hopwright123" }, esperado: 200, detalleEsperado: "regresa un token JWT",
    extracto: (j) => ({ token: `${String(j.token).slice(0, 24)}…` }),
  });
  tokenAdmin = loginAdmin?.token ?? "";
  const malPassword = await caso({
    op: "OP-R01", id: "R01-E1", tipo: "error", descripcion: "Contraseña incorrecta", metodo: "POST", url: "/auth/login",
    cuerpo: { correo: "despacho@hopwright.local", password: "otra" }, esperado: 401,
  });
  await caso({
    op: "OP-R01", id: "R01-E2", tipo: "error", descripcion: "Correo que no existe: mismo mensaje que la contraseña incorrecta", metodo: "POST", url: "/auth/login",
    cuerpo: { correo: "nadie@hopwright.local", password: "hopwright123" }, esperado: 401, detalleEsperado: "mismo mensaje que R01-E1",
    revisar: (j) => (j.mensaje === malPassword?.mensaje ? null : "el mensaje delata si el correo existe"),
  });
  await caso({
    op: "OP-R01", id: "R01-E3", tipo: "error", descripcion: "Falta la contraseña", metodo: "POST", url: "/auth/login",
    cuerpo: { correo: "despacho@hopwright.local" }, esperado: 400,
  });
  await caso({
    op: "OP-R01", id: "R01-L1", tipo: "límite", descripcion: "Token válido de despachador en una operación solo de administrador", metodo: "POST", url: "/ciudades",
    headers: despacho(), cuerpo: { idCiudad: CIUDAD, nombre: "No se debe crear", estado: "Chiapas" }, esperado: 403,
  });
  await caso({
    op: "OP-R01", id: "R01-L2", tipo: "límite", descripcion: "Escritura sin token", metodo: "POST", url: "/envios",
    cuerpo: { idEnvio: ENVIO, idCliente: 1, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 10, prioridad: "Normal" }, esperado: 401,
  });

  // ---------- OP-G01 a OP-G05: consultas sobre la red ----------
  await caso({
    op: "OP-G01", id: "G01-N1", tipo: "normal", descripcion: "Tuxtla a San Cristóbal por tiempo", url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}&criterio=tiempo`,
    esperado: 200, detalleEsperado: "73 min por la autopista, 230 de casetas",
    revisar: (j) => (j.minutos === 73 && j.costoCasetas === 230 ? null : `minutos ${j.minutos}, casetas ${j.costoCasetas}`), extracto: resumenRuta,
  });
  await caso({
    op: "OP-G01", id: "G01-N2", tipo: "normal", descripcion: "Mismo viaje por costo", url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}&criterio=costo`,
    esperado: 200, detalleEsperado: "0 de casetas por la libre, 140 min",
    revisar: (j) => (j.costoCasetas === 0 && j.minutos === 140 ? null : `minutos ${j.minutos}, casetas ${j.costoCasetas}`), extracto: resumenRuta,
  });
  await caso({
    op: "OP-G01", id: "G01-L1", tipo: "límite", descripcion: "San Cristóbal a Totolapa sin terracería (la más rápida sí usa terracería)",
    url: `/rutas?origen=${SAN_CRISTOBAL}&destino=07098&evitarTerraceria=true`, esperado: 200, detalleEsperado: "108 min y ningún tramo de terracería",
    revisar: (j) => (j.minutos === 108 && j.tramos.every((t: any) => t.tipoVia !== "Terracería") ? null : `minutos ${j.minutos}`), extracto: resumenRuta,
  });
  await caso({
    op: "OP-G01", id: "G01-L2", tipo: "límite", descripcion: "Tiempo máximo que ninguna ruta cumple", url: `/rutas?origen=${TUXTLA}&destino=07009&tiempoMaxMin=100`,
    esperado: 200, detalleEsperado: "encontrada: false con el motivo", revisar: (j) => (j.encontrada === false ? null : "encontró una ruta"), extracto: resumenRuta,
  });
  await caso({ op: "OP-G01", id: "G01-E1", tipo: "error", descripcion: "Ciudad que no existe en la red", url: `/rutas?origen=${TUXTLA}&destino=07999`, esperado: 404 });
  await caso({ op: "OP-G01", id: "G01-E2", tipo: "error", descripcion: "Origen igual al destino", url: `/rutas?origen=${TUXTLA}&destino=${TUXTLA}`, esperado: 400 });
  await caso({ op: "OP-G01", id: "G01-E3", tipo: "error", descripcion: "Clave de ciudad con formato inválido", url: `/rutas?origen=tuxtla&destino=${SAN_CRISTOBAL}`, esperado: 400 });

  const resumenExploracion = (j: any) => ({ algoritmo: j.algoritmo, minutos: j.minutos, coincide: j.coincide, neo4j: j.neo4j?.minutos, pasos: j.pasos?.length, ruta: j.ruta });
  await caso({
    op: "OP-G02", id: "G02-N1", tipo: "normal", descripcion: "Dijkstra paso a paso de Tuxtla a San Cristóbal", url: `/rutas/exploracion?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}`,
    esperado: 200, detalleEsperado: "coincide: true con Neo4j, 73 min", revisar: (j) => (j.coincide === true && j.minutos === 73 ? null : `coincide ${j.coincide}`), extracto: resumenExploracion,
  });
  await caso({
    op: "OP-G02", id: "G02-L1", tipo: "límite", descripcion: "Búsqueda bidireccional de Tuxtla a Tapachula", url: `/rutas/exploracion?origen=${TUXTLA}&destino=${TAPACHULA}&algoritmo=bidireccional`,
    esperado: 200, detalleEsperado: "coincide: true", revisar: (j) => (j.coincide === true ? null : "no coincide con Neo4j"), extracto: resumenExploracion,
  });
  await caso({ op: "OP-G02", id: "G02-E1", tipo: "error", descripcion: "Algoritmo desconocido", url: `/rutas/exploracion?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}&algoritmo=a-estrella`, esperado: 400 });

  await caso({
    op: "OP-G03", id: "G03-N1", tipo: "normal", descripcion: "20 toneladas de Tuxtla a Tapachula", url: `/rutas/camion-tren?origen=${TUXTLA}&destino=${TAPACHULA}&pesoKg=20000`,
    esperado: 200, detalleEsperado: "el tren sale más barato y el camión más rápido",
    revisar: (j) => (j.masBarata === "camion-tren" && j.masRapida === "camion" ? null : `masBarata ${j.masBarata}, masRapida ${j.masRapida}`),
    extracto: (j) => ({ soloCamion: { minutos: j.soloCamion?.minutos, costo: j.soloCamion?.costo }, camionTren: { minutos: j.camionTren?.minutos, costo: j.camionTren?.costo, subida: j.camionTren?.estacionSubida, bajada: j.camionTren?.estacionBajada }, masBarata: j.masBarata, masRapida: j.masRapida }),
  });
  await caso({ op: "OP-G03", id: "G03-L1", tipo: "límite", descripcion: "Peso de 0 kg", url: `/rutas/camion-tren?origen=${TUXTLA}&destino=${TAPACHULA}&pesoKg=0`, esperado: 400 });
  await caso({ op: "OP-G03", id: "G03-E1", tipo: "error", descripcion: "Destino que no existe en la red", url: `/rutas/camion-tren?origen=${TUXTLA}&destino=07999&pesoKg=1000`, esperado: 404 });

  await caso({
    op: "OP-G04", id: "G04-N1", tipo: "normal", descripcion: "Se cierra Tapachula", url: `/red/ciudades-aisladas?punto=${TAPACHULA}`, esperado: 200,
    detalleEsperado: "6 municipios del Soconusco sin camino a Tuxtla", revisar: (j) => (j.aisladas.length === 6 ? null : `${j.aisladas.length} aisladas`),
    extracto: (j) => ({ puntoCerrado: j.puntoCerrado?.nombre, aisladas: j.aisladas.map((c: any) => c.nombre) }),
  });
  await caso({
    op: "OP-G04", id: "G04-L1", tipo: "límite", descripcion: "Se cierra un entronque con caminos alternos", url: "/red/ciudades-aisladas?punto=INT-OXC", esperado: 200,
    detalleEsperado: "lista vacía", revisar: (j) => (j.aisladas.length === 0 ? null : `${j.aisladas.length} aisladas`),
  });
  await caso({ op: "OP-G04", id: "G04-E1", tipo: "error", descripcion: "Punto que no existe", url: "/red/ciudades-aisladas?punto=INT-NOEXISTE", esperado: 404 });

  await caso({
    op: "OP-G05", id: "G05-N1", tipo: "normal", descripcion: "Todo lo que dibuja el mapa", url: "/red/mapa", esperado: 200, detalleEsperado: "138 puntos con coordenadas",
    revisar: (j) => (j.puntos.length === 138 ? null : `${j.puntos.length} puntos`),
    extracto: (j) => ({ puntos: j.puntos.length, tramos: j.tramos.length, incidentes: j.incidentes.length, vehiculos: j.vehiculos.length }),
  });

  // ---------- OP-R02 Registrar cliente ----------
  const cliente = await caso({
    op: "OP-R02", id: "R02-N1", tipo: "normal", descripcion: "Cliente nuevo", metodo: "POST", url: "/clientes", headers: despacho(),
    cuerpo: { razonSocial: `Cliente de prueba ${sufijo}`, rfc: RFC, telefono: "9610000000", correo: "prueba@hopwright.local" }, esperado: 201,
  });
  if (cliente?.idCliente) clientesCreados.push(cliente.idCliente);
  const clienteCorto = await caso({
    op: "OP-R02", id: "R02-L1", tipo: "límite", descripcion: "RFC de 5 caracteres (el mínimo) escrito en minúsculas", metodo: "POST", url: "/clientes", headers: despacho(),
    cuerpo: { razonSocial: `Cliente corto ${sufijo}`, rfc: RFC_CORTO }, esperado: 201, detalleEsperado: "se guarda en mayúsculas",
    revisar: (j) => (j.rfc === RFC_CORTO.toUpperCase() ? null : `rfc ${j.rfc}`),
  });
  if (clienteCorto?.idCliente) clientesCreados.push(clienteCorto.idCliente);
  await caso({
    op: "OP-R02", id: "R02-E1", tipo: "error", descripcion: "RFC repetido (escrito en minúsculas)", metodo: "POST", url: "/clientes", headers: despacho(),
    cuerpo: { razonSocial: "Otro", rfc: RFC.toLowerCase() }, esperado: 409,
  });
  await caso({
    op: "OP-R02", id: "R02-E2", tipo: "error", descripcion: "RFC de 4 caracteres", metodo: "POST", url: "/clientes", headers: despacho(),
    cuerpo: { razonSocial: "Otro", rfc: "ABCD" }, esperado: 400,
  });

  // ---------- OP-I03 Alta de ciudad (PostgreSQL y evento a Neo4j) ----------
  await caso({
    op: "OP-I03", id: "I03-N1", tipo: "normal", descripcion: "Ciudad nueva", metodo: "POST", url: "/ciudades", headers: admin(),
    cuerpo: { idCiudad: CIUDAD, nombre: `Ciudad de prueba ${sufijo}`, estado: "Chiapas" }, esperado: 201,
  });
  await verificacion("OP-I03", "I03-V1", "Antes de aplicar el evento la ciudad todavía no está en Neo4j", `MATCH (c:Ciudad {idCiudad: '${CIUDAD}'})`, "0 nodos y 1 evento pendiente", async () => {
    const nodos = await leer("MATCH (c:Ciudad {idCiudad: $id}) RETURN c.nombre AS nombre", { id: CIUDAD });
    const { rows } = await pool.query("SELECT tipo, estado FROM eventos_pendientes WHERE payload->>'idCiudad' = $1", [CIUDAD]);
    return { obtenido: { nodosEnNeo4j: nodos.length, eventos: rows }, ok: nodos.length === 0 && rows.some((r) => r.estado === "pendiente") };
  });
  await procesarEventosPendientes();
  await verificacion("OP-I03", "I03-V2", "Después del procesador de eventos la ciudad está en Neo4j con el mismo nombre", `MATCH (c:Ciudad {idCiudad: '${CIUDAD}'})`, "1 nodo y evento aplicado", async () => {
    const nodos = await leer<{ nombre: string }>("MATCH (c:Ciudad {idCiudad: $id}) RETURN c.nombre AS nombre", { id: CIUDAD });
    const { rows } = await pool.query("SELECT tipo, estado FROM eventos_pendientes WHERE payload->>'idCiudad' = $1", [CIUDAD]);
    return { obtenido: { nodosEnNeo4j: nodos, eventos: rows }, ok: nodos[0]?.nombre === `Ciudad de prueba ${sufijo}` && rows.every((r) => r.estado === "aplicado") };
  });
  await caso({
    op: "OP-I03", id: "I03-L1", tipo: "límite", descripcion: "Clave INEGI de 4 dígitos", metodo: "POST", url: "/ciudades", headers: admin(),
    cuerpo: { idCiudad: "7101", nombre: "Tuxtla", estado: "Chiapas" }, esperado: 400,
  });
  await caso({
    op: "OP-I03", id: "I03-E1", tipo: "error", descripcion: "Ciudad que ya existe", metodo: "POST", url: "/ciudades", headers: admin(),
    cuerpo: { idCiudad: TUXTLA, nombre: "Tuxtla Gutiérrez", estado: "Chiapas" }, esperado: 409,
  });

  // ---------- OP-R03 Registrar vehículo (y su réplica en Neo4j) ----------
  await caso({
    op: "OP-R03", id: "R03-N1", tipo: "normal", descripcion: "Camión de 9,000 kg", metodo: "POST", url: "/vehiculos", headers: admin(),
    cuerpo: { placa: PLACA, tipo: "Camión", capacidadKg: 9000, estado: "Disponible" }, esperado: 201,
  });
  await caso({
    op: "OP-R03", id: "R03-V1", tipo: "verificación", descripcion: "Antes de aplicar VEHICULO_GUARDADO el grafo no conoce la placa", url: `/vehiculos/${PLACA}/ubicacion`, esperado: 404,
  });
  await procesarEventosPendientes();
  await caso({
    op: "OP-R03", id: "R03-V2", tipo: "verificación", descripcion: "Después del procesador la placa ya está en Neo4j, todavía sin ubicación", url: `/vehiculos/${PLACA}/ubicacion`,
    esperado: 200, detalleEsperado: "punto: null", revisar: (j) => (j.punto === null ? null : "ya tenía ubicación"),
  });
  await caso({
    op: "OP-R03", id: "R03-L1", tipo: "límite", descripcion: "Capacidad de 0 kg", metodo: "POST", url: "/vehiculos", headers: admin(),
    cuerpo: { placa: `${PLACA}X`, tipo: "Camión", capacidadKg: 0, estado: "Disponible" }, esperado: 400,
  });
  await caso({
    op: "OP-R03", id: "R03-E1", tipo: "error", descripcion: "Placa repetida", metodo: "POST", url: "/vehiculos", headers: admin(),
    cuerpo: { placa: "CHP-1001", tipo: "Camión", capacidadKg: 8000, estado: "Disponible" }, esperado: 409,
  });
  await caso({
    op: "OP-R03", id: "R03-E2", tipo: "error", descripcion: "Tipo de vehículo que no existe", metodo: "POST", url: "/vehiculos", headers: admin(),
    cuerpo: { placa: `${PLACA}X`, tipo: "Avión", capacidadKg: 1000, estado: "Disponible" }, esperado: 400,
  });

  // ---------- OP-G06 Ubicación del vehículo ----------
  await caso({
    op: "OP-G06", id: "G06-N1", tipo: "normal", descripcion: "Poner el camión de prueba en Tuxtla", metodo: "PATCH", url: `/vehiculos/${PLACA}/ubicacion`, headers: despacho(),
    cuerpo: { idPunto: TUXTLA }, esperado: 200, detalleEsperado: "actual: Tuxtla", revisar: (j) => (j.actual?.idPunto === TUXTLA ? null : `actual ${j.actual?.idPunto}`),
  });
  await caso({
    op: "OP-G06", id: "G06-N2", tipo: "normal", descripcion: "Consultar dónde está", url: `/vehiculos/${PLACA}/ubicacion`, esperado: 200,
    revisar: (j) => (j.punto?.idPunto === TUXTLA ? null : `punto ${j.punto?.idPunto}`),
  });
  await caso({
    op: "OP-G06", id: "G06-L1", tipo: "límite", descripcion: "Un camión no puede quedar en una estación de tren (R11)", metodo: "PATCH", url: `/vehiculos/${PLACA}/ubicacion`,
    headers: despacho(), cuerpo: { idPunto: "EST-TAP" }, esperado: 400,
  });
  await caso({
    op: "OP-G06", id: "G06-E1", tipo: "error", descripcion: "Vehículo que no existe", metodo: "PATCH", url: "/vehiculos/XXX-0000/ubicacion", headers: despacho(),
    cuerpo: { idPunto: TUXTLA }, esperado: 404,
  });
  await caso({
    op: "OP-G06", id: "G06-E2", tipo: "error", descripcion: "Sin token", metodo: "PATCH", url: `/vehiculos/${PLACA}/ubicacion`, cuerpo: { idPunto: TUXTLA }, esperado: 401,
  });

  // ---------- OP-R04 Registrar envío ----------
  const idCliente = cliente?.idCliente ?? 1;
  await caso({
    op: "OP-R04", id: "R04-N1", tipo: "normal", descripcion: "Envío de 9,000 kg de Tuxtla a Comitán", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: ENVIO, idCliente, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 9000, prioridad: "Urgente" }, esperado: 201,
    detalleEsperado: "estado Pendiente", revisar: (j) => (j.estado === "Pendiente" ? null : `estado ${j.estado}`),
  });
  await caso({
    op: "OP-R04", id: "R04-L1", tipo: "límite", descripcion: "Origen igual al destino", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: `E-6${sufijo}`, idCliente, idCiudadOrigen: TUXTLA, idCiudadDestino: TUXTLA, pesoKg: 10, prioridad: "Normal" }, esperado: 400,
  });
  await caso({
    op: "OP-R04", id: "R04-L2", tipo: "límite", descripcion: "Peso de 0 kg", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: `E-6${sufijo}`, idCliente, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 0, prioridad: "Normal" }, esperado: 400,
  });
  await caso({
    op: "OP-R04", id: "R04-E1", tipo: "error", descripcion: "Cliente que no existe", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: `E-6${sufijo}`, idCliente: 999999, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 10, prioridad: "Normal" }, esperado: 400,
  });
  await caso({
    op: "OP-R04", id: "R04-E2", tipo: "error", descripcion: "Identificador repetido", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: ENVIO, idCliente, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 10, prioridad: "Normal" }, esperado: 409,
  });
  await caso({
    op: "OP-R04", id: "R04-E3", tipo: "error", descripcion: "Identificador sin el formato E-número", metodo: "POST", url: "/envios", headers: despacho(),
    cuerpo: { idEnvio: "ENVIO-1", idCliente, idCiudadOrigen: TUXTLA, idCiudadDestino: COMITAN, pesoKg: 10, prioridad: "Normal" }, esperado: 400,
  });

  // ---------- OP-D01 Registrar manifiesto ----------
  const peligrosa = {
    tipoCarga: "peligrosa",
    articulos: [{ descripcion: "Solvente industrial", cantidad: 40, pesoKg: 200 }, { descripcion: "Pintura base aceite", cantidad: 30, pesoKg: 100 }],
    claseUN: 3,
    numeroONU: "UN1263",
    hojaSeguridad: "https://docs.hopwright.local/hs-solvente.pdf",
    telefonoEmergencia: "9615550000",
  };
  await caso({
    op: "OP-D01", id: "D01-L1", tipo: "límite", descripcion: "Clase UN 10 (el rango es de 1 a 9)", metodo: "POST", url: `/envios/${ENVIO}/manifiesto`, headers: despacho(),
    cuerpo: { ...peligrosa, claseUN: 10 }, esperado: 400,
  });
  const { numeroONU: _sinOnu, ...sinOnu } = peligrosa;
  await caso({
    op: "OP-D01", id: "D01-E1", tipo: "error", descripcion: "Carga peligrosa sin número ONU", metodo: "POST", url: `/envios/${ENVIO}/manifiesto`, headers: despacho(),
    cuerpo: sinOnu, esperado: 400,
  });
  await caso({
    op: "OP-D01", id: "D01-E2", tipo: "error", descripcion: "Envío que no existe en PostgreSQL", metodo: "POST", url: "/envios/E-999999/manifiesto", headers: despacho(),
    cuerpo: peligrosa, esperado: 404,
  });
  await caso({
    op: "OP-D01", id: "D01-N1", tipo: "normal", descripcion: "Manifiesto de carga peligrosa clase 3", metodo: "POST", url: `/envios/${ENVIO}/manifiesto`, headers: despacho(),
    cuerpo: peligrosa, esperado: 201,
  });
  await caso({
    op: "OP-D01", id: "D01-E3", tipo: "error", descripcion: "Segundo manifiesto para el mismo envío", metodo: "POST", url: `/envios/${ENVIO}/manifiesto`, headers: despacho(),
    cuerpo: peligrosa, esperado: 409,
  });
  await verificacion("OP-D01", "D01-V1", "El validador $jsonSchema de MongoDB rechaza un manifiesto inválido aunque no pase por la API", "db.manifiestos.insertOne({ idEnvio, tipoCarga: 'peligrosa', articulos: [] })", "error 121 (Document failed validation)", async () => {
    try {
      await (await mongoDb()).collection("manifiestos").insertOne({ idEnvio: `E-5${sufijo}`, tipoCarga: "peligrosa", articulos: [] });
      await (await mongoDb()).collection("manifiestos").deleteOne({ idEnvio: `E-5${sufijo}` });
      return { obtenido: "MongoDB aceptó el documento", ok: false };
    } catch (error: any) {
      return { obtenido: { code: error?.code, mensaje: error?.message }, ok: error?.code === 121 };
    }
  });

  // ---------- OP-D02 Consultar manifiesto ----------
  await caso({
    op: "OP-D02", id: "D02-N1", tipo: "normal", descripcion: "Manifiesto recién guardado", url: `/envios/${ENVIO}/manifiesto`, esperado: 200,
    revisar: (j) => (j.tipoCarga === "peligrosa" && j.claseUN === 3 ? null : `tipoCarga ${j.tipoCarga}`),
  });
  await caso({ op: "OP-D02", id: "D02-L1", tipo: "límite", descripcion: "Envío que existe pero no tiene manifiesto (E-105)", url: "/envios/E-105/manifiesto", esperado: 404 });
  await caso({ op: "OP-D02", id: "D02-E1", tipo: "error", descripcion: "Envío que no existe", url: "/envios/E-999999/manifiesto", esperado: 404 });

  // ---------- OP-I01 Flujo integrado ----------
  const resumenFlujo = (j: any) => ({
    tipoCarga: j.tipoCarga, restricciones: j.restricciones, candidatos: j.candidatos, encontrada: j.encontrada,
    ruta: j.ruta ? nombres(j.ruta) : undefined, minutos: j.minutos, kilometros: j.kilometros, costoCasetas: j.costoCasetas,
    vehiculoSugerido: j.vehiculoSugerido, avisos: j.avisos, fuentes: j.fuentes,
  });
  await caso({
    op: "OP-I01", id: "I01-N1", tipo: "normal", descripcion: "E-103: carga peligrosa de Tuxtla a Comitán", url: "/envios/E-103/ruta", esperado: 200,
    detalleEsperado: "evita terracería y sugiere un vehículo que aguanta 3,000 kg",
    revisar: (j) => (j.restricciones.evitarTerraceria === true && j.encontrada && j.tramos.every((t: any) => t.tipoVia !== "Terracería") ? null : "no respetó la restricción"),
    extracto: resumenFlujo,
  });
  await caso({
    op: "OP-I01", id: "I01-N2", tipo: "normal", descripcion: "El envío de prueba: el camión que acaba de llegar a Tuxtla es candidato y está en el origen", url: `/envios/${ENVIO}/ruta`, esperado: 200,
    detalleEsperado: `candidatos incluye ${PLACA}; el sugerido está a 0 min del origen`,
    revisar: (j) => (j.candidatos.includes(PLACA) && j.vehiculoSugerido?.minutosAlOrigen === 0 ? null : `candidatos ${j.candidatos}`),
    extracto: resumenFlujo,
  });
  await caso({
    op: "OP-I01", id: "I01-L1", tipo: "límite", descripcion: "Envío ya entregado (E-105): se puede consultar con aviso", url: "/envios/E-105/ruta", esperado: 200,
    revisar: (j) => (j.avisos.join(" ").includes("entregado") ? null : "sin aviso"), extracto: resumenFlujo,
  });
  await caso({ op: "OP-I01", id: "I01-E1", tipo: "error", descripcion: "Envío que no existe", url: "/envios/E-999999/ruta", esperado: 404 });
  await caso({ op: "OP-I01", id: "I01-E2", tipo: "error", descripcion: "Criterio inválido", url: "/envios/E-103/ruta?criterio=barata", esperado: 400 });

  // ---------- OP-R05 Asignar vehículo ----------
  await caso({
    op: "OP-R05", id: "R05-E1", tipo: "error", descripcion: "Vehículo disponible pero de 8,000 kg para un envío de 9,000 kg", metodo: "POST", url: `/envios/${ENVIO}/asignacion`,
    headers: despacho(), cuerpo: { placa: "CHP-1006" }, esperado: 409,
  });
  await caso({
    op: "OP-R05", id: "R05-E2", tipo: "error", descripcion: "Vehículo en taller", metodo: "POST", url: `/envios/${ENVIO}/asignacion`, headers: despacho(),
    cuerpo: { placa: "CHP-1004" }, esperado: 409,
  });
  await caso({
    op: "OP-R05", id: "R05-E3", tipo: "error", descripcion: "Vehículo que no existe", metodo: "POST", url: `/envios/${ENVIO}/asignacion`, headers: despacho(),
    cuerpo: { placa: "XXX-0000" }, esperado: 404,
  });
  await caso({
    op: "OP-R05", id: "R05-L1", tipo: "límite", descripcion: "Capacidad exactamente igual al peso (9,000 kg)", metodo: "POST", url: `/envios/${ENVIO}/asignacion`, headers: despacho(),
    cuerpo: { placa: PLACA }, esperado: 201,
  });
  await caso({
    op: "OP-R05", id: "R05-E4", tipo: "error", descripcion: "Asignar otra vez el mismo envío", metodo: "POST", url: `/envios/${ENVIO}/asignacion`, headers: despacho(),
    cuerpo: { placa: "CHP-1002" }, esperado: 409,
  });
  await verificacion("OP-R05", "R05-V1", "La transacción cambió los dos estados y dejó el evento", "SELECT estado FROM envio / vehiculo / eventos_pendientes", "envío Asignado, vehículo En ruta, evento ASIGNACION_CREADA", async () => {
    const e = await pool.query("SELECT estado FROM envio WHERE id_envio = $1", [ENVIO]);
    const v = await pool.query("SELECT estado FROM vehiculo WHERE placa = $1", [PLACA]);
    const ev = await pool.query("SELECT tipo, estado FROM eventos_pendientes WHERE payload->>'idEnvio' = $1 ORDER BY id", [ENVIO]);
    const obtenido = { envio: e.rows[0]?.estado, vehiculo: v.rows[0]?.estado, eventos: ev.rows };
    return { obtenido, ok: obtenido.envio === "Asignado" && obtenido.vehiculo === "En ruta" && ev.rows.some((r) => r.tipo === "ASIGNACION_CREADA") };
  });

  // ---------- OP-R06 Salida ----------
  await caso({
    op: "OP-R06", id: "R06-N1", tipo: "normal", descripcion: "Salida del envío", metodo: "POST", url: `/envios/${ENVIO}/salida`, headers: despacho(), esperado: 200,
    detalleEsperado: "estado En camino", revisar: (j) => (j.estado === "En camino" ? null : `estado ${j.estado}`),
  });

  // ---------- OP-D04 Reportar incidente ----------
  const bloqueo = {
    tipo: "Bloqueo",
    idPunto: "INT-CHC",
    gravedad: "Alta",
    descripcion: "Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos",
    detalle: { causa: "Manifestación", carrilesCerrados: 2, pasoAlternado: false },
    evidencias: [{ tipo: "Testimonio", texto: "No dejan pasar a los de carga", autor: "Conductor de prueba" }],
    reportadoPor: "Evidencia del catálogo",
  };
  const reporte = await caso({
    op: "OP-D04", id: "D04-N1", tipo: "normal", descripcion: "Bloqueo de gravedad Alta en la caseta de Chiapa de Corzo", metodo: "POST", url: "/incidentes", headers: despacho(),
    cuerpo: bloqueo, esperado: 201, detalleEsperado: "sincronizado: true", revisar: (j) => (j.incidente?.sincronizado === true ? null : "no quedó sincronizado"),
  });
  incidenteNuevo = reporte?.incidente?.idIncidente ?? incidenteNuevo;
  await verificacion("OP-D04", "D04-V1", "La réplica en Neo4j tiene el mismo estado que el reporte", `MATCH (i:Incidente {idIncidente: '${incidenteNuevo}'})-[:BLOQUEA]->(p)`, "activo, gravedad Alta, punto INT-CHC", async () => {
    const filas = await leer<{ gravedad: string; activo: boolean; punto: string }>(
      "MATCH (i:Incidente {idIncidente: $id})-[:BLOQUEA]->(p) RETURN i.gravedad AS gravedad, i.activo AS activo, coalesce(p.idCiudad, p.idInterseccion) AS punto",
      { id: incidenteNuevo },
    );
    return { obtenido: filas, ok: filas[0]?.activo === true && filas[0]?.gravedad === "Alta" && filas[0]?.punto === "INT-CHC" };
  });
  await caso({
    op: "OP-D04", id: "D04-L1", tipo: "límite", descripcion: "Punto que existe pero es una estación de tren", metodo: "POST", url: "/incidentes", headers: despacho(),
    cuerpo: { ...bloqueo, idPunto: "EST-TAP" }, esperado: 400,
  });
  await caso({
    op: "OP-D04", id: "D04-E1", tipo: "error", descripcion: "Detalle que no corresponde al tipo", metodo: "POST", url: "/incidentes", headers: despacho(),
    cuerpo: { ...bloqueo, detalle: { volumenEstimadoM3: 50, requiereMaquinaria: true } }, esperado: 400,
  });
  await caso({
    op: "OP-D04", id: "D04-E2", tipo: "error", descripcion: "Punto que no existe en la red", metodo: "POST", url: "/incidentes", headers: despacho(),
    cuerpo: { ...bloqueo, idPunto: "INT-NOEXISTE" }, esperado: 404,
  });
  await caso({
    op: "OP-D04", id: "D04-E3", tipo: "error", descripcion: "Gravedad que no existe", metodo: "POST", url: "/incidentes", headers: despacho(),
    cuerpo: { ...bloqueo, gravedad: "Extrema" }, esperado: 400,
  });

  // El incidente cambia la ruta y afecta al envío que va en camino
  await caso({
    op: "OP-G01", id: "G01-L3", tipo: "límite", descripcion: "Tuxtla a San Cristóbal con la caseta bloqueada por el incidente Alta", url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}`,
    esperado: 200, detalleEsperado: "rodea por Chiapa de Corzo y Acala, 176 min",
    revisar: (j) => (j.minutos === 176 && !nombres(j.ruta).includes("Caseta Chiapa de Corzo") ? null : `minutos ${j.minutos}`), extracto: resumenRuta,
  });

  // ---------- OP-I02 Envíos afectados ----------
  await caso({
    op: "OP-I02", id: "I02-N1", tipo: "normal", descripcion: "El bloqueo nuevo contra los envíos en camino", url: `/incidentes/${incidenteNuevo}/envios-afectados`, esperado: 200,
    detalleEsperado: `${ENVIO} aparece con su desvío y los minutos extra`,
    revisar: (j) => (j.afectados.some((a: any) => a.idEnvio === ENVIO && a.desvio) ? null : "el envío de prueba no aparece como afectado"),
    extracto: (j) => ({ incidente: j.incidente?.idIncidente, revisados: j.revisados, afectados: j.afectados.map((a: any) => ({ idEnvio: a.idEnvio, placa: a.placa, partida: a.partida, destino: a.destino, sinIncidente: a.rutaSinIncidente?.minutos, desvio: a.desvio?.minutos, minutosExtra: a.minutosExtra })), avisos: j.avisos }),
  });
  await caso({
    op: "OP-I02", id: "I02-L1", tipo: "límite", descripcion: "Incidente cerrado (INC-0002)", url: "/incidentes/INC-0002/envios-afectados", esperado: 200,
    detalleEsperado: "afectados vacío con aviso", revisar: (j) => (j.afectados.length === 0 ? null : `${j.afectados.length} afectados`),
    extracto: (j) => ({ revisados: j.revisados, afectados: j.afectados, avisos: j.avisos }),
  });
  await caso({ op: "OP-I02", id: "I02-E1", tipo: "error", descripcion: "Incidente que no existe", url: "/incidentes/INC-9999/envios-afectados", esperado: 404 });

  // ---------- OP-D05 Evidencias ----------
  await caso({
    op: "OP-D05", id: "D05-N1", tipo: "normal", descripcion: "Foto con su URL", metodo: "POST", url: `/incidentes/${incidenteNuevo}/evidencias`, headers: despacho(),
    cuerpo: { tipo: "Foto", url: "https://evidencias.hopwright.local/prueba.jpg", autor: "Despacho Tuxtla" }, esperado: 201,
  });
  await caso({
    op: "OP-D05", id: "D05-L1", tipo: "límite", descripcion: "Testimonio de 2 caracteres (el mínimo)", metodo: "POST", url: `/incidentes/${incidenteNuevo}/evidencias`, headers: despacho(),
    cuerpo: { tipo: "Testimonio", texto: "Ok", autor: "Despacho Tuxtla" }, esperado: 201,
  });
  await caso({
    op: "OP-D05", id: "D05-E1", tipo: "error", descripcion: "Foto sin URL", metodo: "POST", url: `/incidentes/${incidenteNuevo}/evidencias`, headers: despacho(),
    cuerpo: { tipo: "Foto", autor: "Despacho Tuxtla" }, esperado: 400,
  });
  await caso({
    op: "OP-D05", id: "D05-E2", tipo: "error", descripcion: "Incidente que no existe", metodo: "POST", url: "/incidentes/INC-9999/evidencias", headers: despacho(),
    cuerpo: { tipo: "Testimonio", texto: "Prueba", autor: "Despacho" }, esperado: 404,
  });

  // ---------- OP-D06 Consultar incidentes ----------
  await caso({
    op: "OP-D06", id: "D06-N1", tipo: "normal", descripcion: "Solo los activos", url: "/incidentes?activo=true", esperado: 200,
    revisar: (j) => (j.length > 0 && j.every((i: any) => i.activo) ? null : "trae inactivos o viene vacío"),
    extracto: (j) => j.map((i: any) => ({ idIncidente: i.idIncidente, tipo: i.tipo, idPunto: i.idPunto, gravedad: i.gravedad, activo: i.activo })),
  });
  await caso({
    op: "OP-D06", id: "D06-N2", tipo: "normal", descripcion: "El reporte completo con sus evidencias", url: `/incidentes/${incidenteNuevo}`, esperado: 200,
    detalleEsperado: "3 evidencias (la del alta y las dos agregadas)", revisar: (j) => (j.evidencias.length === 3 ? null : `${j.evidencias.length} evidencias`),
  });
  await caso({
    op: "OP-D06", id: "D06-L1", tipo: "límite", descripcion: "Filtro sin resultados", url: "/incidentes?activo=true&gravedad=Baja&tipo=Derrumbe", esperado: 200,
    detalleEsperado: "lista vacía", revisar: (j) => (Array.isArray(j) ? null : "no es una lista"),
  });
  await caso({ op: "OP-D06", id: "D06-E1", tipo: "error", descripcion: "Incidente que no existe", url: "/incidentes/INC-9999", esperado: 404 });
  await caso({ op: "OP-D06", id: "D06-E2", tipo: "error", descripcion: "Identificador mal escrito", url: "/incidentes/incidente1", esperado: 400 });

  // ---------- OP-D07 Cerrar incidente ----------
  await caso({
    op: "OP-D07", id: "D07-N1", tipo: "normal", descripcion: "Cerrar el bloqueo", metodo: "PATCH", url: `/incidentes/${incidenteNuevo}/cerrar`, headers: despacho(),
    cuerpo: { motivoCierre: "Se retiraron los manifestantes" }, esperado: 200, detalleEsperado: "activo: false",
    revisar: (j) => (j.incidente?.activo === false && j.incidente?.sincronizado === true ? null : "no quedó cerrado en las dos bases"),
  });
  await caso({
    op: "OP-G01", id: "G01-L4", tipo: "límite", descripcion: "Con el incidente cerrado la ruta regresa a la autopista", url: `/rutas?origen=${TUXTLA}&destino=${SAN_CRISTOBAL}`,
    esperado: 200, detalleEsperado: "73 min", revisar: (j) => (j.minutos === 73 ? null : `minutos ${j.minutos}`), extracto: resumenRuta,
  });
  await caso({
    op: "OP-D07", id: "D07-E1", tipo: "error", descripcion: "Cerrar otra vez", metodo: "PATCH", url: `/incidentes/${incidenteNuevo}/cerrar`, headers: despacho(),
    cuerpo: { motivoCierre: "Otra vez" }, esperado: 409,
  });

  // ---------- OP-R06 Entrega y transiciones inválidas ----------
  await caso({
    op: "OP-R06", id: "R06-N2", tipo: "normal", descripcion: "Entrega del envío", metodo: "POST", url: `/envios/${ENVIO}/entrega`, headers: despacho(), esperado: 200,
    detalleEsperado: "estado Entregado", revisar: (j) => (j.estado === "Entregado" ? null : `estado ${j.estado}`),
  });
  await caso({ op: "OP-R06", id: "R06-L1", tipo: "límite", descripcion: "Entregar dos veces", metodo: "POST", url: `/envios/${ENVIO}/entrega`, headers: despacho(), esperado: 409 });
  await caso({ op: "OP-R06", id: "R06-E1", tipo: "error", descripcion: "Cancelar un envío ya entregado", metodo: "POST", url: `/envios/${ENVIO}/cancelacion`, headers: despacho(), esperado: 409 });
  await caso({ op: "OP-R06", id: "R06-E2", tipo: "error", descripcion: "Dar salida a un envío que no existe", metodo: "POST", url: "/envios/E-999999/salida", headers: despacho(), esperado: 404 });
  await procesarEventosPendientes();
  await caso({
    op: "OP-R06", id: "R06-V1", tipo: "verificación", descripcion: "Al aplicar ENVIO_ENTREGADO el camión quedó en Comitán (Neo4j)", url: `/vehiculos/${PLACA}/ubicacion`, esperado: 200,
    detalleEsperado: "punto Comitán", revisar: (j) => (j.punto?.idPunto === COMITAN ? null : `punto ${j.punto?.idPunto}`),
  });

  // ---------- OP-D03 Bitácora ----------
  await caso({
    op: "OP-D03", id: "D03-N1", tipo: "normal", descripcion: "Bitácora del envío de prueba", url: `/envios/${ENVIO}/bitacora`, esperado: 200,
    detalleEsperado: "ASIGNACION_CREADA, ENVIO_SALIO y ENVIO_ENTREGADO en orden",
    revisar: (j) => (JSON.stringify(j.eventos.map((e: any) => e.tipo)) === JSON.stringify(["ASIGNACION_CREADA", "ENVIO_SALIO", "ENVIO_ENTREGADO"]) ? null : "eventos distintos"),
    extracto: (j) => ({ idEnvio: j.idEnvio, eventos: j.eventos.map((e: any) => ({ tipo: e.tipo, fecha: e.fecha })) }),
  });
  await caso({
    op: "OP-D03", id: "D03-L1", tipo: "límite", descripcion: "Envío sin eventos todavía (E-101)", url: "/envios/E-101/bitacora", esperado: 200,
    detalleEsperado: "eventos: []", revisar: (j) => (Array.isArray(j.eventos) ? null : "sin lista de eventos"),
  });
  await caso({ op: "OP-D03", id: "D03-E1", tipo: "error", descripcion: "Envío que no existe", url: "/envios/E-999999/bitacora", esperado: 404 });

  // ---------- OP-R07 Consultar envíos ----------
  await caso({
    op: "OP-R07", id: "R07-N1", tipo: "normal", descripcion: "Envíos pendientes", url: "/envios?estado=Pendiente", esperado: 200,
    revisar: (j) => (j.every((e: any) => e.estado === "Pendiente") ? null : "trae otros estados"),
    extracto: (j) => j.map((e: any) => ({ idEnvio: e.idEnvio, estado: e.estado, pesoKg: e.pesoKg })),
  });
  await caso({
    op: "OP-R07", id: "R07-N2", tipo: "normal", descripcion: "Detalle del envío de prueba", url: `/envios/${ENVIO}`, esperado: 200,
    revisar: (j) => (j.estado === "Entregado" ? null : `estado ${j.estado}`),
  });
  await caso({
    op: "OP-R07", id: "R07-L1", tipo: "límite", descripcion: "Filtro por un estado que nadie tiene", url: "/envios?estado=Extraviado", esperado: 200,
    detalleEsperado: "lista vacía", revisar: (j) => (Array.isArray(j) && j.length === 0 ? null : "no vino vacía"),
  });
  await caso({ op: "OP-R07", id: "R07-E1", tipo: "error", descripcion: "Envío que no existe", url: "/envios/E-999999", esperado: 404 });
  await caso({ op: "OP-R07", id: "R07-E2", tipo: "error", descripcion: "Identificador con formato inválido", url: "/envios/X1", esperado: 400 });

  // ---------- OP-I04 Reconciliación ----------
  await caso({ op: "OP-I04", id: "I04-E1", tipo: "error", descripcion: "Sin token", metodo: "POST", url: "/admin/reconciliar", esperado: 401 });
  await caso({ op: "OP-I04", id: "I04-E2", tipo: "error", descripcion: "Con token de despachador", metodo: "POST", url: "/admin/reconciliar", headers: despacho(), esperado: 403 });
  const resumenReconciliar = (j: any) => ({
    incidentes: { revisados: j.incidentes?.revisados, copiados: j.incidentes?.copiados, borradosDelGrafo: j.incidentes?.borradosDelGrafo },
    ciudades: j.ciudades ? { revisadas: j.ciudades.revisadas, copiadas: j.ciudades.copiadas } : null,
    vehiculos: j.vehiculos ? { revisados: j.vehiculos.revisados, copiados: j.vehiculos.copiados, borradosDelGrafo: j.vehiculos.borradosDelGrafo } : null,
    avisos: j.avisos,
  });
  await caso({
    op: "OP-I04", id: "I04-N1", tipo: "normal", descripcion: "Reconciliar como administrador", metodo: "POST", url: "/admin/reconciliar", headers: admin(), esperado: 200,
    extracto: resumenReconciliar,
  });
  await caso({
    op: "OP-I04", id: "I04-L1", tipo: "límite", descripcion: "Reconciliar otra vez enseguida", metodo: "POST", url: "/admin/reconciliar", headers: admin(), esperado: 200,
    detalleEsperado: "no copia ni borra nada (idempotente)",
    revisar: (j) => {
      const cambios = j.incidentes.copiados.length + j.incidentes.borradosDelGrafo.length + (j.ciudades?.copiadas.length ?? 0) + (j.vehiculos?.copiados.length ?? 0) + (j.vehiculos?.borradosDelGrafo.length ?? 0);
      return cambios === 0 ? null : `hizo ${cambios} cambios`;
    },
    extracto: resumenReconciliar,
  });
} finally {
  // ---------- Limpieza ----------
  const ids = [ENVIO];
  await pool.query("DELETE FROM eventos_pendientes WHERE payload->>'idEnvio' = ANY($1) OR payload->>'placa' = $2 OR payload->>'idCiudad' = $3", [ids, PLACA, CIUDAD]);
  await pool.query("DELETE FROM asignacion WHERE id_envio = ANY($1)", [ids]);
  await pool.query("DELETE FROM envio WHERE id_envio = ANY($1)", [ids]);
  await pool.query("DELETE FROM vehiculo WHERE placa = $1", [PLACA]);
  await pool.query("DELETE FROM ciudad WHERE id_ciudad = $1", [CIUDAD]);
  if (clientesCreados.length > 0) await pool.query("DELETE FROM cliente WHERE id_cliente = ANY($1)", [clientesCreados]);
  const db = await mongoDb();
  await db.collection("manifiestos").deleteMany({ idEnvio: { $in: ids } });
  await db.collection("bitacora_envio").deleteMany({ idEnvio: { $in: ids } });
  if (incidenteNuevo !== "INC-0000") await db.collection("reportes_incidente").deleteOne({ idIncidente: incidenteNuevo });
  await escribir("MATCH (v:Vehiculo {placa: $placa}) DETACH DELETE v", { placa: PLACA });
  await escribir("MATCH (c:Ciudad {idCiudad: $id}) DETACH DELETE c", { id: CIUDAD });
  await escribir("MATCH (i:Incidente {idIncidente: $id}) DETACH DELETE i", { id: incidenteNuevo });
  await app.close();
}

// ---------- Reporte ----------
function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "desconocido";
  }
}

function aMarkdown(): string {
  const total = registros.length;
  const cumplen = registros.filter((r) => r.cumple).length;
  const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const lineas: string[] = [
    "# Evidencia del catálogo de operaciones",
    "",
    `Generado por \`npm run catalogo\` (tests/catalogo/evidencia.mts) el ${fecha}, commit \`${commit()}\`. Cada caso es una petición HTTP real a la API con las tres bases en Docker; los de tipo verificación revisan directo en la base que un cambio llegó a su réplica.`,
    "",
    `Resultado: ${cumplen} de ${total} casos cumplen lo esperado.`,
    "",
    `Datos de la corrida: envío ${ENVIO}, vehículo ${PLACA}, ciudad ${CIUDAD}, incidente ${incidenteNuevo}. Todo se borró de las tres bases al terminar.`,
    "",
  ];
  for (const op of Object.keys(OPERACIONES)) {
    const casos = registros.filter((r) => r.op === op);
    if (casos.length === 0) continue;
    lineas.push(`## ${op}. ${OPERACIONES[op]}`, "");
    lineas.push("| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |", "|---|---|---|---|---|---|---|");
    for (const c of casos) {
      lineas.push(`| ${c.id} | ${c.tipo} | \`${c.solicitud.replace(/\|/g, "\\|")}\` | ${c.esperado} | ${c.obtenido} | ${c.ms} | ${c.cumple ? "sí" : `no: ${c.motivo ?? ""}`} |`);
    }
    lineas.push("");
    for (const c of casos) {
      lineas.push(`${c.id}. ${c.descripcion}.`, "");
      if (c.cuerpo !== undefined) lineas.push("Cuerpo enviado:", "", "```json", JSON.stringify(c.cuerpo), "```", "");
      lineas.push("Respuesta:", "", "```json", typeof c.extracto === "string" ? c.extracto : JSON.stringify(c.extracto, null, 1), "```", "");
    }
  }
  return lineas.join("\n");
}

const carpeta = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/pruebas");
mkdirSync(carpeta, { recursive: true });
writeFileSync(resolve(carpeta, "catalogo-evidencia.md"), aMarkdown());
writeFileSync(resolve(carpeta, "catalogo-evidencia.json"), JSON.stringify({ fecha: new Date().toISOString(), commit: commit(), casos: registros }, null, 2) + "\n");
const fallas = registros.filter((r) => !r.cumple);
console.log(`\n${registros.length - fallas.length} de ${registros.length} casos cumplen. Evidencia en docs/pruebas/catalogo-evidencia.md`);
if (fallas.length > 0) process.exitCode = 1;
