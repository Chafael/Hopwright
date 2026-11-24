<script lang="ts">
  import { Button } from "flowbite-svelte";
  import { Clock, Coins, Flame, Milestone, Package, RotateCcw, Ruler, Search, ShieldCheck, Snowflake, Split, Waypoints } from "@lucide/svelte";
  import { onMount } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import Letrero from "$lib/Letrero.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import Opciones from "$lib/ui/Opciones.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import Busqueda from "$lib/ui/Busqueda.svelte";
  import SalidaLlegada from "$lib/ui/SalidaLlegada.svelte";
  import { tick } from "svelte";
  import { api, duracion, km, pesos, type Algoritmo, type Criterio, type Exploracion, type Mapa, type Ruta } from "$lib/api";
  import { Reproductor } from "$lib/reproductor.svelte";
  import { cargarRed, opciones } from "$lib/red.svelte";

  // Planear una ruta (C1, GET /rutas) y ver cómo se encontró (GET /rutas/exploracion)
  let mapaRed = $state<Mapa>();
  let errorRed = $state("");
  let origen = $state("07101");
  let destino = $state("07089");
  let criterio = $state<Criterio>("tiempo");
  let carga = $state<"normal" | "peligrosa" | "refrigerada">("normal");
  let horasMax = $state(6);
  let algoritmo = $state<Algoritmo>("dijkstra");

  let resultado = $state<Ruta>();
  let exploracion = $state<Exploracion | null>(null);
  let errorBusqueda = $state("");
  let error = $state("");
  let calculando = $state(false);
  let progreso = $state({ explorados: 0, terminado: false });
  const reproductor = new Reproductor();
  let zonaResultado = $state<HTMLElement>();

  const ciudades = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad"]) : []);
  const totalLugares = $derived(mapaRed ? mapaRed.puntos.filter((p) => p.tipo !== "Estacion").length : 0);

  onMount(async () => {
    try {
      mapaRed = await cargarRed();
    } catch (e) {
      errorRed = (e as Error).message;
    }
  });

  async function buscar(evento?: SubmitEvent) {
    evento?.preventDefault();
    error = "";
    errorBusqueda = "";
    calculando = true;
    const consulta = {
      origen,
      destino,
      criterio,
      evitarTerraceria: carga === "peligrosa",
      tiempoMaxMin: carga === "refrigerada" ? Math.round(horasMax * 60) : null,
    };
    // La ruta y la búsqueda se piden juntas; si la búsqueda falla, la ruta se muestra igual
    const [r, e] = await Promise.allSettled([api.ruta(consulta), api.exploracion({ ...consulta, algoritmo })]);
    calculando = false;
    if (r.status === "rejected") {
      error = (r.reason as Error).message;
      resultado = undefined;
      exploracion = null;
      return;
    }
    progreso = { explorados: 0, terminado: e.status !== "fulfilled" };
    resultado = r.value;
    exploracion = e.status === "fulfilled" ? e.value : null;
    if (e.status === "rejected") errorBusqueda = (e.reason as Error).message;
    await tick();
    // En celular el mapa queda arriba: se sube para ver la animación; en escritorio se muestra el resultado en la tarjeta
    if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: "smooth" });
    else zonaResultado?.scrollIntoView({ behavior: "smooth", block: "start" });
  }


  const criterios = [
    { valor: "tiempo" as const, titulo: "Llegar rápido", icono: Clock },
    { valor: "distancia" as const, titulo: "Menos km", icono: Ruler },
    { valor: "costo" as const, titulo: "Sin casetas", icono: Coins },
  ];
  const cargas = [
    { valor: "normal" as const, titulo: "Normal", detalle: "Cualquier camino", icono: Package },
    { valor: "peligrosa" as const, titulo: "Peligrosa", detalle: "Sin terracería", icono: Flame },
    { valor: "refrigerada" as const, titulo: "Refrigerada", detalle: "Con tiempo límite", icono: Snowflake },
  ];
  const algoritmos = [
    { valor: "dijkstra" as const, titulo: "Desde la salida", detalle: "Dijkstra", icono: Waypoints },
    { valor: "bidireccional" as const, titulo: "Desde los dos lados", detalle: "Dijkstra bidireccional", icono: Split },
  ];
</script>

