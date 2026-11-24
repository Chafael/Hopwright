<script lang="ts">
  import { Button, Input, Select, Textarea } from "flowbite-svelte";
  import { ChevronRight, Plus, RefreshCw, TriangleAlert, X } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import MapaRed from "$lib/MapaRed.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import Gravedad from "$lib/Gravedad.svelte";
  import { camposPorTipo } from "$lib/camposIncidente";
  import { iconoTipo, significadoGravedad } from "$lib/iconosIncidente";
  import { api, fecha, type Gravedad as TipoGravedad, type Incidente, type Mapa, type TipoIncidente } from "$lib/api";
  import { cargarRed, nombreDe, opciones, recargarRed } from "$lib/red.svelte";

  // Lista de reportes (GET /incidentes) y alta de uno nuevo (POST /incidentes)
  let mapaRed = $state<Mapa>();
  let incidentes = $state<Incidente[]>([]);
  let cargando = $state(true);
  let error = $state("");
  let filtro = $state<"activos" | "todos" | "pendientes">("activos");

  let reportando = $state(false);
  let tipo = $state<TipoIncidente>("Bloqueo");
  let idPunto = $state("");
  let gravedad = $state<TipoGravedad>("Media");
  let descripcion = $state("");
  let reportadoPor = $state("");
  let detalle = $state<Record<string, string | number | boolean>>({});
  let enviando = $state(false);
  let errorAlta = $state<{ mensaje: string; detalles: string[] }>();

  const puntos = $derived(mapaRed ? opciones(mapaRed.puntos, ["Ciudad", "Interseccion"]) : []);
  const campos = $derived(camposPorTipo[tipo]);
  const tipos: TipoIncidente[] = ["Bloqueo", "Accidente", "Obra", "Derrumbe"];

  // Al cambiar el tipo se reinicia el detalle, con los sí/no en "no"
  $effect(() => {
    detalle = Object.fromEntries(camposPorTipo[tipo].filter((c) => c.tipo === "booleano").map((c) => [c.nombre, false]));
  });

  async function cargar() {
    cargando = true;
    error = "";
    try {
      incidentes = await api.incidentes(filtro === "activos" ? { activo: true } : filtro === "pendientes" ? { sincronizado: false } : {});
    } catch (e) {
      error = (e as Error).message;
    } finally {
      cargando = false;
    }
  }

  onMount(() => {
    cargarRed().then((m) => (mapaRed = m)).catch(() => undefined);
  });
  $effect(() => {
    void filtro;
    cargar();
  });

  // Tocar un lugar en el mapa lo pone como lugar del reporte
  function elegirLugar(p: { idPunto: string; tipo: string }) {
    if (reportando && p.tipo !== "Estacion") idPunto = p.idPunto;
  }

  async function reportar(evento: SubmitEvent) {
    evento.preventDefault();
    errorAlta = undefined;
    enviando = true;
    const detalleLimpio: Record<string, unknown> = {};
    for (const c of campos) {
      const v = detalle[c.nombre];
      if (v === undefined || v === "") continue;
      detalleLimpio[c.nombre] = c.tipo === "fecha" ? new Date(String(v)).toISOString() : v;
    }
    try {
      const r = await api.reportarIncidente({ tipo, idPunto, gravedad, descripcion, reportadoPor, detalle: detalleLimpio });
      await recargarRed();
      // 202: quedó en MongoDB pero todavía no en Neo4j; la pantalla del incidente lo explica
      goto(`/incidentes/${r.incidente.idIncidente}${r.status === 202 ? "?pendiente=1" : ""}`);
    } catch (e) {
      const err = e as { message: string; detalles?: unknown };
      errorAlta = { mensaje: err.message, detalles: Array.isArray(err.detalles) ? (err.detalles as string[]) : [] };
    } finally {
      enviando = false;
    }
  }

  const filtros = [
    { v: "activos", t: "Activos" },
    { v: "todos", t: "Todos" },
    { v: "pendientes", t: "Por sincronizar" },
  ] as const;
</script>

