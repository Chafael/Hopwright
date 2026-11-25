// Arma la red de carreteras de Chiapas a partir de las rutas de OSRM (fuentes/osrm-rutas.json) y escribe:
//   - database/graph/data/01_red_chiapas.cypher  (ciudades, intersecciones, estaciones y tramos)
//   - frontend/static/geometria-tramos.json       (trazo de cada tramo para el mapa)
//
// Uso, desde la raíz del proyecto: node database/graph/scripts/generar-red.mjs
//
// Pasos:
// 1. Se descartan las rutas que OSRM no encontró y las que cruzan Guatemala.
// 2. Cada ruta se corta en los puntos de la red por los que pasa: si la ruta de A a B cruza el pueblo C,
//    quedan los tramos A-C y C-B. Así un tramo une dos puntos vecinos y no se salta pueblos.
// 3. Entre cada par de puntos se queda el tramo más rápido.
// 4. Se quitan los tramos que sobran: si de A a B ya se llega pasando por otros puntos en casi el mismo
//    tiempo (5 % más como máximo), el tramo directo es la misma carretera vista dos veces.
// 5. Cada tramo se clasifica con lo que reporta OpenStreetMap: Autopista si la mayor parte es de cuota o
//    autopista, Terracería si la mayor parte se recorre a menos de 28 km/h, Federal si la mayor parte
//    lleva número de carretera federal (MEX) y Estatal en otro caso.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fuentes = join(raiz, "database", "graph", "fuentes");
const leer = (archivo) => JSON.parse(readFileSync(join(fuentes, archivo), "utf-8"));

// Un camión de carga tarda más que el auto con el que calcula OSRM
const FACTOR_CAMION = 1.2;
// Pesos por kilómetro de autopista de cuota para un camión (la caseta de Chiapa de Corzo a San Cristóbal
// cobra unos 180 pesos por 33 km)
const CASETA_POR_KM = 5.5;
const VELOCIDAD_TERRACERIA = 28;
const TOLERANCIA_REDUNDANTE = 1.05;
// Qué tan cerca (km) tiene que pasar una ruta de un punto para considerar que lo cruza
const CERCA_CIUDAD = 0.7;
const CERCA_INTERSECCION = 0.4;

const cabeceras = leer("cabeceras.json");
const { nodos } = leer("pares-osrm.json");
const rutas = leer("osrm-rutas.json");
const guatemala = leer("guatemala.geojson").geometry.coordinates;

// ---------- Geometría en un plano local (km) ----------
const LAT0 = 16.5;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110.57;
const plano = ([lon, lat]) => [lon * KX, lat * KY];

