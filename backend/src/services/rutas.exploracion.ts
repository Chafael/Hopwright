// Dijkstra paso a paso sobre la red de carreteras, para que la interfaz pueda mostrar cómo se busca una ruta.
//
// La ruta oficial la sigue calculando Neo4j (apoc.algo.dijkstra en rutas.repository.ts). Aquí se repite
// el mismo algoritmo sobre la misma red y con las mismas restricciones, pero guardando el orden en que se
// revisa cada punto y cada tramo. El servicio compara el resultado con el de Neo4j: si los dos llegan al
// mismo costo, la animación muestra exactamente lo que pasó.
//
// Son funciones puras (no tocan ninguna base) para poder probarlas sin Neo4j.

export type CriterioExploracion = "tiempo" | "distancia" | "costo";
export type Algoritmo = "dijkstra" | "bidireccional";

export type AristaRed = {
  desde: string;
  hasta: string;
  tiempoMin: number;
  distanciaKm: number;
  costoCaseta: number;
  tipoVia: string;
  abierto: boolean;
};

export type RedExploracion = { aristas: AristaRed[]; bloqueados: Set<string> };

// Un paso de la búsqueda, en el orden en que ocurrió.
// visita: el punto quedó resuelto (ya se conoce su mejor costo desde el lado que lo visitó).
// tramo: se revisó un tramo para ver si mejora el costo del punto del otro extremo.
//        desde es el punto ya resuelto y hasta el vecino; en la búsqueda desde el destino el tramo
//        se recorre al revés, así que la carretera real va de hasta a desde.
export type Paso =
  | { tipo: "visita"; punto: string; lado: "origen" | "destino"; costo: number }
  | { tipo: "tramo"; desde: string; hasta: string; lado: "origen" | "destino"; mejora: boolean };

export type ResultadoExploracion = {
  algoritmo: Algoritmo;
  encontrada: boolean;
  ruta: string[];
  costo: number;
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  explorados: number;
  tramosRevisados: number;
  pasos: Paso[];
};

// Peso de un tramo según el criterio. Neo4j desempata por minutos (ORDER BY weight, minutos);
// aquí se suma una fracción muy pequeña de los minutos para desempatar igual.
export function peso(a: AristaRed, criterio: CriterioExploracion): number {
  const base = criterio === "tiempo" ? a.tiempoMin : criterio === "distancia" ? a.distanciaKm : a.costoCaseta;
  return base + a.tiempoMin * 1e-6;
}

// Cola de prioridad mínima (montículo binario). Con unos cuantos cientos de puntos alcanza y sobra.
class Cola {
  private datos: { costo: number; punto: string }[] = [];
  get vacia() {
    return this.datos.length === 0;
  }
  get minimo() {
    return this.datos[0]?.costo ?? Number.POSITIVE_INFINITY;
  }
  meter(costo: number, punto: string) {
    const d = this.datos;
    d.push({ costo, punto });
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p].costo <= d[i].costo) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }
  sacar() {
    const d = this.datos;
    const primero = d[0];
    const ultimo = d.pop()!;
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const izq = 2 * i + 1;
        const der = izq + 1;
        let menor = i;
        if (izq < d.length && d[izq].costo < d[menor].costo) menor = izq;
        if (der < d.length && d[der].costo < d[menor].costo) menor = der;
        if (menor === i) break;
        [d[menor], d[i]] = [d[i], d[menor]];
        i = menor;
      }
    }
    return primero;
  }
}

// Las mismas restricciones que la consulta de Neo4j: tramos cerrados, terracería si se pide evitar,
// y puntos con un incidente activo de gravedad Alta (no se puede entrar ni salir de ellos).
function aristasUsables(red: RedExploracion, evitarTerraceria: boolean): AristaRed[] {
  return red.aristas.filter(
    (a) => a.abierto && !(evitarTerraceria && a.tipoVia === "Terracería") && !red.bloqueados.has(a.desde) && !red.bloqueados.has(a.hasta),
  );
}

function agrupar(aristas: AristaRed[], clave: "desde" | "hasta") {
  const mapa = new Map<string, AristaRed[]>();
  for (const a of aristas) mapa.set(a[clave], [...(mapa.get(a[clave]) ?? []), a]);
  return mapa;
}

function resumir(algoritmo: Algoritmo, camino: AristaRed[] | null, inicio: string, criterio: CriterioExploracion, pasos: Paso[]): ResultadoExploracion {
  const explorados = pasos.filter((p) => p.tipo === "visita").length;
  const tramosRevisados = pasos.length - explorados;
  if (!camino) {
    return { algoritmo, encontrada: false, ruta: [], costo: 0, minutos: 0, kilometros: 0, costoCasetas: 0, explorados, tramosRevisados, pasos };
  }
  const suma = (f: (a: AristaRed) => number) => camino.reduce((s, a) => s + f(a), 0);
  const base = (a: AristaRed) => (criterio === "tiempo" ? a.tiempoMin : criterio === "distancia" ? a.distanciaKm : a.costoCaseta);
  return {
    algoritmo,
    encontrada: true,
    ruta: [inicio, ...camino.map((a) => a.hasta)],
    costo: suma(base),
    minutos: suma((a) => a.tiempoMin),
    kilometros: Math.round(suma((a) => a.distanciaKm) * 10) / 10,
    costoCasetas: suma((a) => a.costoCaseta),
    explorados,
    tramosRevisados,
    pasos,
  };
}

