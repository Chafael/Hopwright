<script lang="ts">
  import L from "leaflet";
  import { onMount } from "svelte";
  import type { Mapa, PuntoMapa } from "./api";

  // Dibuja la red de Chiapas sobre un mapa. Lo que se resalta (una ruta, un punto cerrado,
  // ciudades aisladas) llega por props y se vuelve a pintar cada vez que cambia.
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
    rutaSecundaria?: string[]; // otra ruta para comparar (por ejemplo, el desvío)
    cerrado?: string | null;
    aisladas?: string[];
    mostrarVehiculos?: boolean;
    alElegirPunto?: (p: PuntoMapa) => void;
  } = $props();

  let contenedor: HTMLDivElement;
  let mapaLeaflet: L.Map | undefined;
  let capaRed: L.LayerGroup | undefined;
  let capaResaltado: L.LayerGroup | undefined;

  const VERDE = "#00674a";
  const AZUL = "#1f5fa8";
  const ROJO = "#c8102e";
  const AMARILLO = "#f5b800";
  const ASFALTO = "#2b2f33";

  const coordenadas = $derived(
    new Map(mapa.puntos.filter((p) => p.latitud !== null && p.longitud !== null).map((p) => [p.idPunto, [p.latitud!, p.longitud!] as L.LatLngTuple])),
  );

  // Rombo de señal preventiva: amarillo para Media y Baja, rojo para Alta (bloquea el paso)
  function iconoIncidente(gravedad: string) {
    const color = gravedad === "Alta" ? ROJO : AMARILLO;
    const texto = gravedad === "Alta" ? "#fff" : ASFALTO;
    return L.divIcon({
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: `<div style="width:16px;height:16px;margin:3px;transform:rotate(45deg);background:${color};border:2px solid ${ASFALTO};border-radius:2px;display:grid;place-items:center"><span style="transform:rotate(-45deg);font:800 11px Overpass,sans-serif;color:${texto}">!</span></div>`,
    });
  }

  function iconoEstacion() {
    return L.divIcon({
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      html: `<div style="width:12px;height:12px;background:${AZUL};border:2px solid #fff;outline:1px solid ${AZUL}"></div>`,
    });
  }

  function dibujarRed() {
    if (!mapaLeaflet || !capaRed) return;
    capaRed.clearLayers();

    for (const t of mapa.tramos) {
      const a = coordenadas.get(t.desde);
      const b = coordenadas.get(t.hasta);
      if (!a || !b) continue;
      const tren = t.tipo === "VIA_FERREA";
      const estilo: L.PolylineOptions = tren
        ? { color: AZUL, weight: 3, dashArray: "2 6", lineCap: "butt" }
        : !t.abierto
          ? { color: ROJO, weight: 3, dashArray: "6 6" }
          : t.tipoVia === "Terracería"
            ? { color: "#8a6d3b", weight: 2, dashArray: "4 4" }
            : { color: t.tipoVia === "Autopista" ? "#5c6670" : "#8b949c", weight: t.tipoVia === "Autopista" ? 3.5 : 2.5 };
      L.polyline([a, b], estilo)
        .bindTooltip(`${tren ? "Vía férrea" : t.tipoVia} · ${t.distanciaKm} km · ${t.tiempoMin} min${t.costoCaseta ? ` · caseta $${t.costoCaseta}` : ""}`, { sticky: true })
        .addTo(capaRed);
    }

    for (const p of mapa.puntos) {
      const c = coordenadas.get(p.idPunto);
      if (!c) continue;
      const marca =
        p.tipo === "Estacion"
          ? L.marker(c, { icon: iconoEstacion() })
          : L.circleMarker(c, {
              radius: p.tipo === "Ciudad" ? 5 : 3,
              color: p.tipo === "Ciudad" ? VERDE : "#5c6670",
              weight: 2,
              fillColor: "#fff",
              fillOpacity: 1,
            });
      marca.bindTooltip(`${p.nombre} (${p.idPunto})`, { direction: "top", offset: [0, -4] });
      if (alElegirPunto) marca.on("click", () => alElegirPunto?.(p));
      marca.addTo(capaRed);
    }

    for (const i of mapa.incidentes) {
      const c = coordenadas.get(i.idPunto);
      if (!c) continue;
      L.marker(c, { icon: iconoIncidente(i.gravedad), zIndexOffset: 500 })
        .bindTooltip(`${i.idIncidente}: gravedad ${i.gravedad}`, { direction: "top", offset: [0, -10] })
        .addTo(capaRed);
    }

    if (mostrarVehiculos) {
      // Varios vehículos en el mismo punto van en una sola etiqueta
      const porPunto = new Map<string, string[]>();
      for (const v of mapa.vehiculos) porPunto.set(v.idPunto, [...(porPunto.get(v.idPunto) ?? []), v.placa]);
      for (const [idPunto, placas] of porPunto) {
        const c = coordenadas.get(idPunto);
        if (!c) continue;
        L.marker(c, {
          zIndexOffset: 400,
          interactive: false,
          icon: L.divIcon({
            className: "",
            iconSize: [0, 0],
            iconAnchor: [-8, 9],
            html: `<span style="display:inline-block;font:700 10px Overpass,sans-serif;background:#fff;color:${ASFALTO};border:1px solid ${ASFALTO};border-radius:3px;padding:1px 4px;white-space:nowrap">${placas.join(", ")}</span>`,
          }),
        }).addTo(capaRed);
      }
    }
  }

  function dibujarResaltado() {
    if (!mapaLeaflet || !capaResaltado) return;
    capaResaltado.clearLayers();
    const puntos: L.LatLngTuple[] = [];

    const trazar = (ids: string[], color: string, punteada: boolean) => {
      const linea = ids.map((id) => coordenadas.get(id)).filter((c): c is L.LatLngTuple => !!c);
      if (linea.length < 2) return;
      // Filete blanco debajo para que la ruta se lea sobre cualquier fondo
      L.polyline(linea, { color: "#fff", weight: 10, opacity: 0.9 }).addTo(capaResaltado!);
      L.polyline(linea, { color, weight: 6, dashArray: punteada ? "10 8" : undefined }).addTo(capaResaltado!);
      puntos.push(...linea);
    };
    trazar(rutaSecundaria, "#5c6670", true);
    trazar(ruta, VERDE, false);

    for (const [i, id] of [ruta[0], ruta.at(-1)].entries()) {
      const c = id ? coordenadas.get(id) : undefined;
      if (!c) continue;
      L.circleMarker(c, { radius: 8, color: "#fff", weight: 3, fillColor: i === 0 ? VERDE : ASFALTO, fillOpacity: 1 }).addTo(capaResaltado);
    }

    for (const id of aisladas) {
      const c = coordenadas.get(id);
      if (!c) continue;
      L.circleMarker(c, { radius: 10, color: ROJO, weight: 3, fillColor: ROJO, fillOpacity: 0.25 }).addTo(capaResaltado);
      puntos.push(c);
    }
    if (cerrado) {
      const c = coordenadas.get(cerrado);
      if (c) {
        L.marker(c, {
          zIndexOffset: 1000,
          icon: L.divIcon({
            className: "",
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            html: `<div style="width:24px;height:24px;border-radius:50%;background:${ROJO};border:3px solid #fff;box-shadow:0 0 0 1px ${ROJO};display:grid;place-items:center"><div style="width:12px;height:3px;background:#fff"></div></div>`,
          }),
        }).addTo(capaResaltado);
        puntos.push(c);
      }
    }

    if (puntos.length > 1) mapaLeaflet.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 9 });
  }

  onMount(() => {
    mapaLeaflet = L.map(contenedor, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 12,
    }).addTo(mapaLeaflet);
    capaRed = L.layerGroup().addTo(mapaLeaflet);
    capaResaltado = L.layerGroup().addTo(mapaLeaflet);

    const todos = [...coordenadas.values()];
    if (todos.length > 0) mapaLeaflet.fitBounds(L.latLngBounds(todos), { padding: [20, 20] });

    // Si el contenedor cambia de tamaño (por ejemplo, en el celular), Leaflet tiene que recalcular
    const observador = new ResizeObserver(() => mapaLeaflet?.invalidateSize());
    observador.observe(contenedor);
    return () => {
      observador.disconnect();
      mapaLeaflet?.remove();
    };
  });

  $effect(() => {
    // Se vuelve a dibujar cuando cambian los datos de la red o la capa de vehículos
    void mapa;
    void mostrarVehiculos;
    dibujarRed();
  });

  $effect(() => {
    void ruta;
    void rutaSecundaria;
    void cerrado;
    void aisladas;
    dibujarResaltado();
  });
</script>

<div bind:this={contenedor} class="h-full w-full" role="region" aria-label="Mapa de la red de transporte de Chiapas"></div>
