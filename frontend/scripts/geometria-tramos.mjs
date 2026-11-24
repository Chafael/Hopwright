// Genera static/geometria-tramos.json con el trazo real de cada tramo de carretera, para que el mapa
// dibuje las líneas siguiendo la carretera y no en línea recta.
//
// Toma los tramos de la API (GET /red/mapa) y le pide a OSRM, el ruteador público de OpenStreetMap,
// el camino entre los dos extremos de cada uno. Se corre una sola vez y el resultado se sube al repositorio;
// solo hay que repetirlo si se agregan tramos. Los tramos de tren se quedan rectos (OSRM no rutea vías).
//
// Uso, con el backend corriendo: npm run geometria
// La API se toma de VITE_API_URL o de http://localhost:3000.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = process.env.VITE_API_URL ?? "http://localhost:3000";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const salida = fileURLToPath(new URL("../static/geometria-tramos.json", import.meta.url));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Quita puntos que casi no cambian la forma (a menos de ~50 m del anterior) para que el archivo pese poco
function simplificar(coords) {
  const r = (n) => Math.round(n * 1e5) / 1e5;
  const fuera = [coords[0]];
  for (const c of coords.slice(1, -1)) {
    const u = fuera.at(-1);
    if (Math.hypot(c[0] - u[0], c[1] - u[1]) > 0.0005) fuera.push(c);
  }
  fuera.push(coords.at(-1));
  return fuera.map(([lon, lat]) => [r(lon), r(lat)]);
}

const mapa = await (await fetch(`${API}/red/mapa`)).json();
const coords = new Map(mapa.puntos.filter((p) => p.latitud != null).map((p) => [p.idPunto, [p.longitud, p.latitud]]));
const tramos = mapa.tramos.filter((t) => t.tipo === "CARRETERA");

const geometrias = {};
let i = 0;
for (const t of tramos) {
  i++;
  const a = coords.get(t.desde);
  const b = coords.get(t.hasta);
  if (!a || !b) continue;
  const url = `${OSRM}/${a.join(",")};${b.join(",")}?overview=full&geometries=geojson`;
  try {
    const r = await (await fetch(url)).json();
    const ruta = r.routes?.[0];
    if (!ruta) throw new Error(r.message ?? "sin ruta");
    const km = ruta.distance / 1000;
    // Si OSRM da un camino mucho más largo que el tramo, probablemente se fue por otra carretera: se queda recto
    if (km > t.distanciaKm * 2.5 + 10) {
      console.log(`${i}/${tramos.length} ${t.desde}-${t.hasta}: OSRM da ${km.toFixed(0)} km y el tramo mide ${t.distanciaKm}; se deja recto`);
    } else {
      geometrias[`${t.desde}|${t.hasta}`] = simplificar(ruta.geometry.coordinates);
      console.log(`${i}/${tramos.length} ${t.desde}-${t.hasta}: ${geometrias[`${t.desde}|${t.hasta}`].length} puntos`);
    }
  } catch (e) {
    console.log(`${i}/${tramos.length} ${t.desde}-${t.hasta}: no se pudo (${e.message}); se deja recto`);
  }
  // El servidor público de OSRM pide no mandar más de una petición por segundo
  await esperar(1100);
}

writeFileSync(salida, JSON.stringify(geometrias) + "\n");
console.log(`\nListo: ${Object.keys(geometrias).length} de ${tramos.length} tramos con trazo real en static/geometria-tramos.json`);
