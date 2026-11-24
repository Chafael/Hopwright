<script lang="ts">
  import { Alert, Button, Input, Label, Select, Textarea } from "flowbite-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Gravedad from "$lib/Gravedad.svelte";
  import { camposPorTipo } from "$lib/camposIncidente";
  import { api, fecha, type Gravedad as TipoGravedad, type Incidente, type Mapa, type TipoIncidente } from "$lib/api";
  import { cargarRed, nombreDe, opciones, recargarRed } from "$lib/red.svelte";

  // Lista de reportes (GET /incidentes) y alta de uno nuevo (POST /incidentes)
  let mapa = $state<Mapa>();
  let incidentes = $state<Incidente[]>([]);
  let cargando = $state(true);
  let error = $state("");
  let filtro = $state<"activos" | "todos" | "pendientes">("activos");

  let formularioAbierto = $state(false);
  let tipo = $state<TipoIncidente>("Bloqueo");
  let idPunto = $state("");
  let gravedad = $state<TipoGravedad>("Media");
  let descripcion = $state("");
  let reportadoPor = $state("");
  let detalle = $state<Record<string, string | number | boolean>>({});
  let enviando = $state(false);
  let errorAlta = $state<{ mensaje: string; detalles: string[] }>();

  const puntos = $derived(mapa ? opciones(mapa.puntos, ["Ciudad", "Interseccion"]) : []);
  const campos = $derived(camposPorTipo[tipo]);

  // Al cambiar el tipo se reinicia el detalle, con los sí/no en false
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
    cargarRed().then((m) => (mapa = m)).catch(() => undefined);
  });
  $effect(() => {
    void filtro;
    cargar();
  });

  async function reportar(evento: SubmitEvent) {
    evento.preventDefault();
    errorAlta = undefined;
    enviando = true;
    // Solo se mandan los campos llenos; las fechas van en formato ISO
    const detalleLimpio: Record<string, unknown> = {};
    for (const c of campos) {
      const v = detalle[c.nombre];
      if (v === undefined || v === "") continue;
      detalleLimpio[c.nombre] = c.tipo === "fecha" ? new Date(String(v)).toISOString() : v;
    }
    try {
      const r = await api.reportarIncidente({ tipo, idPunto, gravedad, descripcion, reportadoPor, detalle: detalleLimpio });
      await recargarRed();
      // 202: quedó en MongoDB pero no llegó a Neo4j; la pantalla del incidente lo explica
      goto(`/incidentes/${r.incidente.idIncidente}${r.status === 202 ? "?pendiente=1" : ""}`);
    } catch (e) {
      const err = e as { message: string; detalles?: unknown };
      errorAlta = { mensaje: err.message, detalles: Array.isArray(err.detalles) ? (err.detalles as string[]) : [] };
    } finally {
      enviando = false;
    }
  }
</script>

