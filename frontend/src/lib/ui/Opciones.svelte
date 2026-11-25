<script lang="ts" generics="T extends string">
  import type { Component } from "svelte";

  // Grupo de opciones en mosaicos con ícono. Por dentro son radios, así que se manejan con teclado.
  let {
    nombre,
    opciones,
    valor = $bindable(),
    columnas = 3,
    leyenda,
  }: {
    nombre: string;
    opciones: { valor: T; titulo: string; detalle?: string; icono: Component<{ class?: string }> }[];
    valor: T;
    columnas?: 2 | 3 | 4;
    leyenda: string;
  } = $props();

  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };
</script>

<fieldset>
  <legend class="mb-2 text-sm font-bold">{leyenda}</legend>
  <div class="grid gap-2 {grid[columnas]}">
    {#each opciones as o (o.valor)}
      {@const Icono = o.icono}
      <label
        class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors
          has-[:checked]:border-senal-500 has-[:checked]:bg-senal-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-senal-500
          border-black/10 hover:border-black/25"
      >
        <input type="radio" name={nombre} value={o.valor} bind:group={valor} class="sr-only" />
        <Icono class="h-6 w-6 {valor === o.valor ? 'text-senal-600' : 'text-asfalto'}" />
        <span class="text-sm leading-tight font-bold">{o.titulo}</span>
        {#if o.detalle}<span class="text-xs leading-tight font-semibold text-asfalto">{o.detalle}</span>{/if}
      </label>
    {/each}
  </div>
</fieldset>
