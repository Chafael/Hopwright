<script lang="ts">
  import { Alert, Button } from "flowbite-svelte";
  import { api, type Reconciliacion } from "$lib/api";
  import { recargarRed } from "$lib/red.svelte";

  // POST /admin/reconciliar: compara las copias del grafo contra su fuente de verdad
  let resultado = $state<Reconciliacion>();
  let error = $state("");
  let corriendo = $state(false);

  async function reconciliar() {
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

  const lista = (ids: string[] | undefined) => (ids && ids.length > 0 ? ids.join(", ") : "ninguno");
</script>

<svelte:head><title>Mantenimiento · Hopwright</title></svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-3xl p-5">
    <h1 class="text-2xl font-extrabold">Revisar las tres bases</h1>
    <p class="mt-2 max-w-prose text-asfalto/80">
      Cada dato tiene una base dueña. Los incidentes viven en MongoDB; las ciudades y los vehículos, en PostgreSQL. Neo4j guarda una copia
      de lo que necesita para calcular rutas. Si una base estuvo caída, esa copia pudo quedarse atrás. La revisión la compara contra la
      base dueña y la corrige. Se puede correr las veces que haga falta: la segunda vez ya no cambia nada.
    </p>

    <Button class="mt-5" onclick={reconciliar} disabled={corriendo}>{corriendo ? "Revisando…" : "Revisar y corregir ahora"}</Button>
    {#if error}<Alert color="red" class="mt-4">{error}</Alert>{/if}

    {#if resultado}
      <div class="mt-6 space-y-4" aria-live="polite">
        <p class="cifra text-sm text-asfalto/60">Terminó en {resultado.duracionMs} ms.</p>

        <section class="rounded-lg bg-white p-4">
          <h2 class="font-bold">Incidentes (MongoDB a Neo4j)</h2>
          <dl class="cifra mt-2 grid gap-1 text-sm sm:grid-cols-[200px_1fr]">
            <dt class="text-asfalto/60">Revisados</dt><dd>{resultado.incidentes.revisados}</dd>
            <dt class="text-asfalto/60">Copiados o corregidos</dt><dd>{lista(resultado.incidentes.copiados)}</dd>
            <dt class="text-asfalto/60">Borrados del grafo</dt><dd>{lista(resultado.incidentes.borradosDelGrafo)}</dd>
            <dt class="text-asfalto/60">En un punto que ya no existe</dt><dd>{lista(resultado.incidentes.conPuntoInexistente)}</dd>
          </dl>
        </section>

        <section class="rounded-lg bg-white p-4">
          <h2 class="font-bold">Ciudades (PostgreSQL a Neo4j)</h2>
          {#if resultado.ciudades}
            <dl class="cifra mt-2 grid gap-1 text-sm sm:grid-cols-[200px_1fr]">
              <dt class="text-asfalto/60">Revisadas</dt><dd>{resultado.ciudades.revisadas}</dd>
              <dt class="text-asfalto/60">Copiadas o renombradas</dt><dd>{lista(resultado.ciudades.copiadas)}</dd>
              <dt class="text-asfalto/60">Solo en el grafo</dt><dd>{lista(resultado.ciudades.soloEnGrafo)}</dd>
              <dt class="text-asfalto/60">Sin tramos</dt><dd>{lista(resultado.ciudades.sinTramos)}</dd>
            </dl>
          {:else}
            <p class="mt-2 text-sm text-asfalto/70">No se revisaron (ver avisos).</p>
          {/if}
        </section>

        <section class="rounded-lg bg-white p-4">
          <h2 class="font-bold">Vehículos (PostgreSQL a Neo4j)</h2>
          {#if resultado.vehiculos}
            <dl class="cifra mt-2 grid gap-1 text-sm sm:grid-cols-[200px_1fr]">
              <dt class="text-asfalto/60">Revisados</dt><dd>{resultado.vehiculos.revisados}</dd>
              <dt class="text-asfalto/60">Copiados</dt><dd>{lista(resultado.vehiculos.copiados)}</dd>
              <dt class="text-asfalto/60">Borrados del grafo</dt><dd>{lista(resultado.vehiculos.borradosDelGrafo)}</dd>
              <dt class="text-asfalto/60">Sin ubicación</dt><dd>{lista(resultado.vehiculos.sinUbicacion)}</dd>
            </dl>
          {:else}
            <p class="mt-2 text-sm text-asfalto/70">No se revisaron (ver avisos).</p>
          {/if}
        </section>

        {#each resultado.avisos as a, i (i)}
          <Alert color="yellow">{a}</Alert>
        {/each}
      </div>
    {/if}
  </div>
</div>