<svelte:head><title>Incidentes · Hopwright</title></svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-5xl p-5">
    <header class="flex flex-wrap items-end gap-3">
      <div class="mr-auto">
        <h1 class="text-2xl font-extrabold">Incidentes</h1>
        <p class="mt-1 text-sm text-asfalto/70">Un incidente de gravedad Alta saca su punto del cálculo de rutas hasta que se cierre.</p>
      </div>
      <Button onclick={() => (formularioAbierto = !formularioAbierto)} aria-expanded={formularioAbierto}>
        {formularioAbierto ? "Cancelar reporte" : "Reportar incidente"}
      </Button>
    </header>

    {#if formularioAbierto}
      <form class="mt-5 grid gap-4 rounded-lg border-2 border-preventivo bg-white p-5 md:grid-cols-2" onsubmit={reportar}>
        <h2 class="text-lg font-extrabold md:col-span-2">Nuevo reporte</h2>
        <div>
          <Label for="tipo" class="mb-1">Tipo</Label>
          <Select id="tipo" bind:value={tipo} items={(["Bloqueo", "Accidente", "Obra", "Derrumbe"] as const).map((t) => ({ value: t, name: t }))} />
        </div>
        <div>
          <Label for="punto" class="mb-1">Dónde</Label>
          <Select id="punto" bind:value={idPunto} items={puntos} placeholder="Elige una ciudad o un cruce" required />
        </div>
        <fieldset class="md:col-span-2">
          <legend class="mb-1 text-sm font-medium">Gravedad</legend>
          <div class="flex flex-wrap gap-2">
            {#each ["Baja", "Media", "Alta"] as g (g)}
              <label class="flex cursor-pointer items-center gap-2 rounded-md border border-black/15 px-3 py-2 has-[:checked]:border-asfalto has-[:checked]:bg-concreto has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500">
                <input type="radio" name="gravedad" value={g} bind:group={gravedad} class="sr-only" />
                <Gravedad gravedad={g} />
              </label>
            {/each}
          </div>
          {#if gravedad === "Alta"}<p class="mt-1 text-sm text-restrictivo">Las rutas dejarán de pasar por este punto.</p>{/if}
        </fieldset>

        {#each campos as c (tipo + c.nombre)}
          <div>
            {#if c.tipo === "booleano"}
              <label class="flex h-full items-end gap-2 pb-2.5 text-sm font-medium">
                <input type="checkbox" class="h-4 w-4 rounded border-black/30 text-senal-500 focus:ring-senal-500" bind:checked={detalle[c.nombre] as boolean} />
                {c.etiqueta}
              </label>
            {:else}
              <Label for={c.nombre} class="mb-1">{c.etiqueta}{c.obligatorio ? "" : " (opcional)"}</Label>
              {#if c.tipo === "opcion"}
                <Select id={c.nombre} bind:value={detalle[c.nombre]} items={(c.opciones ?? []).map((o) => ({ value: o, name: o }))} placeholder="Elige una" required={c.obligatorio} />
              {:else}
                <Input
                  id={c.nombre}
                  type={c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "datetime-local" : "text"}
                  min={c.minimo}
                  step={c.tipo === "numero" ? "any" : undefined}
                  required={c.obligatorio}
                  bind:value={detalle[c.nombre] as string | number}
                />
              {/if}
            {/if}
          </div>
        {/each}

        <div class="md:col-span-2">
          <Label for="descripcion" class="mb-1">Qué pasa</Label>
          <Textarea id="descripcion" rows={3} minlength={5} required bind:value={descripcion} class="w-full" placeholder="Por ejemplo: manifestación que cierra los dos sentidos" />
        </div>
        <div>
          <Label for="quien" class="mb-1">Quién lo reporta</Label>
          <Input id="quien" required minlength={2} bind:value={reportadoPor} placeholder="Despacho Tuxtla" />
        </div>
        <div class="flex items-end">
          <Button type="submit" class="w-full" disabled={enviando || !idPunto}>{enviando ? "Guardando…" : "Guardar reporte"}</Button>
        </div>
        {#if errorAlta}
          <Alert color="red" class="md:col-span-2">
            <p class="font-bold">{errorAlta.mensaje}</p>
            {#each errorAlta.detalles as d, i (i)}<p>{d}</p>{/each}
          </Alert>
        {/if}
      </form>
    {/if}

    <div class="mt-6 flex gap-1 rounded-lg bg-white p-1 text-sm sm:w-fit" role="radiogroup" aria-label="Qué incidentes mostrar">
      {#each [{ v: "activos", t: "Activos" }, { v: "todos", t: "Todos" }, { v: "pendientes", t: "Sin copiar a Neo4j" }] as f (f.v)}
        <label class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center whitespace-nowrap has-[:checked]:bg-senal-500 has-[:checked]:font-bold has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-senal-500">
          <input type="radio" name="filtro" value={f.v} bind:group={filtro} class="sr-only" />
          {f.t}
        </label>
      {/each}
    </div>

    {#if error}<Alert color="red" class="mt-4">{error}</Alert>{/if}

    <div class="mt-3 overflow-hidden rounded-lg bg-white">
      {#if cargando}
        <p class="p-5 text-asfalto/60">Cargando…</p>
      {:else if incidentes.length === 0}
        <p class="p-5 text-asfalto/70">
          {filtro === "pendientes" ? "Todos los reportes ya están en Neo4j." : "No hay incidentes que mostrar."}
        </p>
      {:else}
        <ul class="divide-y divide-black/10">
          {#each incidentes as i (i.idIncidente)}
            <li>
              <a href={`/incidentes/${i.idIncidente}`} class="grid gap-x-4 gap-y-1 px-5 py-3 hover:bg-concreto focus-visible:bg-concreto focus-visible:outline-none sm:grid-cols-[110px_1fr_auto]">
                <span class="cifra font-bold">{i.idIncidente}</span>
                <span>
                  <span class="font-semibold">{i.tipo} en {nombreDe(mapa, i.idPunto)}</span>
                  <span class="block truncate text-sm text-asfalto/70">{i.descripcion}</span>
                </span>
                <span class="flex items-center gap-3 sm:justify-end">
                  <Gravedad gravedad={i.gravedad} />
                  <span class="text-sm whitespace-nowrap text-asfalto/60">{i.activo ? fecha(i.fechaInicio) : "Cerrado"}</span>
                  {#if !i.sincronizado}<span class="rounded bg-preventivo px-1.5 text-xs font-bold">Sin copiar</span>{/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>
