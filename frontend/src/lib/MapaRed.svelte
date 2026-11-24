<script lang="ts">
  import maplibregl, { type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
  import { onMount } from "svelte";
  import type { Feature, FeatureCollection } from "geojson";
  import type { Mapa, PuntoMapa } from "./api";

  // Dibuja la red de Chiapas con MapLibre sobre un mapa vectorial (estilo Positron de OpenFreeMap).
  // Los tramos siguen el trazo real de la carretera si existe static/geometria-tramos.json
  // (se genera con npm run geometria); si no, se dibujan rectos.
  let {
    mapa,
    ruta = [],
    rutaSecundaria = [],
    cerrado = null,
    aisladas = [],
    mostrarVehiculos = false,
    alElegirPunto,
  }: {
    mapa: Mapa;
    ruta?: string[]; // ids de los puntos en orden
    rutaSecundaria?: string[]; // otra ruta para comparar (por ejemplo, la que llevaba antes del desvío)
    cerrado?: string | null;
    aisladas?: string[];
    mostrarVehiculos?: boolean;
    alElegirPunto?: (p: PuntoMapa) => void;
  } = $props();

  const ESTILO = "https://tiles.openfreemap.org/styles/positron";
  // Si no hay internet, un fondo liso: la red se sigue viendo
  const ESTILO_SIN_CONEXION: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e4e8e2" } }],
  };

  const VERDE = "#00674a";
  const AZUL = "#1f5fa8";
  const ROJO = "#c8102e";
  const AMARILLO = "#f5b800";
  const ASFALTO = "#2b2f33";

  type Lnglat = [number, number];
  let contenedor: HTMLDivElement;
  let mapaGl: maplibregl.Map | undefined;
  let listo = $state(false);
  let geometrias = $state<Record<string, Lnglat[]>>({});
  let marcadores: maplibregl.Marker[] = [];
  let marcadoresResaltado: maplibregl.Marker[] = [];

  const coordenadas = $derived(
    new Map(mapa.puntos.filter((p) => p.latitud !== null && p.longitud !== null).map((p) => [p.idPunto, [p.longitud!, p.latitud!] as Lnglat])),
  );

  // Trazo de un tramo: la geometría real en cualquiera de los dos sentidos, o una recta
  function trazo(a: string, b: string): Lnglat[] | null {
    const directo = geometrias[`${a}|${b}`];
    if (directo) return directo;
    const inverso = geometrias[`${b}|${a}`];
    if (inverso) return [...inverso].reverse();
    const ca = coordenadas.get(a);
    const cb = coordenadas.get(b);
    return ca && cb ? [ca, cb] : null;
  }

  function lineaDeRuta(ids: string[]): Lnglat[] {
    const linea: Lnglat[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      const t = trazo(ids[i], ids[i + 1]);
      if (t) linea.push(...(linea.length ? t.slice(1) : t));
    }
    return linea;
  }

  const coleccion = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });
  const lineaGeo = (coords: Lnglat[], props: Record<string, unknown> = {}): Feature => ({
    type: "Feature",
    properties: props,
    geometry: { type: "LineString", coordinates: coords },
  });
  const puntoGeo = (c: Lnglat, props: Record<string, unknown> = {}): Feature => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: c } });

  function fuente(id: string) {
    return mapaGl?.getSource(id) as GeoJSONSource | undefined;
  }

  // Marcadores HTML: rombo de señal preventiva para incidentes, etiqueta para vehículos, señal de cerrado.
  // Se regresa el contenedor y no el dibujo: MapLibre usa transform del elemento para colocarlo,
  // y si fuera el mismo elemento se perdería la rotación del rombo.
  function elemento(html: string, titulo?: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    if (titulo) div.title = titulo;
    return div;
  }

  // Pin con forma de gota (la punta marca el lugar) y una etiqueta con el nombre
  function pin(color: string, rotulo: string, nombre: string) {
    return `<div style="display:flex;align-items:flex-end;gap:4px;pointer-events:none">
      <svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">
        <path d="M14 37C14 37 2 22.5 2 13.5a12 12 0 0 1 24 0C26 22.5 14 37 14 37Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
        <circle cx="14" cy="13.5" r="4.5" fill="#fff"/>
      </svg>
      <span style="margin-bottom:22px;background:#fff;border:2px solid ${color};border-radius:6px;padding:2px 7px;font:600 11px/1.25 Overpass,sans-serif;color:${ASFALTO};white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2)">
        <span style="display:block;font-weight:600;color:#5c6670">${rotulo}</span><span style="font-weight:800;font-size:13px">${nombre}</span>
      </span>
    </div>`;
  }

  // Indicador de sentido: círculo verde con filete blanco y una flecha blanca adentro.
  // Se dibuja en un canvas porque el estilo sin conexión no trae íconos.
  function flecha(): ImageData {
    const t = 44;
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = t;
    const ctx = lienzo.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(t / 2, t / 2, t / 2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = VERDE;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(17, 12);
    ctx.lineTo(28, 22);
    ctx.lineTo(17, 32);
    ctx.stroke();
    return ctx.getImageData(0, 0, t, t);
  }

  function dibujarRed() {
    if (!mapaGl || !listo) return;
    fuente("tramos")?.setData(
      coleccion(
        mapa.tramos.flatMap((t) => {
          const c = trazo(t.desde, t.hasta);
          if (!c) return [];
          const estilo = t.tipo === "VIA_FERREA" ? "tren" : !t.abierto ? "cerrado" : t.tipoVia === "Terracería" ? "terraceria" : t.tipoVia === "Autopista" ? "autopista" : "normal";
          const texto = `${t.tipo === "VIA_FERREA" ? "Vía férrea" : t.tipoVia}: ${t.distanciaKm} km, ${t.tiempoMin} min${t.costoCaseta ? `, caseta $${t.costoCaseta}` : ""}`;
          return [lineaGeo(c, { estilo, texto })];
        }),
      ),
    );
    fuente("puntos")?.setData(
      coleccion(
        mapa.puntos.flatMap((p) => {
          const c = coordenadas.get(p.idPunto);
          return c ? [puntoGeo(c, { id: p.idPunto, nombre: p.nombre, tipo: p.tipo })] : [];
        }),
      ),
    );

    for (const m of marcadores) m.remove();
    marcadores = [];
    for (const i of mapa.incidentes) {
      const c = coordenadas.get(i.idPunto);
      if (!c) continue;
      const fondo = i.gravedad === "Alta" ? ROJO : AMARILLO;
      const letra = i.gravedad === "Alta" ? "#fff" : ASFALTO;
      const html = `<div style="width:16px;height:16px;transform:rotate(45deg);background:${fondo};border:2px solid ${ASFALTO};border-radius:2px;display:grid;place-items:center"><span style="transform:rotate(-45deg);font:800 11px Overpass,sans-serif;color:${letra}">!</span></div>`;
      marcadores.push(new maplibregl.Marker({ element: elemento(html, `${i.idIncidente}: gravedad ${i.gravedad}`) }).setLngLat(c).addTo(mapaGl));
    }
    if (mostrarVehiculos) {
      const porPunto = new Map<string, string[]>();
      for (const v of mapa.vehiculos) porPunto.set(v.idPunto, [...(porPunto.get(v.idPunto) ?? []), v.placa]);
      for (const [idPunto, placas] of porPunto) {
        const c = coordenadas.get(idPunto);
        if (!c) continue;
        const html = `<span style="font:700 10px Overpass,sans-serif;background:#fff;color:${ASFALTO};border:1px solid ${ASFALTO};border-radius:3px;padding:1px 4px;white-space:nowrap">${placas.join(", ")}</span>`;
        marcadores.push(new maplibregl.Marker({ element: elemento(html), anchor: "left", offset: [9, 0] }).setLngLat(c).addTo(mapaGl));
      }
    }
  }

  function dibujarResaltado() {
    if (!mapaGl || !listo) return;
    const principal = lineaDeRuta(ruta);
    const secundaria = lineaDeRuta(rutaSecundaria);
    fuente("ruta")?.setData(coleccion(principal.length > 1 ? [lineaGeo(principal)] : []));
    fuente("ruta-secundaria")?.setData(coleccion(secundaria.length > 1 ? [lineaGeo(secundaria)] : []));

    fuente("aisladas")?.setData(coleccion(aisladas.flatMap((id) => (coordenadas.get(id) ? [puntoGeo(coordenadas.get(id)!)] : []))));

    for (const m of marcadoresResaltado) m.remove();
    marcadoresResaltado = [];

    // Pines de salida y llegada, con el nombre del lugar a un lado
    if (ruta.length > 1) {
      for (const [id, rotulo, color] of [
        [ruta[0], "Sale de", VERDE],
        [ruta.at(-1)!, "Llega a", ASFALTO],
      ] as const) {
        const c = coordenadas.get(id);
        if (!c) continue;
        const nombre = mapa.puntos.find((p) => p.idPunto === id)?.nombre ?? id;
        marcadoresResaltado.push(new maplibregl.Marker({ element: elemento(pin(color, rotulo, nombre)), anchor: "bottom-left", offset: [-14, 2] }).setLngLat(c).addTo(mapaGl));
      }
    }

    const cCerrado = cerrado ? coordenadas.get(cerrado) : undefined;
    if (cCerrado) {
      const html = `<div style="width:24px;height:24px;border-radius:50%;background:${ROJO};border:3px solid #fff;box-shadow:0 0 0 1px ${ROJO};display:grid;place-items:center"><div style="width:12px;height:3px;background:#fff"></div></div>`;
      marcadoresResaltado.push(new maplibregl.Marker({ element: elemento(html, "Punto cerrado") }).setLngLat(cCerrado).addTo(mapaGl));
    }

    const enfoque = [...principal, ...secundaria, ...aisladas.map((id) => coordenadas.get(id)).filter((c): c is Lnglat => !!c), ...(cCerrado ? [cCerrado] : [])];
    if (enfoque.length > 1) {
      const limites = enfoque.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(enfoque[0], enfoque[0]));
      mapaGl.fitBounds(limites, { padding: 80, maxZoom: 8, duration: 600 });
    }
  }

  function agregarCapas(m: maplibregl.Map) {
    const vacia = coleccion([]);
    for (const id of ["tramos", "puntos", "ruta", "ruta-secundaria", "aisladas"]) m.addSource(id, { type: "geojson", data: vacia });

    m.addLayer({
      id: "tramos",
      type: "line",
      source: "tramos",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "estilo"], "tren", AZUL, "cerrado", ROJO, "terraceria", "#8a6d3b", "autopista", "#59636c", "#8b949c"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, ["match", ["get", "estilo"], "autopista", 2.5, 1.6], 10, ["match", ["get", "estilo"], "autopista", 5, 3]],
      },
      filter: ["!", ["in", ["get", "estilo"], ["literal", ["tren", "cerrado", "terraceria"]]]],
    });
    // Las líneas punteadas van aparte porque line-dasharray no acepta expresiones por elemento
    m.addLayer({ id: "tramos-tren", type: "line", source: "tramos", filter: ["==", ["get", "estilo"], "tren"], paint: { "line-color": AZUL, "line-width": 3, "line-dasharray": [1, 2] } });
    m.addLayer({ id: "tramos-terraceria", type: "line", source: "tramos", filter: ["==", ["get", "estilo"], "terraceria"], paint: { "line-color": "#8a6d3b", "line-width": 2, "line-dasharray": [2, 2] } });
    m.addLayer({ id: "tramos-cerrados", type: "line", source: "tramos", filter: ["==", ["get", "estilo"], "cerrado"], paint: { "line-color": ROJO, "line-width": 3, "line-dasharray": [2, 2] } });

    m.addLayer({ id: "ruta-secundaria-borde", type: "line", source: "ruta-secundaria", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
    m.addLayer({ id: "ruta-secundaria", type: "line", source: "ruta-secundaria", layout: { "line-join": "round" }, paint: { "line-color": "#5c6670", "line-width": 5, "line-dasharray": [2, 1.5] } });
    m.addLayer({ id: "ruta-borde", type: "line", source: "ruta", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#fff", "line-width": 11 } });
    m.addLayer({ id: "ruta", type: "line", source: "ruta", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": VERDE, "line-width": 6 } });
    // Flechas a lo largo de la ruta: MapLibre las gira solas según el sentido de la línea
    m.addImage("flecha", flecha(), { pixelRatio: 2 });
    m.addLayer({
      id: "ruta-flechas",
      type: "symbol",
      source: "ruta",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 140,
        "icon-image": "flecha",
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
      },
    });

    m.addLayer({ id: "aisladas", type: "circle", source: "aisladas", paint: { "circle-radius": 13, "circle-color": ROJO, "circle-opacity": 0.2, "circle-stroke-color": ROJO, "circle-stroke-width": 3 } });
    m.addLayer({
      id: "puntos",
      type: "circle",
      source: "puntos",
      paint: {
        "circle-radius": ["match", ["get", "tipo"], "Ciudad", 5.5, "Estacion", 5, 3.5],
        "circle-color": ["match", ["get", "tipo"], "Estacion", AZUL, "#ffffff"],
        "circle-stroke-color": ["match", ["get", "tipo"], "Ciudad", VERDE, "Estacion", "#ffffff", "#59636c"],
        "circle-stroke-width": 2,
      },
    });

    // Al pasar el cursor por un punto o un tramo se ve qué es
    const globo = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "globo-red" });
    for (const capa of ["puntos", "tramos", "tramos-tren", "tramos-terraceria", "tramos-cerrados"]) {
      m.on("mousemove", capa, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        m.getCanvas().style.cursor = capa === "puntos" && alElegirPunto ? "pointer" : "";
        const p = f.properties as Record<string, string>;
        globo.setLngLat(e.lngLat).setText(capa === "puntos" ? `${p.nombre} (${p.id})` : p.texto).addTo(m);
      });
      m.on("mouseleave", capa, () => {
        m.getCanvas().style.cursor = "";
        globo.remove();
      });
    }
    m.on("click", "puntos", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const p = mapa.puntos.find((x) => x.idPunto === id);
      if (p) alElegirPunto?.(p);
    });
  }

  onMount(() => {
    let cancelado = false;
    (async () => {
      // Estilo base y geometría de los tramos; ninguno de los dos es indispensable
      const [estilo, geo] = await Promise.all([
        fetch(ESTILO, { signal: AbortSignal.timeout(5000) })
          .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : ESTILO_SIN_CONEXION))
          .catch(() => ESTILO_SIN_CONEXION),
        fetch("/geometria-tramos.json")
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
      ]);
      if (cancelado) return;
      geometrias = geo;

      const todos = [...coordenadas.values()];
      const m = new maplibregl.Map({
        container: contenedor,
        style: estilo,
        bounds: todos.length > 1 ? todos.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(todos[0], todos[0])) : undefined,
        fitBoundsOptions: { padding: 30 },
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      m.on("load", () => {
        agregarCapas(m);
        listo = true;
      });
      mapaGl = m;
    })();

    const observador = new ResizeObserver(() => mapaGl?.resize());
    observador.observe(contenedor);
    return () => {
      cancelado = true;
      observador.disconnect();
      mapaGl?.remove();
    };
  });

  $effect(() => {
    void mapa;
    void mostrarVehiculos;
    void geometrias;
    if (listo) dibujarRed();
  });

  $effect(() => {
    void ruta;
    void rutaSecundaria;
    void cerrado;
    void aisladas;
    void geometrias;
    if (listo) dibujarResaltado();
  });
</script>

<div bind:this={contenedor} class="h-full w-full" role="region" aria-label="Mapa de la red de transporte de Chiapas"></div>

<style>
  :global(.globo-red .maplibregl-popup-content) {
    font: 600 13px var(--font-sans);
    color: var(--color-asfalto);
    padding: 4px 8px;
    border-radius: 4px;
  }
</style>
