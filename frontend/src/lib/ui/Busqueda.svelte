<script lang="ts">
  import type { Exploracion } from "$lib/api";
  import type { Reproductor } from "$lib/reproductor.svelte";
  import Controles from "./Controles.svelte";

  // Lo que flota sobre el mapa mientras se anima la búsqueda: el marcador arriba a la derecha,
  // la leyenda debajo de él y los controles de la animación abajo
  let {
    exploracion,
    progreso,
    total,
    distancia,
    tiempo,
    leyendaExtra,
    reproductor,
  }: {
    exploracion: Exploracion;
    progreso: { explorados: number; terminado: boolean };
    total: number;
    distancia: string;
    tiempo: string;
    leyendaExtra?: { color: string; texto: string; punteada?: boolean };
    reproductor: Reproductor;
  } = $props();
</script>

<div class="pointer-events-none absolute top-2 right-2 left-2 z-10 flex flex-col items-end gap-2 sm:top-3 sm:right-3 sm:left-auto">
  <dl class="cifra grid w-full grid-cols-4 gap-x-3 rounded-xl bg-[#0e1726]/90 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm sm:flex sm:w-auto sm:gap-x-6 sm:px-4 sm:py-2.5 sm:text-base">
    <div>
      <dt class="text-xs font-semibold text-white">Búsqueda</dt>
      <dd class="font-extrabold">{exploracion.algoritmo === "dijkstra" ? "Desde la salida" : "Dos lados"}</dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white"><span class="sm:hidden">Revisados</span><span class="hidden sm:inline">Lugares revisados</span></dt>
      <dd class="font-extrabold text-[#4f9bff]">{progreso.explorados}<span class="text-white">&nbsp;de {total}</span></dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white">Distancia</dt>
      <dd class="font-extrabold {progreso.terminado ? 'text-[#3ee07a]' : 'text-white'}">{progreso.terminado ? distancia : "…"}</dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white">Tiempo</dt>
      <dd class="font-extrabold {progreso.terminado ? 'text-[#3ee07a]' : 'text-white'}">{progreso.terminado ? tiempo : "…"}</dd>
    </div>
  </dl>
  <div class="hidden space-y-1 rounded-xl bg-[#0e1726]/90 px-3 py-2 text-xs font-semibold text-white sm:block">
    <p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#4f9bff] align-middle"></span>Caminos revisados desde la salida</p>
    {#if exploracion.algoritmo === "bidireccional"}<p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#3dd6f5] align-middle"></span>Caminos revisados desde la llegada</p>{/if}
    <p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#3ee07a] align-middle"></span>Ruta elegida</p>
    {#if leyendaExtra}
      <p>
        <span class="mr-2 inline-block w-5 align-middle {leyendaExtra.punteada ? 'border-t-4 border-dashed' : 'h-1.5 rounded'}" style={leyendaExtra.punteada ? `border-color:${leyendaExtra.color}` : `background:${leyendaExtra.color}`}></span>{leyendaExtra.texto}
      </p>
    {/if}
  </div>
</div>

<div class="absolute right-2 bottom-2 left-2 z-10 md:right-14 md:bottom-6 md:left-[436px] md:max-w-2xl">
  <Controles {reproductor} />
</div>
