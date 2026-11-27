// Pide a OSRM (servidor público de OpenStreetMap) la ruta en coche entre cada par de puntos de
// fuentes/pares-osrm.json y guarda distancia, tiempo, trazo y datos de cada tramo de la ruta
// (número de carretera y si es de cuota) en fuentes/osrm-rutas.json. Con ese archivo,
// generar-red.mjs arma la red de Neo4j.
//
// Uso, desde la raíz del proyecto (necesita internet, tarda unos 12 minutos):
//   node database/graph/scripts/consultar-osrm.mjs
//
// Si se interrumpe, se vuelve a correr y sigue con los pares que faltan. El servidor público pide
// no hacer más de una petición por segundo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const carpeta = join(dirname(fileURLToPath(import.meta.url)), "..", "fuentes");
const entrada = join(carpeta, "pares-osrm.json");
const salida = join(carpeta, "osrm-rutas.json");
const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";
const ESPERA_MS = 1100;

const { pares } = JSON.parse(readFileSync(entrada, "utf-8"));
const rutas = existsSync(salida) ? JSON.parse(readFileSync(salida, "utf-8")) : {};
// También se repiten los que fallaron por red (no los que OSRM contestó que no tienen ruta)
const pendientes = pares.filter((p) => !rutas[`${p.a}|${p.b}`] || rutas[`${p.a}|${p.b}`].motivo === "sin respuesta");
console.log(`${pares.length - pendientes.length} pares ya consultados; faltan ${pendientes.length}\n`);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const redondear = ([lon, lat]) => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];

// Douglas-Peucker: quita puntos que casi no cambian la forma (tolerancia en grados, ~30 m)
function simplificar(puntos, tolerancia = 0.0003) {
  if (puntos.length < 3) return puntos;
  const [a, b] = [puntos[0], puntos[puntos.length - 1]];
  let maximo = 0;
  let indice = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const [x, y] = puntos[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const largo = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / largo;
    if (d > maximo) [maximo, indice] = [d, i];
  }
  if (maximo <= tolerancia) return [a, b];
  return [...simplificar(puntos.slice(0, indice + 1), tolerancia).slice(0, -1), ...simplificar(puntos.slice(indice), tolerancia)];
}

async function consultar(p) {
  const coords = `${p.desde[0]},${p.desde[1]};${p.hasta[0]},${p.hasta[1]}`;
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  for (let intento = 1; intento <= 5; intento++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Hopwright (proyecto escolar UPChiapas)" } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();
      if (datos.code !== "Ok" || !datos.routes?.length) return { ok: false, motivo: datos.code ?? `HTTP ${res.status}` };
      const ruta = datos.routes[0];
      // Cada paso de la ruta: dónde empieza (metros desde la salida), cuánto mide, cuánto tarda,
      // el número de carretera y las clases que marca OSRM (toll = cuota, motorway = autopista)
      let acumulado = 0;
      const pasos = [];
      for (const paso of ruta.legs[0].steps) {
        const clases = [...new Set(paso.intersections.flatMap((i) => i.classes ?? []))];
        if (paso.distance > 0) pasos.push([Math.round(acumulado), Math.round(paso.distance), Math.round(paso.duration), paso.ref ?? "", paso.name ?? "", clases]);
        acumulado += paso.distance;
      }
      return {
        ok: true,
        metros: Math.round(ruta.distance),
        segundos: Math.round(ruta.duration),
        puntosAjustados: datos.waypoints.map((w) => redondear(w.location)),
        trazo: simplificar(ruta.geometry.coordinates.map(redondear)),
        pasos,
      };
    } catch (e) {
      console.log(`  ${p.a}-${p.b}: ${e.message}, reintento ${intento} de 5`);
      await dormir(5000 * intento);
    }
  }
  return { ok: false, motivo: "sin respuesta" };
}

let i = 0;
for (const p of pendientes) {
  i++;
  const inicio = Date.now();
  const r = await consultar(p);
  rutas[`${p.a}|${p.b}`] = r;
  console.log(`${i}/${pendientes.length} ${p.a}-${p.b}: ${r.ok ? `${(r.metros / 1000).toFixed(1)} km, ${Math.round(r.segundos / 60)} min` : `sin ruta (${r.motivo})`}`);
  if (i % 20 === 0 || i === pendientes.length) writeFileSync(salida, JSON.stringify(rutas));
  await dormir(Math.max(0, ESPERA_MS - (Date.now() - inicio)));
}
writeFileSync(salida, JSON.stringify(rutas));
const fallidos = Object.values(rutas).filter((r) => !r.ok).length;
console.log(`\nListo: ${Object.keys(rutas).length} pares en ${salida}${fallidos ? ` (${fallidos} sin ruta)` : ""}`);
