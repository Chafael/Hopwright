<script lang="ts">
  import { Alert, Button, Label, Select, Toggle } from "flowbite-svelte";
  import { onMount } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import { api, type CiudadesAisladas, type Mapa, type PuntoMapa } from "$lib/api";
  import { cargarRed, nombreDe, opciones, recargarRed } from "$lib/red.svelte";

  // C4: qué ciudades se quedan sin camino si se cierra un punto (GET /red/ciudades-aisladas),
  // y la ubicación de los vehículos (PATCH /vehiculos/{placa}/ubicacion)
  let mapa = $state<Mapa>();
  let error = $state("");

  let punto = $state("INT-OXC");
  let destino = $state("07101");
  let resultado = $state<CiudadesAisladas>();
  let calculando = $state(false);

  let mostrarVehiculos = $state(true);
  let placa = $state("");
  let nuevoPunto = $state("");
  let mensajeVehiculo = $state<{ ok: boolean; texto: string }>();

  const cerrables = $derived(mapa ? opciones(mapa.puntos, ["Ciudad", "Interseccion"]) : []);
  const ciudades = $derived(mapa ? opciones(mapa.puntos, ["Ciudad"]) : []);
  const todos = $derived(mapa ? opciones(mapa.puntos, ["Ciudad", "Interseccion", "Estacion"]) : []);
  const placas = $derived(mapa ? mapa.vehiculos.map((v) => ({ value: v.placa, name: `${v.placa}, en ${nombreDe(mapa, v.idPunto)}` })) : []);

  const resumen = $derived(
    mapa
      ? [
          { n: mapa.puntos.filter((p) => p.tipo === "Ciudad").length, texto: "ciudades" },
          { n: mapa.puntos.filter((p) => p.tipo === "Interseccion").length, texto: "intersecciones" },
          { n: mapa.puntos.filter((p) => p.tipo === "Estacion").length, texto: "estaciones" },
          { n: mapa.tramos.filter((t) => t.tipo === "CARRETERA").length, texto: "tramos de carretera" },
          { n: mapa.tramos.filter((t) => t.tipo === "VIA_FERREA").length, texto: "tramos de tren" },
        ]
      : [],
  );

  onMount(async () => {
    try {
      mapa = await cargarRed();
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function revisar(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    calculando = true;
    try {
      resultado = await api.ciudadesAisladas(punto, destino);
    } catch (e) {
      error = (e as Error).message;
      resultado = undefined;
    } finally {
      calculando = false;
    }
  }

  // Al tocar un punto del mapa se elige como el punto que se cierra
  function elegir(p: PuntoMapa) {
    if (p.tipo !== "Estacion") punto = p.idPunto;
    nuevoPunto = p.idPunto;
  }

  async function mover(evento: SubmitEvent) {
    evento.preventDefault();
    mensajeVehiculo = undefined;
    try {
      await api.moverVehiculo(placa, nuevoPunto);
      mapa = await recargarRed();
      mensajeVehiculo = { ok: true, texto: `${placa} ahora está en ${nombreDe(mapa, nuevoPunto)}.` };
    } catch (e) {
      mensajeVehiculo = { ok: false, texto: (e as Error).message };
    }
  }
</script>

<svelte:head><title>Red y cierres · Hopwright</title></svelte:head>

<div class="grid h-full md:grid-cols-[400px_1fr]">
  <section class="overflow-y-auto border-r border-black/10 bg-white p-5" aria-labelledby="titulo">
    <h1 id="titulo" class="text-2xl font-extrabold">Red y cierres</h1>
    {#if mapa}
      <p class="cifra mt-1 text-sm text-asfalto/70">
        {resumen.map((r) => `${r.n} ${r.texto}`).join(", ")}.
      </p>
    {/if}

    <form class="mt-5 space-y-4 rounded-lg border border-black/10 p-4" onsubmit={revisar}>
      <h2 class="font-bold">¿Qué pasa si se cierra un punto?</h2>
      <p class="text-sm text-asfalto/70">Elige un cruce o una ciudad, o tócalo en el mapa, y verás qué ciudades se quedan sin forma de llegar al destino.</p>
      <div>
        <Label for="punto" class="mb-1">Punto que se cierra</Label>
        <Select id="punto" items={cerrables} bind:value={punto} disabled={!mapa} />
      </div>
      <div>
        <Label for="destino" class="mb-1">Destino que deben alcanzar</Label>
        <Select id="destino" items={ciudades} bind:value={destino} disabled={!mapa} />
      </div>
      <Button type="submit" class="w-full" disabled={!mapa || calculando || punto === destino}>{calculando ? "Revisando…" : "Revisar"}</Button>

      {#if resultado}
        <div aria-live="polite">
          {#if resultado.aisladas.length === 0}
            <Alert color="green">Ninguna ciudad se queda sin camino: hay rutas alternas para todas.</Alert>
          {:else}
            <Alert color="red">
              <p class="font-bold">
                {resultado.aisladas.length === 1 ? "1 ciudad se queda" : `${resultado.aisladas.length} ciudades se quedan`} sin camino a {resultado.destino.nombre}:
              </p>
              <p>{resultado.aisladas.map((c) => c.nombre).join(", ")}</p>
            </Alert>
          {/if}
        </div>
      {/if}
    </form>

    <form class="mt-5 space-y-4 rounded-lg border border-black/10 p-4" onsubmit={mover}>
      <h2 class="font-bold">Mover un vehículo</h2>
      <Toggle bind:checked={mostrarVehiculos}>Mostrar vehículos en el mapa</Toggle>
      <div>
        <Label for="placa" class="mb-1">Vehículo</Label>
        <Select id="placa" items={placas} bind:value={placa} placeholder="Elige una placa" disabled={!mapa} />
      </div>
      <div>
        <Label for="nuevo" class="mb-1">Nueva ubicación</Label>
        <Select id="nuevo" items={todos} bind:value={nuevoPunto} placeholder="Elige un punto" disabled={!mapa} />
      </div>
      <p class="text-xs text-asfalto/60">Un tren solo puede quedar en una estación y un camión solo en una ciudad o un cruce.</p>
      <Button type="submit" color="alternative" class="w-full" disabled={!placa || !nuevoPunto}>Mover vehículo</Button>
      {#if mensajeVehiculo}
        <Alert color={mensajeVehiculo.ok ? "green" : "red"}>{mensajeVehiculo.texto}</Alert>
      {/if}
    </form>

    {#if error}<Alert color="red" class="mt-4">{error}</Alert>{/if}

    <section class="mt-5 text-sm" aria-labelledby="leyenda">
      <h2 id="leyenda" class="mb-2 font-bold">Cómo leer el mapa</h2>
      <ul class="space-y-1.5">
        <li><span class="mr-2 inline-block h-1 w-6 bg-[#5c6670] align-middle"></span>Autopista</li>
        <li><span class="mr-2 inline-block h-0.5 w-6 bg-[#8b949c] align-middle"></span>Federal o estatal</li>
        <li><span class="mr-2 inline-block w-6 border-t-2 border-dashed border-[#8a6d3b] align-middle"></span>Terracería</li>
        <li><span class="mr-2 inline-block w-6 border-t-4 border-dotted border-servicios align-middle"></span>Vía del tren</li>
        <li><span class="mr-2 inline-block h-3 w-3 rotate-45 border-2 border-asfalto bg-preventivo align-middle"></span>Incidente activo (rojo si cierra el paso)</li>
      </ul>
    </section>
  </section>

  <section class="relative h-[60vh] md:h-full" aria-label="Mapa">
    {#if mapa}
      <MapaRed
        {mapa}
        {mostrarVehiculos}
        cerrado={resultado?.puntoCerrado.idPunto ?? null}
        aisladas={resultado?.aisladas.map((c) => c.idCiudad) ?? []}
        alElegirPunto={elegir}
      />
    {:else}
      <div class="grid h-full place-items-center text-asfalto/60">Cargando la red…</div>
    {/if}
  </section>
</div>
