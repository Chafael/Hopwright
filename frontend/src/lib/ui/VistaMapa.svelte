<script lang="ts">
  import type { Snippet } from "svelte";

  // Pantalla con el mapa de fondo y una tarjeta flotante a la izquierda (en el celular, la tarjeta va debajo).
  // El mapa va en el snippet mapa; lo que flota sobre el mapa (marcadores, leyendas) va en encima.
  let { children, mapa, encima }: { children: Snippet; mapa: Snippet; encima?: Snippet } = $props();
</script>

<div class="relative flex min-h-full flex-col md:block md:h-full">
  <div class="relative h-[62vh] shrink-0 md:absolute md:inset-0 md:h-auto">
    {@render mapa()}
    {#if encima}{@render encima()}{/if}
  </div>
  <aside
    class="relative z-10 bg-white md:absolute md:top-4 md:bottom-4 md:left-4 md:w-[400px] md:overflow-y-auto md:rounded-2xl md:shadow-2xl md:ring-1 md:ring-black/5"
  >
    <div class="p-5">{@render children()}</div>
  </aside>
</div>