<svelte:head><title>Incidentes · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed mapa={mapaRed} margen={420} cerrado={reportando && idPunto ? idPunto : null} alElegirPunto={elegirLugar} />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">Cargando el mapa…</div>
    {/if}
  {/snippet}

  <div class="flex items-center justify-between gap-2">
    <h1 class="flex items-center gap-2 text-2xl font-extrabold"><TriangleAlert class="h-6 w-6 text-preventivo" />Incidentes</h1>
    <Button size="sm" color={reportando ? "alternative" : "primary"} class="gap-1.5" onclick={() => (reportando = !reportando)}>
      {#if reportando}<X class="h-4 w-4" />Cancelar{:else}<Plus class="h-4 w-4" />Reportar{/if}
    </Button>
  </div>

  {#if reportando}
    <form class="mt-4 space-y-4" onsubmit={reportar}>
      <fieldset>
        <legend class="mb-2 text-sm font-bold">¿Qué pasó?</legend>
        <div class="grid grid-cols-4 gap-2">
          {#each tipos as t (t)}
            {@const Icono = iconoTipo[t]}
            <label class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-black/10 py-2.5 text-xs font-bold hover:border-black/25 has-[:checked]:border-senal-500 has-[:checked]:bg-senal-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500">
              <input type="radio" name="tipo" value={t} bind:group={tipo} class="sr-only" />
              <Icono class="h-6 w-6" />{t}
            </label>
          {/each}
        </div>
      </fieldset>

      <div>
        <p class="mb-1 text-sm font-bold">¿Dónde? <span class="font-semibold text-asfalto">(o tócalo en el mapa)</span></p>
        <Select bind:value={idPunto} items={puntos} placeholder="Elige una ciudad o un cruce" required aria-label="Lugar" class="font-semibold" />
      </div>

      <fieldset>
        <legend class="mb-2 text-sm font-bold">¿Qué tan grave?</legend>
        <div class="grid grid-cols-3 gap-2">
          {#each ["Baja", "Media", "Alta"] as g (g)}
            <label class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-black/10 py-2.5 text-center hover:border-black/25 has-[:checked]:border-asfalto has-[:checked]:bg-concreto has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500">
              <input type="radio" name="gravedad" value={g} bind:group={gravedad} class="sr-only" />
              <Gravedad gravedad={g} />
              <span class="text-xs font-semibold">{significadoGravedad[g]}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="grid grid-cols-2 gap-3 rounded-xl bg-concreto p-3">
        {#each campos as c (tipo + c.nombre)}
          <div class={c.tipo === "texto" || c.tipo === "fecha" ? "col-span-2" : ""}>
            {#if c.tipo === "booleano"}
              <label class="flex h-full items-center gap-2 text-sm font-bold">
                <input type="checkbox" class="h-5 w-5 rounded border-black/30 text-senal-500 focus:ring-senal-500" bind:checked={detalle[c.nombre] as boolean} />
                {c.etiqueta}
              </label>
            {:else}
              <p class="mb-1 text-sm font-bold">{c.etiqueta}{c.obligatorio ? "" : " (si se sabe)"}</p>
              {#if c.tipo === "opcion"}
                <Select bind:value={detalle[c.nombre]} items={(c.opciones ?? []).map((o) => ({ value: o, name: o }))} placeholder="Elige una" required={c.obligatorio} aria-label={c.etiqueta} class="bg-white" />
              {:else}
                <Input
                  type={c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "datetime-local" : "text"}
                  min={c.minimo}
                  step={c.tipo === "numero" ? "any" : undefined}
                  required={c.obligatorio}
                  aria-label={c.etiqueta}
                  class="bg-white"
                  bind:value={detalle[c.nombre] as string | number}
                />
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      <div>
        <p class="mb-1 text-sm font-bold">Cuéntalo en una frase</p>
        <Textarea rows={2} minlength={5} required bind:value={descripcion} class="w-full" placeholder="Manifestación que cierra los dos sentidos" aria-label="Descripción" />
      </div>
      <div>
        <p class="mb-1 text-sm font-bold">¿Quién lo reporta?</p>
        <Input required minlength={2} bind:value={reportadoPor} placeholder="Despacho Tuxtla" aria-label="Quién lo reporta" />
      </div>
      <Button type="submit" size="lg" class="w-full gap-2" disabled={enviando || !idPunto}><TriangleAlert class="h-5 w-5" />{enviando ? "Guardando…" : "Guardar reporte"}</Button>
      {#if errorAlta}
        <Aviso tono="rojo">
          <p class="font-bold">{errorAlta.mensaje}</p>
          {#each errorAlta.detalles as d, i (i)}<p>{d}</p>{/each}
        </Aviso>
      {/if}
    </form>
  {:else}
    <div class="mt-4 flex gap-1 rounded-xl bg-concreto p-1 text-sm" role="radiogroup" aria-label="Qué incidentes mostrar">
      {#each filtros as f (f.v)}
        <label class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-center font-bold whitespace-nowrap has-[:checked]:bg-white has-[:checked]:shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500">
          <input type="radio" name="filtro" value={f.v} bind:group={filtro} class="sr-only" />
          {f.t}
        </label>
      {/each}
    </div>
    {#if filtro === "pendientes"}
      <p class="mt-2 flex items-start gap-2 text-xs font-semibold"><RefreshCw class="mt-0.5 h-3.5 w-3.5 shrink-0" />Reportes guardados que todavía no llegan al mapa de rutas porque Neo4j no respondió. Se arreglan en Sincronizar.</p>
    {/if}

    {#if error}<div class="mt-3"><Aviso tono="rojo">{error}</Aviso></div>{/if}

    {#if cargando}
      <p class="mt-4 font-semibold">Cargando…</p>
    {:else if incidentes.length === 0}
      <div class="mt-4"><Aviso tono="verde">{filtro === "pendientes" ? "Todo está sincronizado." : "No hay incidentes por ahora."}</Aviso></div>
    {:else}
      <ul class="mt-3 space-y-2">
        {#each incidentes as i (i.idIncidente)}
          {@const Icono = iconoTipo[i.tipo]}
          <li>
            <a
              href={`/incidentes/${i.idIncidente}`}
              class="flex items-center gap-3 rounded-xl border-2 p-3 hover:bg-concreto focus-visible:outline-2 focus-visible:outline-senal-500
                {i.activo && i.gravedad === 'Alta' ? 'border-restrictivo/40' : 'border-black/10'}"
            >
              <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl {i.activo ? (i.gravedad === 'Alta' ? 'bg-restrictivo text-white' : 'bg-preventivo text-asfalto') : 'bg-concreto text-asfalto'}">
                <Icono class="h-6 w-6" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-extrabold">{i.tipo} en {nombreDe(mapaRed, i.idPunto)}</span>
                <span class="flex flex-wrap items-center gap-x-2 text-sm">
                  <Gravedad gravedad={i.gravedad} />
                  <span class="font-semibold">{i.activo ? fecha(i.fechaInicio) : "Cerrado"}</span>
                  {#if !i.sincronizado}<span class="rounded bg-preventivo px-1.5 text-xs font-bold">Por sincronizar</span>{/if}
                </span>
              </span>
              <ChevronRight class="h-5 w-5 shrink-0" />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</VistaMapa>
