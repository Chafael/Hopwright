<script lang="ts">
  import type { Exploracion } from "$lib/api";

  // Marcador sobre el mapa mientras se anima la búsqueda (arriba a la derecha) y la leyenda al terminar
  let {
    exploracion,
    progreso,
    total,
    distancia,
    tiempo,
    leyendaExtra,
  }: {
    exploracion: Exploracion;
    progreso: { explorados: number; terminado: boolean };
    total: number;
    distancia: string;
    tiempo: string;
    leyendaExtra?: { color: string; texto: string; punteada?: boolean };
  } = $props();
</script>

<div class="pointer-events-none absolute top-3 right-3 z-10">
  <dl class="cifra flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-[#0e1726]/90 px-4 py-2.5 text-white shadow-lg backdrop-blur-sm">
    <div>
      <dt class="text-xs font-semibold text-white/70">Búsqueda</dt>
      <dd class="font-extrabold">{exploracion.algoritmo === "dijkstra" ? "Desde la salida" : "Desde los dos lados"}</dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white/70">Lugares revisados</dt>
      <dd class="font-extrabold text-[#4f9bff]">{progreso.explorados}<span class="text-white/60">&nbsp;de {total}</span></dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white/70">Distancia</dt>
      <dd class="font-extrabold {progreso.terminado ? 'text-[#3ee07a]' : 'text-white/40'}">{progreso.terminado ? distancia : "…"}</dd>
    </div>
    <div>
      <dt class="text-xs font-semibold text-white/70">Tiempo</dt>
      <dd class="font-extrabold {progreso.terminado ? 'text-[#3ee07a]' : 'text-white/40'}">{progreso.terminado ? tiempo : "…"}</dd>
    </div>
  </dl>
</div>
{#if progreso.terminado}
  <div class="absolute right-14 bottom-6 z-10 space-y-1 rounded-xl bg-[#0e1726]/90 px-3 py-2 text-xs font-semibold text-white">
    <p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#4f9bff] align-middle"></span>Caminos revisados desde la salida</p>
    {#if exploracion.algoritmo === "bidireccional"}<p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#3dd6f5] align-middle"></span>Caminos revisados desde la llegada</p>{/if}
    <p><span class="mr-2 inline-block h-1.5 w-5 rounded bg-[#3ee07a] align-middle"></span>Ruta elegida</p>
    {#if leyendaExtra}
      <p>
        <span class="mr-2 inline-block w-5 align-middle {leyendaExtra.punteada ? 'border-t-4 border-dashed' : 'h-1.5 rounded'}" style={leyendaExtra.punteada ? `border-color:${leyendaExtra.color}` : `background:${leyendaExtra.color}`}></span>{leyendaExtra.texto}
      </p>
    {/if}
  </div>
{/if}
