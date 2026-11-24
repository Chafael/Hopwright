<script lang="ts">
  import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from "@lucide/svelte";
  import { VELOCIDADES, type Reproductor } from "$lib/reproductor.svelte";

  // Controles de la animación: reproducir o pausar, ir lugar por lugar, mover la barra y cambiar la velocidad.
  // Atajos: espacio pausa o reanuda, las flechas van al lugar anterior o al siguiente.
  let { reproductor }: { reproductor: Reproductor } = $props();

  const etiqueta = (v: number) => (v === 0.25 ? "¼×" : v === 0.5 ? "½×" : `${v}×`);
  const segundos = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function teclado(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea, [contenteditable]")) return;
    if (e.key === " ") {
      e.preventDefault();
      reproductor.alternar();
    } else if (e.key === "ArrowRight") reproductor.pasoSiguiente();
    else if (e.key === "ArrowLeft") reproductor.pasoAnterior();
  }

  const avance = $derived(reproductor.duracion ? (100 * reproductor.tiempo) / reproductor.duracion : 0);
  const finBusqueda = $derived(reproductor.duracion ? (100 * (reproductor.marcas.at(-1) ?? 0)) / reproductor.duracion : 0);
</script>

<svelte:window onkeydown={teclado} />

<div class="pointer-events-auto rounded-2xl bg-[#0e1726]/95 p-2 text-white sm:p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
  <div class="flex items-center gap-2">
    <button type="button" class="boton" onclick={() => reproductor.reiniciar()} title="Empezar de nuevo" aria-label="Empezar de nuevo"><RotateCcw class="h-4 w-4" /></button>
    <button type="button" class="boton" onclick={() => reproductor.pasoAnterior()} title="Lugar anterior (flecha izquierda)" aria-label="Lugar anterior"><ChevronLeft class="h-5 w-5" /></button>
    <button
      type="button"
      class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3ee07a] text-[#0e1726] hover:bg-[#62ea94]"
      onclick={() => reproductor.alternar()}
      title={reproductor.pausado || reproductor.terminado ? "Reproducir (espacio)" : "Pausar (espacio)"}
      aria-label={reproductor.pausado || reproductor.terminado ? "Reproducir" : "Pausar"}
    >
      {#if reproductor.pausado || reproductor.terminado}<Play class="ml-0.5 h-5 w-5 fill-current" />{:else}<Pause class="h-5 w-5 fill-current" />{/if}
    </button>
    <button type="button" class="boton" onclick={() => reproductor.pasoSiguiente()} title="Lugar siguiente (flecha derecha)" aria-label="Lugar siguiente"><ChevronRight class="h-5 w-5" /></button>

    <div class="relative mx-1 flex-1">
      <!-- La parte azul es la búsqueda y la verde es cuando se marca la ruta elegida -->
      <div class="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
        <div class="absolute inset-y-0 left-0 bg-[#4f9bff]" style="width: {Math.min(avance, finBusqueda)}%"></div>
        <div class="absolute inset-y-0 bg-[#3ee07a]" style="left: {finBusqueda}%; width: {Math.max(0, avance - finBusqueda)}%"></div>
      </div>
      <input
        type="range"
        min="0"
        max={reproductor.duracion}
        step="10"
        value={reproductor.tiempo}
        oninput={(e) => {
          reproductor.pausado = true;
          reproductor.irA(Number(e.currentTarget.value));
        }}
        class="barra relative w-full"
        aria-label="Momento de la animación"
      />
    </div>
    <span class="cifra w-20 shrink-0 text-right text-xs font-bold">{segundos(reproductor.tiempo / reproductor.velocidad)} / {segundos(reproductor.duracion / reproductor.velocidad)}</span>
  </div>

  <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mt-2.5">
    <p class="cifra text-sm font-bold">
      {#if reproductor.terminado}
        <span class="text-[#3ee07a]">Ruta encontrada</span>
      {:else if reproductor.lugaresVistos >= reproductor.marcas.length && reproductor.marcas.length}
        <span class="text-[#3ee07a]">Marcando la ruta más corta…</span>
      {:else}
        Lugar <span class="text-[#4f9bff]">{reproductor.lugaresVistos}</span> de {reproductor.marcas.length}<span class="hidden sm:inline">&nbsp;que revisa</span>
      {/if}
    </p>
    <div class="ml-auto flex items-center gap-0.5 sm:gap-1" role="radiogroup" aria-label="Velocidad">
      <span class="mr-1 hidden text-xs font-bold sm:inline">Velocidad</span>
      {#each VELOCIDADES as v (v)}
        <button
          type="button"
          role="radio"
          aria-checked={reproductor.velocidad === v}
          onclick={() => (reproductor.velocidad = v)}
          class="cifra rounded-md px-2 py-1 text-xs font-extrabold {reproductor.velocidad === v ? 'bg-white text-[#0e1726]' : 'bg-white/10 hover:bg-white/20'}">{etiqueta(v)}</button
        >
      {/each}
    </div>
    <button type="button" class="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-extrabold hover:bg-white/20 disabled:opacity-40" onclick={() => reproductor.verFinal()} disabled={reproductor.terminado}
      ><SkipForward class="h-3.5 w-3.5" /><span class="hidden sm:inline">Ver resultado</span><span class="sm:hidden">Final</span></button
    >
  </div>
</div>

<style>
  .boton {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    flex-shrink: 0;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.1);
  }
  .boton:hover {
    background: rgb(255 255 255 / 0.2);
  }
  .barra {
    appearance: none;
    background: transparent;
    height: 1.5rem;
    cursor: pointer;
  }
  .barra::-webkit-slider-runnable-track {
    background: transparent;
  }
  .barra::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #4f9bff;
  }
  .barra::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #4f9bff;
  }
  .barra::-moz-range-track {
    background: transparent;
  }
</style>
