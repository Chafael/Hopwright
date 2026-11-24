<script lang="ts">
  import { Alert, Button, Input, Label, Select, Toggle } from "flowbite-svelte";
  import { onMount } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import Letrero from "$lib/Letrero.svelte";
  import { api, duracion, km, pesos, type Criterio, type Mapa, type Ruta } from "$lib/api";
  import { cargarRed, opciones } from "$lib/red.svelte";

  // C1: ruta por carretera con restricciones (GET /rutas)
  let mapa = $state<Mapa>();
  let errorRed = $state("");
  let origen = $state("07101");
  let destino = $state("07078");
  let criterio = $state<Criterio>("tiempo");
  let evitarTerraceria = $state(false);
  let tiempoMax = $state<number | undefined>();
  let resultado = $state<Ruta>();
  let error = $state("");
  let calculando = $state(false);

  const criterios: { valor: Criterio; texto: string; ayuda: string }[] = [
    { valor: "tiempo", texto: "Más rápida", ayuda: "Menos minutos" },
    { valor: "distancia", texto: "Más corta", ayuda: "Menos kilómetros" },
    { valor: "costo", texto: "Menos casetas", ayuda: "Menos pesos en casetas" },
  ];

  const ciudades = $derived(mapa ? opciones(mapa.puntos, ["Ciudad"]) : []);

  onMount(async () => {
    try {
      mapa = await cargarRed();
    } catch (e) {
      errorRed = (e as Error).message;
    }
  });

  async function calcular(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    calculando = true;
    try {
      resultado = await api.ruta({ origen, destino, criterio, evitarTerraceria, tiempoMaxMin: tiempoMax || null });
    } catch (e) {
      error = (e as Error).message;
      resultado = undefined;
    } finally {
      calculando = false;
    }
  }

  function intercambiar() {
    [origen, destino] = [destino, origen];
  }
</script>

<svelte:head><title>Rutas · Hopwright</title></svelte:head>

<div class="grid h-full md:grid-cols-[400px_1fr]">
  <section class="overflow-y-auto border-r border-black/10 bg-white p-5" aria-labelledby="titulo">
    <h1 id="titulo" class="text-2xl font-extrabold">Calcular una ruta</h1>
    <p class="mt-1 text-sm text-asfalto/70">
      Busca el mejor camino por carretera. Los tramos cerrados y los puntos con un incidente de gravedad Alta se rodean solos.
    </p>

    <form class="mt-5 space-y-4" onsubmit={calcular}>
      <div class="grid grid-cols-[1fr_auto] items-end gap-2">
        <div>
          <Label for="origen" class="mb-1">Sale de</Label>
          <Select id="origen" items={ciudades} bind:value={origen} disabled={!mapa} />
        </div>
        <Button type="button" color="alternative" size="sm" onclick={intercambiar} aria-label="Intercambiar origen y destino" class="mb-0.5">⇅</Button>
      </div>
      <div>
        <Label for="destino" class="mb-1">Llega a</Label>
        <Select id="destino" items={ciudades} bind:value={destino} disabled={!mapa} />
      </div>

      <fieldset>
        <legend class="mb-1 text-sm font-medium">Qué importa más</legend>
        <div class="grid grid-cols-3 gap-1 rounded-lg bg-concreto p-1">
          {#each criterios as c (c.valor)}
            <label
              class="cursor-pointer rounded-md px-2 py-2 text-center text-sm has-[:checked]:bg-white has-[:checked]:font-bold has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500"
              title={c.ayuda}
            >
              <input type="radio" name="criterio" value={c.valor} bind:group={criterio} class="sr-only" />
              {c.texto}
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="space-y-3 rounded-lg border border-black/10 p-3">
        <p class="text-sm font-medium">Restricciones de la carga</p>
        <Toggle bind:checked={evitarTerraceria}>Evitar terracería (carga peligrosa)</Toggle>
        <div>
          <Label for="tiempo" class="mb-1">Tiempo máximo en minutos (carga refrigerada)</Label>
          <Input id="tiempo" type="number" min="1" placeholder="Sin límite" bind:value={tiempoMax} />
        </div>
      </div>

      <Button type="submit" class="w-full" disabled={!mapa || calculando || origen === destino}>
        {calculando ? "Calculando…" : "Calcular ruta"}
      </Button>
      {#if origen === destino}
        <p class="text-sm text-restrictivo">El origen y el destino tienen que ser distintos.</p>
      {/if}
    </form>

    {#if errorRed}
      <Alert color="red" class="mt-4">No se pudo cargar la red: {errorRed}</Alert>
    {/if}
    {#if error}
      <Alert color="red" class="mt-4">{error}</Alert>
    {/if}

    {#if resultado}
      <div class="mt-6" aria-live="polite">
        {#if resultado.encontrada}
          <Letrero
            destino={resultado.ruta.at(-1)?.nombre ?? ""}
            lineas={[km(resultado.kilometros), duracion(resultado.minutos), resultado.costoCasetas ? `${pesos(resultado.costoCasetas)} en casetas` : "Sin casetas"]}
          />
          {#each resultado.avisos as aviso, i (i)}
            <Alert color="yellow" class="mt-3">{aviso}</Alert>
          {/each}

          <h2 class="mt-5 mb-2 font-bold">Recorrido</h2>
          <ol class="relative border-l-4 border-senal-500 pl-4">
            {#each resultado.ruta as punto, i (punto.idPunto + i)}
              <li class="relative pb-3 last:pb-0">
                <span class="absolute -left-[26px] top-1 h-4 w-4 rounded-full border-4 border-senal-500 bg-white"></span>
                <span class="font-semibold">{punto.nombre}</span>
                {#if punto.tipo !== "Ciudad"}<span class="text-sm text-asfalto/60"> ({punto.tipo === "Interseccion" ? "intersección" : "estación"})</span>{/if}
                {#if resultado.tramos[i]}
                  {@const t = resultado.tramos[i]}
                  <p class="cifra text-sm text-asfalto/70">
                    {t.tipoVia}, {km(t.distanciaKm)}, {duracion(t.tiempoMin)}{t.costoCaseta ? `, caseta ${pesos(t.costoCaseta)}` : ""}
                  </p>
                {/if}
              </li>
            {/each}
          </ol>
        {:else}
          <Alert color="yellow">
            <p class="font-bold">No hay una ruta que cumpla las restricciones.</p>
            {#each resultado.avisos as aviso, i (i)}<p>{aviso}</p>{/each}
          </Alert>
        {/if}
      </div>
    {/if}
  </section>

  <section class="relative h-[60vh] md:h-full" aria-label="Mapa">
    {#if mapa}
      <MapaRed {mapa} ruta={resultado?.encontrada ? resultado.ruta.map((p) => p.idPunto) : []} />
    {:else}
      <div class="grid h-full place-items-center text-asfalto/60">{errorRed ? "Sin mapa" : "Cargando la red…"}</div>
    {/if}
  </section>
</div>
