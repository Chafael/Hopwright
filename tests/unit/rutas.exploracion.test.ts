import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dijkstra, dijkstraBidireccional, type AristaRed, type RedExploracion } from "../../backend/src/services/rutas.exploracion.js";

// Red chica hecha a mano:
//   A --10--> B --10--> D
//   A --5---> C --30--> D
//   B <-> C (2), C es terracería hacia D
const ida = (desde: string, hasta: string, tiempoMin: number, extra: Partial<AristaRed> = {}): AristaRed[] => [
  { desde, hasta, tiempoMin, distanciaKm: tiempoMin, costoCaseta: 0, tipoVia: "Federal", abierto: true, ...extra },
  { desde: hasta, hasta: desde, tiempoMin, distanciaKm: tiempoMin, costoCaseta: 0, tipoVia: "Federal", abierto: true, ...extra },
];
const chica = (bloqueados: string[] = []): RedExploracion => ({
  aristas: [...ida("A", "B", 10), ...ida("B", "D", 10), ...ida("A", "C", 5), ...ida("C", "D", 30, { tipoVia: "Terracería" }), ...ida("B", "C", 2)],
  bloqueados: new Set(bloqueados),
});

describe("dijkstra paso a paso", () => {
  it("encuentra el camino más barato y registra cada punto y tramo revisado", () => {
    const r = dijkstra(chica(), "A", "D", "tiempo", false);
    expect(r.ruta).toEqual(["A", "C", "B", "D"]);
    expect(r.minutos).toBe(17);
    // Visita los puntos en orden de costo: A (0), C (5), B (7), D (17)
    expect(r.pasos.filter((p) => p.tipo === "visita").map((p) => (p.tipo === "visita" ? p.punto : ""))).toEqual(["A", "C", "B", "D"]);
    expect(r.explorados).toBe(4);
    expect(r.tramosRevisados).toBeGreaterThan(0);
  });

  it("respeta los puntos bloqueados y la terracería", () => {
    expect(dijkstra(chica(["B"]), "A", "D", "tiempo", false).ruta).toEqual(["A", "C", "D"]);
    expect(dijkstra(chica(["B"]), "A", "D", "tiempo", true).encontrada).toBe(false);
    expect(dijkstra(chica(["D"]), "A", "D", "tiempo", false).encontrada).toBe(false);
  });

  it("no usa tramos cerrados", () => {
    const red = chica();
    red.aristas = red.aristas.map((a) => (a.desde === "C" && a.hasta === "B" ? { ...a, abierto: false } : a));
    expect(dijkstra(red, "A", "D", "tiempo", false).ruta).toEqual(["A", "B", "D"]);
  });

  it("el bidireccional llega al mismo costo y crece desde los dos lados", () => {
    const normal = dijkstra(chica(), "A", "D", "tiempo", false);
    const bi = dijkstraBidireccional(chica(), "A", "D", "tiempo", false);
    expect(bi.minutos).toBe(normal.minutos);
    const lados = new Set(bi.pasos.map((p) => p.lado));
    expect(lados).toEqual(new Set(["origen", "destino"]));
  });
});

// La red de ejemplo de Chiapas, leída del mismo script que carga Neo4j
function redDeChiapas(bloqueados: string[] = []): RedExploracion {
  const cypher = readFileSync(fileURLToPath(new URL("../../database/graph/data/01_red_chiapas.cypher", import.meta.url)), "utf-8");
  const aristas: AristaRed[] = [];
  const patron = /\{a: '([\w-]+)',\s*b: '([\w-]+)',\s*km: ([\d.]+),\s*min: (\d+),(?:\s*minVuelta: (\d+),)?\s*caseta: (\d+),\s*via: '([^']+)'\}/g;
  for (const m of cypher.matchAll(patron)) {
    const [, a, b, km, min, minVuelta, caseta, via] = m;
    const base = { distanciaKm: Number(km), costoCaseta: Number(caseta), tipoVia: via, abierto: true };
    aristas.push({ desde: a, hasta: b, tiempoMin: Number(min), ...base });
    aristas.push({ desde: b, hasta: a, tiempoMin: Number(minVuelta ?? min), ...base });
  }
  return { aristas, bloqueados: new Set(bloqueados) };
}

describe("sobre la red de Chiapas (mismos resultados que espera Neo4j en las pruebas de integración)", () => {
  it("lee los 65 tramos de carretera", () => {
    expect(redDeChiapas().aristas).toHaveLength(130);
  });

  it("Tuxtla a San Cristóbal: 72 minutos por tiempo y sin casetas por costo", () => {
    expect(dijkstra(redDeChiapas(), "07101", "07078", "tiempo", false).minutos).toBe(72);
    const barata = dijkstra(redDeChiapas(), "07101", "07078", "costo", false);
    expect(barata.costoCasetas).toBe(0);
    expect(barata.minutos).toBe(105);
  });

  it("Tuxtla a Arriaga: 193 minutos por terracería y 218 evitándola", () => {
    expect(dijkstra(redDeChiapas(), "07101", "07009", "tiempo", false).minutos).toBe(193);
    expect(dijkstra(redDeChiapas(), "07101", "07009", "tiempo", true).minutos).toBe(218);
  });

  it("con Las Cruces bloqueado, el rodeo a Arriaga tarda 652 minutos", () => {
    expect(dijkstra(redDeChiapas(["INT-CRU"]), "07101", "07009", "tiempo", true).minutos).toBe(652);
  });

  it("el bidireccional da el mismo resultado en todos los pares y en general revisa menos puntos", () => {
    const red = redDeChiapas();
    const ciudades = [...new Set(red.aristas.map((a) => a.desde))].filter((id) => /^\d{5}$/.test(id));
    let menosOIgual = 0;
    let total = 0;
    for (const o of ciudades) {
      for (const d of ciudades) {
        if (o === d) continue;
        const normal = dijkstra(red, o, d, "tiempo", false);
        const bi = dijkstraBidireccional(red, o, d, "tiempo", false);
        expect(bi.minutos).toBe(normal.minutos);
        total++;
        if (bi.explorados <= normal.explorados) menosOIgual++;
      }
    }
    expect(menosOIgual / total).toBeGreaterThan(0.6);
  });
});
