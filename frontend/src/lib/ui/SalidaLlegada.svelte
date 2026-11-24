<script lang="ts">
  import { Select } from "flowbite-svelte";
  import { ArrowDownUp } from "@lucide/svelte";

  // Salida y llegada unidas por una línea punteada, con un botón para intercambiarlas
  let {
    origen = $bindable(),
    destino = $bindable(),
    ciudades,
    deshabilitado = false,
  }: { origen: string; destino: string; ciudades: { value: string; name: string }[]; deshabilitado?: boolean } = $props();
</script>

<div class="relative rounded-xl bg-concreto py-3 pr-12 pl-3">
  <div class="absolute top-[30px] bottom-[30px] left-[18px] border-l-2 border-dotted border-asfalto/40" aria-hidden="true"></div>
  <div class="flex items-center gap-3">
    <span class="relative h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-senal-500 bg-white" aria-hidden="true"></span>
    <Select items={ciudades} bind:value={origen} disabled={deshabilitado} aria-label="Sale de" class="bg-white font-semibold" />
  </div>
  <div class="mt-2 flex items-center gap-3">
    <span class="relative h-3.5 w-3.5 shrink-0 rounded-full bg-asfalto" aria-hidden="true"></span>
    <Select items={ciudades} bind:value={destino} disabled={deshabilitado} aria-label="Llega a" class="bg-white font-semibold" />
  </div>
  <button
    type="button"
    onclick={() => ([origen, destino] = [destino, origen])}
    class="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 hover:bg-senal-50"
    aria-label="Intercambiar salida y llegada"><ArrowDownUp class="h-4 w-4" /></button
  >
</div>