function acumulados(linea) {
  const d = [0];
  for (let i = 1; i < linea.length; i++) {
    const [a, b] = [plano(linea[i - 1]), plano(linea[i])];
    d.push(d[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return d;
}

// Distancia del punto a la línea y en qué kilómetro de la línea queda su proyección
function proyectar(punto, linea, acum) {
  const p = plano(punto);
  let mejor = { distancia: Infinity, km: 0 };
  for (let i = 1; i < linea.length; i++) {
    const [a, b] = [plano(linea[i - 1]), plano(linea[i])];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const largo2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2));
    const distancia = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (distancia < mejor.distancia) mejor = { distancia, km: acum[i - 1] + t * (acum[i] - acum[i - 1]) };
  }
  return mejor;
}

function interpolar(linea, acum, km) {
  for (let i = 1; i < linea.length; i++) {
    if (acum[i] >= km) {
      const t = (km - acum[i - 1]) / (acum[i] - acum[i - 1] || 1);
      const [a, b] = [linea[i - 1], linea[i]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return linea[linea.length - 1];
}

function recortar(linea, acum, desde, hasta) {
  const fuera = [interpolar(linea, acum, desde)];
  for (let i = 0; i < linea.length; i++) if (acum[i] > desde && acum[i] < hasta) fuera.push(linea[i]);
  fuera.push(interpolar(linea, acum, hasta));
  return fuera.map(([lon, lat]) => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
}

function dentro([x, y], anillo) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
const enGuatemala = (punto) => dentro(punto, guatemala[0]) && !guatemala.slice(1).some((hueco) => dentro(punto, hueco));

// ---------- Datos de un pedazo de ruta a partir de los pasos de OSRM ----------
// pasos: [inicio en metros, metros, segundos, número de carretera, nombre, clases]
function describir(pasos, m0, m1) {
  let segundos = 0;
  const metros = { cuota: 0, federal: 0, lento: 0, total: 0 };
  for (const [inicio, largo, dura, ref, , clases] of pasos) {
    const traslape = Math.min(m1, inicio + largo) - Math.max(m0, inicio);
    if (traslape <= 0 || largo <= 0) continue;
    segundos += (dura * traslape) / largo;
    metros.total += traslape;
    if (clases.includes("toll") || clases.includes("motorway")) metros.cuota += traslape;
    if (/MEX/i.test(ref)) metros.federal += traslape;
    if (dura > 0 && (largo / dura) * 3.6 < VELOCIDAD_TERRACERIA) metros.lento += traslape;
  }
  return { segundos, metros };
}

// ---------- 1 y 2. Rutas válidas, cortadas en los puntos que cruzan ----------
const tipoDe = (id) => (id.startsWith("INT-") ? "Interseccion" : "Ciudad");
// Dónde ajustó OSRM cada punto a la carretera (sirve para saber si una ruta pasa por él)
const ajustado = new Map();
for (const [clave, r] of Object.entries(rutas)) {
  if (!r.ok) continue;
  const [a, b] = clave.split("|");
  if (!ajustado.has(a)) ajustado.set(a, r.puntosAjustados[0]);
  if (!ajustado.has(b)) ajustado.set(b, r.puntosAjustados[1]);
}

const descartadas = { sinRuta: 0, guatemala: 0 };
const candidatos = new Map(); // "u|v" (u < v) -> mejor pedazo
function proponer(u, v, pedazo) {
  if (u === v) return;
  const [x, y, linea] = u < v ? [u, v, pedazo.linea] : [v, u, [...pedazo.linea].reverse()];
  const clave = `${x}|${y}`;
  const actual = candidatos.get(clave);
  if (!actual || pedazo.segundos < actual.segundos) candidatos.set(clave, { ...pedazo, desde: x, hasta: y, linea });
}

for (const [clave, r] of Object.entries(rutas)) {
  if (!r.ok) {
    descartadas.sinRuta++;
    continue;
  }
  if (r.trazo.some(enGuatemala)) {
    descartadas.guatemala++;
    continue;
  }
  const [a, b] = clave.split("|");
  const acum = acumulados(r.trazo);
  const largo = acum[acum.length - 1] || 1e-9;
  // Puntos de la red por los que pasa la ruta, en orden
  const cortes = [{ id: a, km: 0 }];
  for (const [id, punto] of ajustado) {
    if (id === a || id === b) continue;
    const cerca = tipoDe(id) === "Ciudad" ? CERCA_CIUDAD : CERCA_INTERSECCION;
    const p = proyectar(punto, r.trazo, acum);
    if (p.distancia <= cerca && p.km > 0.3 && p.km < largo - 0.3) cortes.push({ id, km: p.km });
  }
  cortes.push({ id: b, km: largo });
  cortes.sort((x, y) => x.km - y.km);
  for (let i = 1; i < cortes.length; i++) {
    const [c0, c1] = [cortes[i - 1], cortes[i]];
    const [m0, m1] = [(c0.km / largo) * r.metros, (c1.km / largo) * r.metros];
    const { segundos, metros } = describir(r.pasos, m0, m1);
    proponer(c0.id, c1.id, { km: (m1 - m0) / 1000, segundos, metros, linea: recortar(r.trazo, acum, c0.km, c1.km), directa: cortes.length === 2 });
  }
}

// ---------- 4. Quitar tramos redundantes ----------
const tramos = new Map(candidatos);
function vecinos() {
  const v = new Map();
  for (const [clave, t] of tramos) {
    for (const [x, y] of [[t.desde, t.hasta], [t.hasta, t.desde]]) {
      if (!v.has(x)) v.set(x, []);
      v.get(x).push({ a: y, s: t.segundos, clave });
    }
  }
  return v;
}
function caminoMasCorto(v, origen, destino, sinClave, limite) {
  const dist = new Map([[origen, 0]]);
  const pendientes = [[0, origen]];
  while (pendientes.length) {
    pendientes.sort((x, y) => x[0] - y[0]);
    const [d, u] = pendientes.shift();
    if (u === destino) return d;
    if (d > (dist.get(u) ?? Infinity) || d > limite) continue;
    for (const { a, s, clave } of v.get(u) ?? []) {
      if (clave === sinClave) continue;
      const nd = d + s;
      if (nd < (dist.get(a) ?? Infinity)) {
        dist.set(a, nd);
        pendientes.push([nd, a]);
      }
    }
  }
  return Infinity;
}
let quitados = 0;
for (const [clave, t] of [...tramos].sort((x, y) => y[1].segundos - x[1].segundos)) {
  const v = vecinos();
  const limite = t.segundos * TOLERANCIA_REDUNDANTE;
  if (caminoMasCorto(v, t.desde, t.hasta, clave, limite) <= limite) {
    tramos.delete(clave);
    quitados++;
  }
}

// ---------- 5. Clasificación ----------
function clasificar(t) {
  const { cuota, federal, lento, total } = t.metros;
  const parte = (m) => m / (total || 1);
  if (parte(cuota) >= 0.5) return "Autopista";
  if (parte(lento) >= 0.5) return "Terracería";
  if (parte(federal) >= 0.5) return "Federal";
  return "Estatal";
}
const lista = [...tramos.values()]
  .map((t) => {
    const via = clasificar(t);
    const kmCuota = t.metros.cuota / 1000;
    return {
      ...t,
      via,
      km: Math.max(0.5, Math.round(t.km * 10) / 10),
      // Nunca más rápido que 100 km/h, para que el redondeo de tramos cortos no rompa la regla R15
      min: Math.max(1, Math.round((t.segundos / 60) * FACTOR_CAMION), Math.ceil((t.km * 60) / 100)),
      caseta: via === "Autopista" && kmCuota >= 5 ? Math.max(20, Math.round((kmCuota * CASETA_POR_KM) / 10) * 10) : 0,
    };
  })
  .sort((x, y) => x.desde.localeCompare(y.desde) || x.hasta.localeCompare(y.hasta));

// ---------- Revisión: componentes conectados ----------
const ids = nodos.map((n) => n.id);
const adyacencia = new Map(ids.map((id) => [id, []]));
for (const t of lista) {
  adyacencia.get(t.desde)?.push(t.hasta);
  adyacencia.get(t.hasta)?.push(t.desde);
}
const visto = new Set();
const componentes = [];
for (const id of ids) {
  if (visto.has(id)) continue;
  const grupo = [];
  const pila = [id];
  visto.add(id);
  while (pila.length) {
    const u = pila.pop();
    grupo.push(u);
    for (const w of adyacencia.get(u) ?? []) if (!visto.has(w)) (visto.add(w), pila.push(w));
  }
  componentes.push(grupo);
}
componentes.sort((x, y) => y.length - x.length);

// ---------- Escribir el Cypher ----------
const plantilla = readFileSync(join(raiz, "database", "graph", "data", "01_red_chiapas.cypher"), "utf-8");
const desdeEstaciones = plantilla.slice(plantilla.indexOf("// ---------- Estaciones de tren"), plantilla.indexOf("// ---------- Tramos de carretera"));
const desdeVias = plantilla.slice(plantilla.indexOf("// ---------- Vía férrea"));
const intersecciones = [
  ["INT-CHC", "Caseta Chiapa de Corzo", "Caseta"],
  ["INT-OCO", "Entronque Ocozocoautla", "Cruce"],
  ["INT-CRU", "Entronque Las Cruces", "Cruce"],
  ["INT-TPN", "Entronque Tapanatepec", "Cruce"],
  ["INT-AMA", "Entronque Amatenango", "Cruce"],
  ["INT-OXC", "Entronque Oxchuc", "Cruce"],
  ["INT-ESC", "Entronque Escuintla", "Cruce"],
  ["INT-BOC", "Entronque Bochil", "Cruce"],
  ["INT-FCO", "Glorieta Frontera Comalapa", "Glorieta"],
];
const texto = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const conteoVia = lista.reduce((c, t) => ((c[t.via] = (c[t.via] ?? 0) + 1), c), {});
const cypher = `// Red de carreteras de Chiapas: las ${cabeceras.length} cabeceras municipales, ${intersecciones.length} intersecciones y 5 estaciones de tren,
// con ${lista.length} tramos de carretera y 4 de vía férrea.
//
// ARCHIVO GENERADO por database/graph/scripts/generar-red.mjs; no se edita a mano.
// Fuentes (ver database/graph/fuentes/LEEME.md):
// - Ciudades: cabeceras municipales del catálogo AGEEML del INEGI. La clave es la del municipio.
// - Tramos: rutas de OSRM sobre OpenStreetMap (© colaboradores de OpenStreetMap, ODbL) entre puntos
//   vecinos. El tiempo es el de OSRM por ${FACTOR_CAMION} (camión de carga). Las casetas se estiman a
//   ${CASETA_POR_KM} pesos por km de autopista de cuota.
//
// Tramos por tipo de vía: ${Object.entries(conteoVia).map(([k, v]) => `${k} ${v}`).join(", ")}.
// Cada tramo se guarda como dos aristas CARRETERA, una por sentido (regla R14).
// El script usa MERGE, así que correrlo dos veces no duplica nada.

// ---------- Ciudades (réplica del catálogo de PostgreSQL) ----------
UNWIND [
${cabeceras.map((c) => `  {id: '${c.id}', nombre: ${texto(c.municipio)}, lat: ${c.lat.toFixed(6)}, lon: ${c.lon.toFixed(6)}}`).join(",\n")}
] AS c
MERGE (n:Ciudad {idCiudad: c.id})
SET n.nombre = c.nombre, n.latitud = c.lat, n.longitud = c.lon;

// ---------- Intersecciones (ubicadas donde OSRM las ajusta a la carretera) ----------
UNWIND [
${intersecciones
  .map(([id, nombre, tipo]) => {
    const original = nodos.find((n) => n.id === id);
    const [lon, lat] = ajustado.get(id) ?? [original.lon, original.lat];
    return `  {id: '${id}', nombre: ${texto(nombre)}, tipo: '${tipo}', lat: ${lat.toFixed(5)}, lon: ${lon.toFixed(5)}}`;
  })
  .join(",\n")}
] AS i
MERGE (n:Interseccion {idInterseccion: i.id})
SET n.nombre = i.nombre, n.tipo = i.tipo, n.latitud = i.lat, n.longitud = i.lon;

${desdeEstaciones}// ---------- Tramos de carretera (dos aristas por tramo, una por sentido) ----------
// a, b: idCiudad o idInterseccion. km, min: distancia y tiempo (iguales en los dos sentidos).
// caseta: costo de caseta en pesos.
UNWIND [
${lista.map((t) => `  {a: '${t.desde}', b: '${t.hasta}', km: ${t.km}, min: ${t.min}, caseta: ${t.caseta}, via: '${t.via}'}`).join(",\n")}
] AS t
MATCH (x) WHERE (x:Ciudad AND x.idCiudad = t.a) OR (x:Interseccion AND x.idInterseccion = t.a)
MATCH (y) WHERE (y:Ciudad AND y.idCiudad = t.b) OR (y:Interseccion AND y.idInterseccion = t.b)
MERGE (x)-[ida:CARRETERA {tipoVia: t.via}]->(y)
SET ida.distanciaKm = toFloat(t.km), ida.tiempoMin = t.min, ida.costoCaseta = toFloat(t.caseta), ida.abierto = true
MERGE (y)-[vuelta:CARRETERA {tipoVia: t.via}]->(x)
SET vuelta.distanciaKm = toFloat(t.km), vuelta.tiempoMin = t.min, vuelta.costoCaseta = toFloat(t.caseta), vuelta.abierto = true;

${desdeVias}`;
writeFileSync(join(raiz, "database", "graph", "data", "01_red_chiapas.cypher"), cypher);

const geometria = Object.fromEntries(lista.map((t) => [`${t.desde}|${t.hasta}`, t.linea]));
writeFileSync(join(raiz, "frontend", "static", "geometria-tramos.json"), JSON.stringify(geometria));

// ---------- Resumen ----------
const nombre = new Map(nodos.map((n) => [n.id, n.nombre]));
console.log(`Rutas de OSRM: ${Object.keys(rutas).length} (sin ruta: ${descartadas.sinRuta}, por Guatemala: ${descartadas.guatemala})`);
console.log(`Tramos: ${candidatos.size} candidatos, ${quitados} redundantes, ${lista.length} en la red`);
console.log(`Por tipo de vía: ${JSON.stringify(conteoVia)}; con caseta: ${lista.filter((t) => t.caseta > 0).length}`);
console.log(`Kilómetros de carretera: ${Math.round(lista.reduce((s, t) => s + t.km, 0))}`);
console.log(`Componentes: ${componentes.length} (${componentes.map((c) => c.length).join(", ")})`);
for (const c of componentes.slice(1)) console.log(`  aparte: ${c.map((id) => `${id} ${nombre.get(id)}`).join(", ")}`);
const sinTramos = ids.filter((id) => !(adyacencia.get(id) ?? []).length);
if (sinTramos.length) console.log(`Sin tramos: ${sinTramos.map((id) => `${id} ${nombre.get(id)}`).join(", ")}`);
