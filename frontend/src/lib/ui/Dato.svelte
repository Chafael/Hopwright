<script lang="ts">
  import type { Component } from "svelte";

  // Una cifra grande con su ícono y una etiqueta corta debajo
  let { icono, valor, etiqueta, tono = "oscuro" }: { icono: Component<{ class?: string }>; valor: string; etiqueta: string; tono?: "oscuro" | "verde" | "azul" } = $props();
  const color = { oscuro: "text-asfalto", verde: "text-senal-600", azul: "text-servicios" };
  const Icono = $derived(icono);
</script>

<div class="flex items-center gap-2.5 rounded-xl bg-concreto px-3 py-2.5">
  <Icono class="h-5 w-5 shrink-0 {color[tono]}" />
  <div class="min-w-0">
    <p class="cifra truncate text-lg leading-tight font-extrabold {color[tono]}">{valor}</p>
    <p class="text-xs font-semibold text-asfalto">{etiqueta}</p>
  </div>
</div>
