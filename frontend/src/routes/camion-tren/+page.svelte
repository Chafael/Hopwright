<script lang="ts">
  import { Button } from "flowbite-svelte";
  import { Clock, Coins, Scale, Search, TrainFront, Truck, Weight } from "@lucide/svelte";
  import { onMount, tick } from "svelte";
  import MapaRed from "$lib/MapaRed.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import SalidaLlegada from "$lib/ui/SalidaLlegada.svelte";
  import Busqueda from "$lib/ui/Busqueda.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import { api, duracion, km, pesos, type ComparacionCamionTren, type Exploracion, type Mapa, type OpcionTransporte } from "$lib/api";
  import { cargarRed, nombreDe, opciones } from "$lib/red.svelte";

  // C2: todo en camión o combinar camión y tren (GET /rutas/camion-tren).
  // En el mapa se anima la búsqueda de la ruta en camión y después se marca el tramo en tren.
  let mapaRed = $state<Mapa>();
  let origen = $state("07101");
  let destino = $state("07089");
  let toneladas = $state(20);
  let resultado = $state<ComparacionCamionTren>();
  let exploracion = $state<Exploracion | null>(null);
  let progreso = $state({ explorados: 0, terminado: false });
  let error = $state("");
  let calculando = $state(false);
  let zonaResultado = $state<HTMLElement>();

  const ciudades = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad"]) : []);
  const totalLugares = $derived(mapaRed ? mapaRed.puntos.filter((p) => p.tipo !== "Estacion").length : 0);

  onMount(async () => {
    try {
      mapaRed = await cargarRed();
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function comparar(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    calculando = true;
    const [c, e] = await Promise.allSettled([
      api.camionTren({ origen, destino, pesoKg: toneladas * 1000 }),
      api.exploracion({ origen, destino, criterio: "tiempo", evitarTerraceria: false, algoritmo: "dijkstra" }),
    ]);
    calculando = false;
    if (c.status === "rejected") {
      error = (c.reason as Error).message;
      resultado = undefined;
      exploracion = null;
      return;
    }
    progreso = { explorados: 0, terminado: e.status !== "fulfilled" };
    resultado = c.value;
    exploracion = e.status === "fulfilled" ? e.value : null;
    await tick();
    zonaResultado?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Estaciones por las que pasa el tren entre la de subida y la de bajada (camino en la vía férrea)
  const recorridoTren = $derived.by(() => {
    const ct = resultado?.camionTren;
    if (!mapaRed || !ct?.estacionSubida || !ct.estacionBajada) return [];
    const vecinos = new Map<string, string[]>();
    for (const t of mapaRed.tramos.filter((t) => t.tipo === "VIA_FERREA")) {
      vecinos.set(t.desde, [...(vecinos.get(t.desde) ?? []), t.hasta]);
      vecinos.set(t.hasta, [...(vecinos.get(t.hasta) ?? []), t.desde]);
    }
    const previo = new Map<string, string>([[ct.estacionSubida, ""]]);
    const cola = [ct.estacionSubida];
    while (cola.length) {
      const e = cola.shift()!;
      for (const v of vecinos.get(e) ?? []) if (!previo.has(v)) (previo.set(v, e), cola.push(v));
    }
    if (!previo.has(ct.estacionBajada)) return [];
    const camino = [ct.estacionBajada];
    while (previo.get(camino[0])) camino.unshift(previo.get(camino[0])!);
    return camino;
  });

  const opcionesVista = $derived(
    resultado
      ? ([
          { clave: "camion", titulo: "Todo en camión", op: resultado.soloCamion },
          { clave: "camion-tren", titulo: "Camión y tren", op: resultado.camionTren },
        ] as { clave: string; titulo: string; op: OpcionTransporte | null }[])
      : [],
  );
  const maxCosto = $derived(Math.max(...opcionesVista.map((o) => o.op?.costo ?? 0), 1));
  const maxMinutos = $derived(Math.max(...opcionesVista.map((o) => o.op?.minutos ?? 0), 1));
  const ahorro = $derived(
    resultado?.soloCamion && resultado.camionTren ? Math.abs(resultado.soloCamion.costo - resultado.camionTren.costo) : 0,
  );
</script>

<svelte:head><title>Camión o tren · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed
        mapa={mapaRed}
        margen={420}
        ruta={resultado?.soloCamion?.ruta?.map((p) => p.idPunto) ?? []}
        rutaSecundaria={progreso.terminado ? recorridoTren : []}
        colorSecundaria="#1f5fa8"
        {exploracion}
        alAvanzar={(e) => (progreso = e)}
      />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">Cargando el mapa…</div>
    {/if}
  {/snippet}

  {#snippet encima()}
    {#if exploracion && resultado?.soloCamion}
      <Busqueda
        {exploracion}
        {progreso}
        total={totalLugares}
        distancia={km(resultado.soloCamion.kilometros)}
        tiempo={duracion(resultado.soloCamion.minutos)}
        leyendaExtra={recorridoTren.length ? { color: "#1f5fa8", texto: "Tramo en tren", punteada: true } : undefined}
      />
    {/if}
  {/snippet}

  <h1 class="flex items-center gap-2 text-2xl font-extrabold"><Scale class="h-6 w-6 text-senal-600" />¿Camión o tren?</h1>
  <p class="mt-1 font-semibold">Compara mandar la carga todo en camión contra subirla al tren de la costa.</p>

  <form class="mt-4 space-y-5" onsubmit={comparar}>
    <SalidaLlegada bind:origen bind:destino {ciudades} deshabilitado={!mapaRed} />
    {#if origen === destino}<Aviso tono="rojo">La salida y la llegada tienen que ser distintas.</Aviso>{/if}

    <fieldset>
      <legend class="mb-2 text-sm font-bold">¿Cuánto pesa la carga?</legend>
      <label class="flex items-center gap-3 rounded-xl bg-concreto px-3 py-2">
        <Weight class="h-5 w-5 text-asfalto" />
        <input type="number" min="0.1" step="0.1" required bind:value={toneladas} class="w-24 rounded-lg border-black/20 py-1.5 text-center text-lg font-extrabold" aria-label="Toneladas" />
        <span class="font-bold">toneladas</span>
      </label>
      <div class="mt-2 flex gap-2">
        {#each [5, 10, 20, 40] as t (t)}
          <button
            type="button"
            onclick={() => (toneladas = t)}
            class="flex-1 rounded-lg border-2 py-1.5 text-sm font-bold {toneladas === t ? 'border-senal-500 bg-senal-50 text-senal-700' : 'border-black/10 hover:border-black/25'}"
            >{t} t</button
          >
        {/each}
      </div>
    </fieldset>

    <Button type="submit" size="lg" class="w-full gap-2" disabled={!mapaRed || calculando || origen === destino || !(toneladas > 0)}>
      <Search class="h-5 w-5" />{calculando ? "Comparando…" : "Comparar"}
    </Button>
  </form>

  {#if error}<div class="mt-4"><Aviso tono="rojo">{error}</Aviso></div>{/if}

  {#if resultado}
    <div class="mt-6 scroll-mt-4 space-y-3" aria-live="polite" bind:this={zonaResultado}>
      {#if resultado.masBarata && resultado.masBarata !== resultado.masRapida && ahorro > 0}
        <div class="rounded-xl bg-senal-500 p-4 text-white">
          <p class="text-sm font-semibold text-senal-100">La opción más barata ahorra</p>
          <p class="cifra text-3xl font-extrabold">{pesos(ahorro)}</p>
          <p class="text-sm font-semibold">
            {resultado.masBarata === "camion-tren" ? "subiendo la carga al tren" : "yendo todo en camión"}, pero tarda más.
          </p>
        </div>
      {/if}

      {#each opcionesVista as { clave, titulo, op } (clave)}
        {@const esTren = clave === "camion-tren"}
        <article class="rounded-xl border-2 p-4 {esTren ? 'border-servicios' : 'border-senal-500'}">
          <header class="flex items-center gap-2">
            <span class="grid h-10 w-10 place-items-center rounded-lg {esTren ? 'bg-servicios' : 'bg-senal-500'} text-white">
              {#if esTren}<TrainFront class="h-5 w-5" />{:else}<Truck class="h-5 w-5" />{/if}
            </span>
            <h2 class="mr-auto text-lg font-extrabold">{titulo}</h2>
            {#if op && resultado.masBarata === op.modo}<span class="flex items-center gap-1 rounded-full bg-senal-50 px-2 py-0.5 text-xs font-bold text-senal-700"><Coins class="h-3.5 w-3.5" />Más barata</span>{/if}
            {#if op && resultado.masRapida === op.modo}<span class="flex items-center gap-1 rounded-full bg-[#e7f0fb] px-2 py-0.5 text-xs font-bold text-servicios"><Clock class="h-3.5 w-3.5" />Más rápida</span>{/if}
          </header>
          {#if op}
            <div class="mt-3 space-y-2">
              <div>
                <div class="flex justify-between text-sm font-bold"><span>Costo</span><span class="cifra">{pesos(op.costo)}</span></div>
                <div class="mt-1 h-2.5 rounded-full bg-concreto"><div class="h-full rounded-full {esTren ? 'bg-servicios' : 'bg-senal-500'}" style="width: {(100 * op.costo) / maxCosto}%"></div></div>
              </div>
              <div>
                <div class="flex justify-between text-sm font-bold"><span>Tiempo</span><span class="cifra">{duracion(op.minutos)}</span></div>
                <div class="mt-1 h-2.5 rounded-full bg-concreto"><div class="h-full rounded-full {esTren ? 'bg-servicios' : 'bg-senal-500'}" style="width: {(100 * op.minutos) / maxMinutos}%"></div></div>
              </div>
            </div>
            {#if op.tramos}
              <ol class="mt-3 space-y-1.5 border-t border-black/10 pt-3 text-sm">
                {#each op.tramos.filter((t) => t.desde !== t.hasta) as t, i (i)}
                  <li class="flex items-center gap-2">
                    {#if t.modo === "tren"}<TrainFront class="h-4 w-4 shrink-0 text-servicios" />{:else}<Truck class="h-4 w-4 shrink-0 text-senal-600" />{/if}
                    <span class="flex-1 font-semibold">{nombreDe(mapaRed, t.desde)} a {nombreDe(mapaRed, t.hasta)}</span>
                    <span class="cifra">{duracion(t.minutos)}</span>
                  </li>
                {/each}
              </ol>
            {/if}
          {:else}
            <p class="mt-2 text-sm font-semibold">No hay forma de hacer este viaje así.</p>
          {/if}
        </article>
      {/each}
      <p class="text-xs font-semibold text-asfalto">
        El camión cuesta {pesos(resultado.costoKmCamion)} por kilómetro más casetas; el tren cobra por tonelada. El tiempo con tren incluye subir y bajar la carga.
      </p>
    </div>
  {/if}
</VistaMapa>
