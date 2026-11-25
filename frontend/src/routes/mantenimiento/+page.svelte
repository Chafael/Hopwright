<script lang="ts">
  import { Button } from "flowbite-svelte";
  import { ArrowRight, Building2, Database, FileText, Network, RefreshCw, Truck } from "@lucide/svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import { api, type Reconciliacion } from "$lib/api";
  import { recargarRed } from "$lib/red.svelte";

  // POST /admin/reconciliar: Neo4j guarda copias de datos que viven en otras bases; aquí se ponen al día
  let resultado = $state<Reconciliacion>();
  let error = $state("");
  let corriendo = $state(false);

  async function sincronizar() {
    corriendo = true;
    error = "";
    try {
      resultado = await api.reconciliar();
      await recargarRed();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      corriendo = false;
    }
  }

  // Cada flujo: de qué base sale, qué copia a Neo4j y cuántos cambios hizo
  const flujos = $derived([
    {
      base: "MongoDB",
      que: "Incidentes",
      icono: FileText,
      color: "bg-[#13aa52]",
      revisados: resultado?.incidentes.revisados,
      cambios: resultado ? resultado.incidentes.copiados.length + resultado.incidentes.borradosDelGrafo.length : undefined,
      detalle: resultado
        ? [
            ...resultado.incidentes.copiados.map((i) => `${i} copiado`),
            ...resultado.incidentes.borradosDelGrafo.map((i) => `${i} quitado`),
            ...resultado.incidentes.conPuntoInexistente.map((i) => `${i}: su lugar ya no existe`),
          ]
        : [],
    },
    {
      base: "PostgreSQL",
      que: "Ciudades",
      icono: Building2,
      color: "bg-[#336791]",
      revisados: resultado?.ciudades?.revisadas,
      cambios: resultado?.ciudades ? resultado.ciudades.copiadas.length : undefined,
      detalle: resultado?.ciudades ? resultado.ciudades.copiadas.map((c) => `${c} copiada`) : [],
    },
    {
      base: "PostgreSQL",
      que: "Vehículos",
      icono: Truck,
      color: "bg-[#336791]",
      revisados: resultado?.vehiculos?.revisados,
      cambios: resultado?.vehiculos ? resultado.vehiculos.copiados.length + resultado.vehiculos.borradosDelGrafo.length : undefined,
      detalle: resultado?.vehiculos
        ? [...resultado.vehiculos.copiados.map((v) => `${v} copiado`), ...resultado.vehiculos.borradosDelGrafo.map((v) => `${v} quitado`)]
        : [],
    },
  ]);
</script>

<svelte:head><title>Sincronizar · Hopwright</title></svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-4xl p-5 md:p-8">
    <h1 class="flex items-center gap-2 text-3xl font-extrabold"><RefreshCw class="h-7 w-7 text-senal-600" />Sincronizar las bases</h1>
    <p class="mt-2 max-w-2xl text-[15px] font-semibold">
      El mapa de rutas (Neo4j) usa copias de los incidentes, las ciudades y los vehículos. Si una base estuvo caída, alguna copia pudo quedarse
      atrás. Esto las compara con el original y las corrige.
    </p>

    <!-- Diagrama: de dónde sale cada copia -->
    <div class="mt-6 grid items-center gap-4 md:grid-cols-[1fr_auto_220px]">
      <ul class="space-y-3">
        {#each flujos as f (f.que)}
          <li class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white {f.color}"><Database class="h-6 w-6" /></span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-asfalto">{f.base}</p>
              <p class="flex items-center gap-1.5 text-lg font-extrabold"><f.icono class="h-5 w-5" />{f.que}</p>
            </div>
            {#if f.cambios !== undefined}
              <div class="text-right">
                <p class="cifra text-2xl leading-none font-extrabold {f.cambios > 0 ? 'text-senal-600' : ''}">{f.cambios}</p>
                <p class="text-xs font-bold">{f.cambios === 1 ? "corrección" : "correcciones"}</p>
              </div>
            {:else if resultado}
              <span class="rounded-full bg-preventivo px-2 py-0.5 text-xs font-bold">Sin revisar</span>
            {/if}
            <ArrowRight class="hidden h-6 w-6 shrink-0 text-senal-600 md:block" />
          </li>
        {/each}
      </ul>
      <div class="hidden h-full w-1 rounded bg-senal-500/30 md:block" aria-hidden="true"></div>
      <div class="rounded-2xl bg-senal-500 p-5 text-center text-white shadow-lg">
        <Network class="mx-auto h-10 w-10" />
        <p class="mt-2 text-2xl font-extrabold">Neo4j</p>
        <p class="text-sm font-semibold text-senal-100">Mapa de rutas</p>
      </div>
    </div>

    <Button size="xl" class="mt-6 w-full gap-2 md:w-auto" onclick={sincronizar} disabled={corriendo}>
      <RefreshCw class="h-5 w-5 {corriendo ? 'animate-spin' : ''}" />{corriendo ? "Revisando…" : "Revisar y corregir ahora"}
    </Button>
    <p class="mt-2 text-sm font-semibold">Se puede correr las veces que haga falta: si todo está al día, no cambia nada.</p>

    {#if error}<div class="mt-4"><Aviso tono="rojo">{error}</Aviso></div>{/if}

    {#if resultado}
      <div class="mt-6 space-y-3" aria-live="polite">
        {#if flujos.every((f) => !f.cambios) && resultado.avisos.length === 0}
          <Aviso tono="verde"><p class="font-bold">Todo estaba al día.</p><p>Se revisó en {resultado.duracionMs} ms.</p></Aviso>
        {:else}
          {#each flujos.filter((f) => f.detalle.length) as f (f.que)}
            <div class="rounded-xl bg-white p-4 ring-1 ring-black/5">
              <p class="font-extrabold">{f.que}</p>
              <ul class="mt-1 flex flex-wrap gap-1.5">
                {#each f.detalle as d (d)}<li class="rounded-full bg-senal-50 px-2.5 py-0.5 text-sm font-bold text-senal-700">{d}</li>{/each}
              </ul>
            </div>
          {/each}
        {/if}
        {#each resultado.avisos as a, i (i)}
          <Aviso>{a}</Aviso>
        {/each}
      </div>
    {/if}
  </div>
</div>
