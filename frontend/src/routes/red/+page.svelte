<script lang="ts">
  import { Button, Select, Toggle } from "flowbite-svelte";
  import { Ban, Building2, MapPin, Milestone, Route, TrainFront, TrainTrack, Truck } from "@lucide/svelte";
  import { onMount } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import { api, type CiudadesAisladas, type Mapa, type PuntoMapa } from "$lib/api";
  import { cargarRed, nombreDe, opciones, recargarRed } from "$lib/red.svelte";

  // La red completa, qué pasa si se cierra un punto (C4) y dónde están los vehículos
  let mapaRed = $state<Mapa>();
  let error = $state("");

  let punto = $state("07089"); // Tapachula: si se cierra, la frontera del Soconusco queda sin camino
  let destino = $state("07101");
  let resultado = $state<CiudadesAisladas>();
  let calculando = $state(false);

  let mostrarVehiculos = $state(true);
  let placa = $state("");
  let nuevoPunto = $state("");
  let mensajeVehiculo = $state<{ ok: boolean; texto: string }>();

  const cerrables = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad", "Interseccion"]) : []);
  const ciudades = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad"]) : []);
  const todos = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad", "Interseccion", "Estacion"]) : []);
  const placas = $derived(mapaRed ? mapaRed.vehiculos.map((v) => ({ value: v.placa, name: `${v.placa} (en ${nombreDe(mapaRed, v.idPunto)})` })) : []);

  const cifras = $derived(
    mapaRed
      ? [
          { n: mapaRed.puntos.filter((p) => p.tipo === "Ciudad").length, texto: "ciudades", icono: Building2 },
          { n: mapaRed.puntos.filter((p) => p.tipo === "Interseccion").length, texto: "cruces", icono: Milestone },
          { n: mapaRed.puntos.filter((p) => p.tipo === "Estacion").length, texto: "estaciones", icono: TrainFront },
          { n: mapaRed.tramos.filter((t) => t.tipo === "CARRETERA").length, texto: "carreteras", icono: Route },
          { n: mapaRed.tramos.filter((t) => t.tipo === "VIA_FERREA").length, texto: "tramos de tren", icono: TrainTrack },
          { n: mapaRed.vehiculos.length, texto: "vehículos", icono: Truck },
        ]
      : [],
  );

  onMount(async () => {
    try {
      mapaRed = await cargarRed();
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function simular(evento: SubmitEvent) {
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

  // Tocar un punto en el mapa lo elige para el cierre y como nuevo lugar del vehículo
  function elegir(p: PuntoMapa) {
    if (p.tipo !== "Estacion") punto = p.idPunto;
    nuevoPunto = p.idPunto;
  }

  async function mover(evento: SubmitEvent) {
    evento.preventDefault();
    mensajeVehiculo = undefined;
    try {
      await api.moverVehiculo(placa, nuevoPunto);
      mapaRed = await recargarRed();
      mensajeVehiculo = { ok: true, texto: `${placa} ahora está en ${nombreDe(mapaRed, nuevoPunto)}.` };
    } catch (e) {
      mensajeVehiculo = { ok: false, texto: (e as Error).message };
    }
  }

  const leyenda = [
    { muestra: "h-1 bg-[#59636c]", texto: "Autopista" },
    { muestra: "h-0.5 bg-[#8b949c]", texto: "Federal o estatal" },
    { muestra: "border-t-2 border-dashed border-[#8a6d3b]", texto: "Terracería" },
    { muestra: "border-t-4 border-dotted border-servicios", texto: "Vía del tren" },
  ];
</script>

<svelte:head><title>Mapa y cierres · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed
        mapa={mapaRed}
        margen={420}
        {mostrarVehiculos}
        cerrado={resultado?.puntoCerrado.idPunto ?? null}
        aisladas={resultado?.aisladas.map((c) => c.idCiudad) ?? []}
        alElegirPunto={elegir}
      />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">Cargando el mapa…</div>
    {/if}
  {/snippet}

  {#snippet encima()}
    <div class="absolute right-14 bottom-6 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold shadow-lg">
      {#each leyenda as l (l.texto)}
        <p class="flex items-center gap-2 py-0.5"><span class="inline-block w-6 {l.muestra}"></span>{l.texto}</p>
      {/each}
      <p class="flex items-center gap-2 py-0.5"><span class="inline-block h-3 w-3 rotate-45 rounded-[2px] border-2 border-asfalto bg-preventivo"></span>Incidente (rojo: cierra el paso)</p>
    </div>
  {/snippet}

  <h1 class="flex items-center gap-2 text-2xl font-extrabold"><MapPin class="h-6 w-6 text-senal-600" />Mapa de la red</h1>
  {#if mapaRed}
    <ul class="mt-3 grid grid-cols-3 gap-2">
      {#each cifras as c (c.texto)}
        <li class="rounded-xl bg-concreto px-2 py-2 text-center">
          <c.icono class="mx-auto h-5 w-5 text-senal-600" />
          <p class="cifra text-xl leading-tight font-extrabold">{c.n}</p>
          <p class="text-xs font-semibold">{c.texto}</p>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="mt-5 space-y-3 rounded-xl border-2 border-restrictivo/30 p-4" onsubmit={simular}>
    <h2 class="flex items-center gap-2 text-lg font-extrabold"><Ban class="h-5 w-5 text-restrictivo" />Simular un cierre</h2>
    <p class="text-sm font-semibold">¿Qué ciudades se quedan sin camino si se cierra un punto? También puedes tocarlo en el mapa.</p>
    <div>
      <p class="mb-1 text-sm font-bold">Se cierra</p>
      <Select items={cerrables} bind:value={punto} disabled={!mapaRed} aria-label="Punto que se cierra" class="font-semibold" />
    </div>
    <div>
      <p class="mb-1 text-sm font-bold">Tienen que poder llegar a</p>
      <Select items={ciudades} bind:value={destino} disabled={!mapaRed} aria-label="Destino" class="font-semibold" />
    </div>
    <Button type="submit" color="red" class="w-full gap-2" disabled={!mapaRed || calculando || punto === destino}><Ban class="h-4 w-4" />{calculando ? "Revisando…" : "Simular cierre"}</Button>

    {#if resultado}
      <div aria-live="polite">
        {#if resultado.aisladas.length === 0}
          <Aviso tono="verde">Nadie se queda incomunicado: todas las ciudades tienen otro camino a {resultado.destino.nombre}.</Aviso>
        {:else}
          <div class="rounded-xl bg-[#fde8eb] p-3">
            <p class="font-extrabold text-restrictivo">
              {resultado.aisladas.length === 1 ? "1 ciudad queda" : `${resultado.aisladas.length} ciudades quedan`} sin camino a {resultado.destino.nombre}
            </p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              {#each resultado.aisladas as c (c.idCiudad)}
                <li class="rounded-full bg-restrictivo px-2.5 py-0.5 text-sm font-bold text-white">{c.nombre}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
  </form>

  <form class="mt-4 space-y-3 rounded-xl border-2 border-black/10 p-4" onsubmit={mover}>
    <h2 class="flex items-center gap-2 text-lg font-extrabold"><Truck class="h-5 w-5 text-senal-600" />Vehículos</h2>
    <Toggle bind:checked={mostrarVehiculos}>Ver dónde está cada uno</Toggle>
    <div>
      <p class="mb-1 text-sm font-bold">Mover</p>
      <Select items={placas} bind:value={placa} placeholder="Elige una placa" disabled={!mapaRed} aria-label="Vehículo" class="font-semibold" />
    </div>
    <div>
      <p class="mb-1 text-sm font-bold">A</p>
      <Select items={todos} bind:value={nuevoPunto} placeholder="Elige un lugar" disabled={!mapaRed} aria-label="Nueva ubicación" class="font-semibold" />
    </div>
    <p class="text-xs font-semibold">Los trenes solo pueden quedar en una estación; los camiones, en una ciudad o un cruce.</p>
    <Button type="submit" color="alternative" class="w-full gap-2" disabled={!placa || !nuevoPunto}><Truck class="h-4 w-4" />Mover vehículo</Button>
    {#if mensajeVehiculo}<Aviso tono={mensajeVehiculo.ok ? "verde" : "rojo"}>{mensajeVehiculo.texto}</Aviso>{/if}
  </form>

  {#if error}<div class="mt-4"><Aviso tono="rojo">{error}</Aviso></div>{/if}
</VistaMapa>
