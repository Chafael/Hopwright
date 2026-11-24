<script lang="ts">
  import { Alert, Badge, Button, Input, Label, Select } from "flowbite-svelte";
  import { onMount } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import { api, duracion, km, pesos, type ComparacionCamionTren, type Mapa, type OpcionTransporte } from "$lib/api";
  import { cargarRed, nombreDe, opciones } from "$lib/red.svelte";

  // C2: mandar la carga solo en camión o combinar camión y tren (GET /rutas/camion-tren)
  let mapa = $state<Mapa>();
  let origen = $state("07101");
  let destino = $state("07089");
  let toneladas = $state(20);
  let resultado = $state<ComparacionCamionTren>();
  let error = $state("");
  let calculando = $state(false);

  const ciudades = $derived(mapa ? opciones(mapa.puntos, ["Ciudad"]) : []);

  onMount(async () => {
    try {
      mapa = await cargarRed();
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function comparar(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    calculando = true;
    try {
      resultado = await api.camionTren({ origen, destino, pesoKg: toneladas * 1000 });
    } catch (e) {
      error = (e as Error).message;
      resultado = undefined;
    } finally {
      calculando = false;
    }
  }

  // Línea del recorrido combinado: camión hasta la estación de subida, tren, y camión desde la de bajada
  const recorridoTren = $derived.by(() => {
    const ct = resultado?.camionTren;
    if (!ct?.tramos) return [];
    const ids: string[] = [];
    for (const t of ct.tramos) {
      if (ids.at(-1) !== t.desde) ids.push(t.desde);
      ids.push(t.hasta);
    }
    return ids;
  });

  const opcionesMostradas = $derived(
    resultado
      ? ([
          { titulo: "Solo camión", op: resultado.soloCamion },
          { titulo: "Camión y tren", op: resultado.camionTren },
        ] as { titulo: string; op: OpcionTransporte | null }[])
      : [],
  );
</script>

<svelte:head><title>Camión o tren · Hopwright</title></svelte:head>

<div class="grid h-full md:grid-cols-[440px_1fr]">
  <section class="overflow-y-auto border-r border-black/10 bg-white p-5" aria-labelledby="titulo">
    <h1 id="titulo" class="text-2xl font-extrabold">¿Camión o tren?</h1>
    <p class="mt-1 text-sm text-asfalto/70">
      Compara llevar la carga todo el camino en camión contra subirla al tren de la costa en algún tramo. El tren cobra por tonelada;
      el camión, por kilómetro y casetas.
    </p>

    <form class="mt-5 space-y-4" onsubmit={comparar}>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <Label for="origen" class="mb-1">Sale de</Label>
          <Select id="origen" items={ciudades} bind:value={origen} disabled={!mapa} />
        </div>
        <div>
          <Label for="destino" class="mb-1">Llega a</Label>
          <Select id="destino" items={ciudades} bind:value={destino} disabled={!mapa} />
        </div>
      </div>
      <div>
        <Label for="toneladas" class="mb-1">Peso de la carga en toneladas</Label>
        <Input id="toneladas" type="number" min="0.1" step="0.1" required bind:value={toneladas} />
      </div>
      <Button type="submit" class="w-full" disabled={!mapa || calculando || origen === destino || !(toneladas > 0)}>
        {calculando ? "Comparando…" : "Comparar"}
      </Button>
    </form>

    {#if error}<Alert color="red" class="mt-4">{error}</Alert>{/if}

    {#if resultado}
      <div class="mt-6 space-y-4" aria-live="polite">
        {#each opcionesMostradas as { titulo, op } (titulo)}
          <article class="rounded-lg border-2 p-4 {op?.modo === 'camion-tren' ? 'border-servicios' : 'border-senal-500'}">
            <header class="flex flex-wrap items-center gap-2">
              <h2 class="mr-auto text-lg font-extrabold">{titulo}</h2>
              {#if op && resultado.masBarata === op.modo}<Badge color="green">Más barata</Badge>{/if}
              {#if op && resultado.masRapida === op.modo}<Badge color="blue">Más rápida</Badge>{/if}
            </header>
            {#if op}
              <dl class="cifra mt-3 grid grid-cols-3 gap-2">
                <div><dt class="text-xs text-asfalto/60">Costo</dt><dd class="text-lg font-bold whitespace-nowrap">{pesos(op.costo)}</dd></div>
                <div><dt class="text-xs text-asfalto/60">Tiempo</dt><dd class="text-lg font-bold whitespace-nowrap">{duracion(op.minutos)}</dd></div>
                <div><dt class="text-xs text-asfalto/60">Distancia</dt><dd class="text-lg font-bold whitespace-nowrap">{km(op.kilometros)}</dd></div>
              </dl>
              {#if op.tramos}
                <ol class="mt-3 space-y-1 text-sm">
                  {#each op.tramos as t, i (i)}
                    <li class="flex gap-2">
                      <span class="w-14 shrink-0 font-bold {t.modo === 'tren' ? 'text-servicios' : 'text-senal-600'}">{t.modo === "tren" ? "Tren" : "Camión"}</span>
                      <span class="flex-1">{nombreDe(mapa, t.desde)} a {nombreDe(mapa, t.hasta)}</span>
                      <span class="cifra text-asfalto/70">{duracion(t.minutos)}, {pesos(t.costo)}</span>
                    </li>
                  {/each}
                </ol>
                <p class="mt-2 text-xs text-asfalto/60">El tiempo incluye subir y bajar la carga en cada estación.</p>
              {/if}
            {:else}
              <p class="mt-2 text-sm text-asfalto/70">No hay forma de hacer este viaje con esta opción.</p>
            {/if}
          </article>
        {/each}
        <p class="text-xs text-asfalto/60">El camión cuesta {pesos(resultado.costoKmCamion)} por kilómetro más casetas (valor configurable en el backend).</p>
      </div>
    {/if}
  </section>

  <section class="relative h-[60vh] md:h-full" aria-label="Mapa">
    {#if mapa}
      <MapaRed {mapa} ruta={resultado?.soloCamion?.ruta?.map((p) => p.idPunto) ?? []} rutaSecundaria={recorridoTren} />
      {#if resultado}
        <div class="absolute bottom-6 left-4 z-[1000] rounded-md bg-white/95 px-3 py-2 text-sm shadow">
          <p><span class="mr-2 inline-block h-1.5 w-6 bg-senal-500 align-middle"></span>Solo camión</p>
          <p><span class="mr-2 inline-block h-1.5 w-6 border-t-4 border-dashed border-[#5c6670] align-middle"></span>Camión y tren (esquema)</p>
        </div>
      {/if}
    {:else}
      <div class="grid h-full place-items-center text-asfalto/60">Cargando la red…</div>
    {/if}
  </section>
</div>