// Dijkstra clásico: crece desde el origen, siempre por el punto pendiente más barato, hasta resolver el destino
export function dijkstra(red: RedExploracion, origen: string, destino: string, criterio: CriterioExploracion, evitarTerraceria: boolean): ResultadoExploracion {
  const salientes = agrupar(aristasUsables(red, evitarTerraceria), "desde");
  const pasos: Paso[] = [];
  const costo = new Map<string, number>([[origen, 0]]);
  const llegada = new Map<string, AristaRed>();
  const resueltos = new Set<string>();
  const cola = new Cola();
  if (!red.bloqueados.has(origen)) cola.meter(0, origen);

  while (!cola.vacia) {
    const { costo: c, punto } = cola.sacar();
    if (resueltos.has(punto)) continue;
    resueltos.add(punto);
    pasos.push({ tipo: "visita", punto, lado: "origen", costo: c });
    if (punto === destino) break;

    for (const a of salientes.get(punto) ?? []) {
      if (resueltos.has(a.hasta)) continue;
      const nuevo = c + peso(a, criterio);
      const mejora = nuevo < (costo.get(a.hasta) ?? Number.POSITIVE_INFINITY);
      pasos.push({ tipo: "tramo", desde: punto, hasta: a.hasta, lado: "origen", mejora });
      if (mejora) {
        costo.set(a.hasta, nuevo);
        llegada.set(a.hasta, a);
        cola.meter(nuevo, a.hasta);
      }
    }
  }

  if (!resueltos.has(destino) || red.bloqueados.has(destino)) return resumir("dijkstra", null, origen, criterio, pasos);
  const camino: AristaRed[] = [];
  for (let p = destino; p !== origen; ) {
    const a = llegada.get(p)!;
    camino.unshift(a);
    p = a.desde;
  }
  return resumir("dijkstra", camino, origen, criterio, pasos);
}

// Dijkstra bidireccional: una búsqueda sale del origen por los tramos de ida y otra sale del destino
// por los tramos al revés. Se alterna la que tenga el punto pendiente más barato y se detiene cuando
// la suma de los dos mínimos ya no puede mejorar el mejor encuentro. Suele revisar menos puntos.
export function dijkstraBidireccional(
  red: RedExploracion,
  origen: string,
  destino: string,
  criterio: CriterioExploracion,
  evitarTerraceria: boolean,
): ResultadoExploracion {
  const usables = aristasUsables(red, evitarTerraceria);
  const salientes = agrupar(usables, "desde");
  const entrantes = agrupar(usables, "hasta");
  const pasos: Paso[] = [];

  const lados = {
    origen: { costo: new Map([[origen, 0]]), via: new Map<string, AristaRed>(), resueltos: new Set<string>(), cola: new Cola() },
    destino: { costo: new Map([[destino, 0]]), via: new Map<string, AristaRed>(), resueltos: new Set<string>(), cola: new Cola() },
  };
  const bloqueado = red.bloqueados.has(origen) || red.bloqueados.has(destino);
  if (!bloqueado) {
    lados.origen.cola.meter(0, origen);
    lados.destino.cola.meter(0, destino);
  }

  let mejor = Number.POSITIVE_INFINITY;
  let encuentro: { arista: AristaRed } | null = null;

  while (!lados.origen.cola.vacia && !lados.destino.cola.vacia) {
    if (lados.origen.cola.minimo + lados.destino.cola.minimo >= mejor) break;
    const nombre = lados.origen.cola.minimo <= lados.destino.cola.minimo ? "origen" : "destino";
    const lado = lados[nombre];
    const otro = lados[nombre === "origen" ? "destino" : "origen"];
    const { costo: c, punto } = lado.cola.sacar();
    if (lado.resueltos.has(punto)) continue;
    lado.resueltos.add(punto);
    pasos.push({ tipo: "visita", punto, lado: nombre, costo: c });

    const vecinas = nombre === "origen" ? (salientes.get(punto) ?? []) : (entrantes.get(punto) ?? []);
    for (const a of vecinas) {
      const vecino = nombre === "origen" ? a.hasta : a.desde;
      if (lado.resueltos.has(vecino)) continue;
      const nuevo = c + peso(a, criterio);
      const mejora = nuevo < (lado.costo.get(vecino) ?? Number.POSITIVE_INFINITY);
      pasos.push({ tipo: "tramo", desde: punto, hasta: vecino, lado: nombre, mejora });
      if (mejora) {
        lado.costo.set(vecino, nuevo);
        lado.via.set(vecino, a);
        lado.cola.meter(nuevo, vecino);
      }
      // ¿Este tramo une las dos búsquedas con un camino mejor?
      const delOtro = otro.costo.get(vecino);
      if (delOtro !== undefined && c + peso(a, criterio) + delOtro < mejor) {
        mejor = c + peso(a, criterio) + delOtro;
        encuentro = { arista: a };
      }
    }
  }

  if (!encuentro) return resumir("bidireccional", null, origen, criterio, pasos);
  // Camino: del origen hasta el inicio del tramo de encuentro, el tramo, y del final del tramo al destino
  const camino: AristaRed[] = [];
  for (let p = encuentro.arista.desde; p !== origen; ) {
    const a = lados.origen.via.get(p)!;
    camino.unshift(a);
    p = a.desde;
  }
  camino.push(encuentro.arista);
  for (let p = encuentro.arista.hasta; p !== destino; ) {
    const a = lados.destino.via.get(p)!;
    camino.push(a);
    p = a.hasta;
  }
  return resumir("bidireccional", camino, origen, criterio, pasos);
}

export function explorar(
  red: RedExploracion,
  p: { origen: string; destino: string; criterio: CriterioExploracion; evitarTerraceria: boolean; algoritmo: Algoritmo },
): ResultadoExploracion {
  return p.algoritmo === "bidireccional"
    ? dijkstraBidireccional(red, p.origen, p.destino, p.criterio, p.evitarTerraceria)
    : dijkstra(red, p.origen, p.destino, p.criterio, p.evitarTerraceria);
}
