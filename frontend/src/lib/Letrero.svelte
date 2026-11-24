<script lang="ts">
  // Resultado de una ruta con forma de señal informativa de carretera:
  // el destino en grande y debajo la distancia, el tiempo y el costo.
  let { destino, lineas, color = "verde" }: { destino: string; lineas: string[]; color?: "verde" | "azul" } = $props();
</script>

<div class="senal px-5 py-4 {color === 'azul' ? 'senal-azul' : ''}">
  <p class="text-2xl leading-tight font-extrabold">{destino}</p>
  <p class="cifra mt-1 flex flex-wrap gap-x-4 text-lg font-semibold">
    {#each lineas as l, i (i)}<span>{l}</span>{/each}
  </p>
</div>

<style>
  .senal-azul {
    background: var(--color-servicios);
    box-shadow:
      inset 0 0 0 2px var(--color-servicios),
      inset 0 0 0 4px #fff;
  }
</style>