<svelte:head><title>Planear ruta · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed
        mapa={mapaRed}
        margen={420}
        ruta={resultado?.encontrada ? resultado.ruta.map((p) => p.idPunto) : []}
        {exploracion}
        {reproductor}
        alAvanzar={(e) => (progreso = e)}
      />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">{errorRed ? "No se pudo cargar la red" : "Cargando el mapa…"}</div>
    {/if}
  {/snippet}

  {#snippet encima()}
    {#if exploracion}
      <Busqueda
        {exploracion}
        {progreso}
        {reproductor}
        total={totalLugares}
        distancia={resultado?.encontrada ? km(resultado.kilometros) : "Sin ruta"}
        tiempo={resultado?.encontrada ? duracion(resultado.minutos) : "Sin ruta"}
      />
    {/if}
  {/snippet}

  <h1 class="flex items-center gap-2 text-2xl font-extrabold"><Waypoints class="h-6 w-6 text-senal-600" />Planear una ruta</h1>

  <form class="mt-4 space-y-5" onsubmit={buscar}>
    <SalidaLlegada bind:origen bind:destino {ciudades} deshabilitado={!mapaRed} />
    {#if origen === destino}<Aviso tono="rojo">La salida y la llegada tienen que ser distintas.</Aviso>{/if}

    <Opciones nombre="criterio" leyenda="¿Qué te importa más?" opciones={criterios} bind:valor={criterio} />
    <Opciones nombre="carga" leyenda="¿Qué llevas?" opciones={cargas} bind:valor={carga} />
    {#if carga === "refrigerada"}
      <label class="flex flex-wrap items-center gap-2 rounded-xl bg-[#e7f0fb] px-3 py-2.5 text-sm font-bold">
        <Snowflake class="h-5 w-5 text-servicios" />
        Tiene que llegar en menos de
        <input type="number" min="0.5" step="0.5" bind:value={horasMax} class="w-20 rounded-lg border-black/20 py-1 text-center font-extrabold" />
        horas
      </label>
    {/if}
    <Opciones nombre="algoritmo" leyenda="¿Cómo buscar?" opciones={algoritmos} columnas={2} bind:valor={algoritmo} />

    <Button type="submit" size="lg" class="w-full gap-2" disabled={!mapaRed || calculando || origen === destino}>
      <Search class="h-5 w-5" />{calculando ? "Buscando…" : "Buscar ruta"}
    </Button>
  </form>

  {#if errorRed}<div class="mt-4"><Aviso tono="rojo">No se pudo cargar la red: {errorRed}</Aviso></div>{/if}
  {#if error}<div class="mt-4"><Aviso tono="rojo">{error}</Aviso></div>{/if}

  {#if resultado}
    <div class="mt-6 scroll-mt-4 space-y-4" aria-live="polite" bind:this={zonaResultado}>
      {#if resultado.encontrada}
        <Letrero destino={resultado.ruta.at(-1)?.nombre ?? ""} lineas={[km(resultado.kilometros), duracion(resultado.minutos), resultado.costoCasetas ? `${pesos(resultado.costoCasetas)} en casetas` : "Sin casetas"]} />
        {#each resultado.avisos as aviso, i (i)}<Aviso>{aviso}</Aviso>{/each}

        {#if exploracion}
          <section class="rounded-xl bg-[#0e1726] p-4 text-white" aria-label="Cómo se encontró la ruta">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-extrabold">Cómo se encontró</h2>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold hover:bg-white/20 disabled:opacity-40"
                onclick={() => reproductor.reiniciar()}><RotateCcw class="h-3.5 w-3.5" />Ver otra vez</button
              >
            </div>
            <p class="mt-2 text-sm">
              Revisó <strong class="text-[#4f9bff]">{exploracion.explorados} de {totalLugares}</strong> lugares y
              <strong class="text-[#4f9bff]">{exploracion.tramosRevisados}</strong> tramos de carretera antes de elegir.
            </p>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div class="h-full rounded-full bg-[#4f9bff] transition-[width] duration-300" style="width: {(100 * progreso.explorados) / Math.max(totalLugares, 1)}%"></div>
            </div>
            <p class="mt-3 flex items-center gap-2 text-sm font-bold {exploracion.coincide ? 'text-[#3ee07a]' : 'text-preventivo'}">
              <ShieldCheck class="h-4 w-4" />{exploracion.coincide ? "Neo4j llegó a la misma ruta" : "El resultado no coincide con Neo4j"}
            </p>
            {#each exploracion.avisos as a, i (i)}<p class="mt-1 text-sm text-white">{a}</p>{/each}
          </section>
        {:else if errorBusqueda}
          <Aviso tono="azul">La ruta está lista, pero no se pudo mostrar cómo se buscó: {errorBusqueda}</Aviso>
        {/if}

        <section aria-labelledby="recorrido">
          <h2 id="recorrido" class="mb-2 font-extrabold">Recorrido</h2>
          <ol class="relative ml-2 border-l-4 border-senal-500 pl-5">
            {#each resultado.ruta as punto, i (punto.idPunto + i)}
              {@const t = resultado.tramos[i]}
              <li class="relative pb-3 last:pb-0">
                <span class="absolute top-1 -left-[30px] h-5 w-5 rounded-full border-4 border-senal-500 bg-white"></span>
                <p class="font-bold">
                  {punto.nombre}
                  {#if punto.tipo === "Interseccion"}<Milestone class="ml-1 inline h-4 w-4 text-asfalto" aria-label="cruce" />{/if}
                </p>
                {#if t}
                  <p class="cifra flex flex-wrap items-center gap-x-3 text-sm font-semibold text-asfalto">
                    <span>{t.tipoVia}</span><span>{km(t.distanciaKm)}</span><span>{duracion(t.tiempoMin)}</span>
                    {#if t.costoCaseta}<span class="flex items-center gap-1 font-bold text-asfalto"><Coins class="h-3.5 w-3.5" />{pesos(t.costoCaseta)}</span>{/if}
                  </p>
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {:else}
        <Aviso>
          <p class="font-bold">No hay un camino que cumpla con lo que pediste.</p>
          {#each resultado.avisos as aviso, i (i)}<p>{aviso}</p>{/each}
        </Aviso>
      {/if}
    </div>
  {/if}
</VistaMapa>
