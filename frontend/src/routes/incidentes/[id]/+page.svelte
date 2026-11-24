<script lang="ts">
  import { Alert, Button, Input, Label, Select, Textarea } from "flowbite-svelte";
  import { page } from "$app/state";
  import MapaRed from "$lib/MapaRed.svelte";
  import Gravedad from "$lib/Gravedad.svelte";
  import { camposPorTipo, valorLegible } from "$lib/camposIncidente";
  import { api, duracion, fecha, km, type EnviosAfectados, type Incidente, type Mapa } from "$lib/api";
  import { cargarRed, nombreDe, recargarRed } from "$lib/red.svelte";

  // Un incidente: su reporte completo (MongoDB), cerrarlo, agregar evidencias y la consulta C5
  const id = $derived(page.params.id ?? "");
  let incidente = $state<Incidente>();
  let mapa = $state<Mapa>();
  let error = $state("");
  // ?pendiente=1 llega desde el alta cuando la API respondió 202
  let aviso = $state(page.url.searchParams.get("pendiente") ? "El reporte se guardó en MongoDB, pero Neo4j no respondió: el cálculo de rutas todavía no lo toma en cuenta. Se copiará al reconciliar las bases." : "");

  let motivo = $state("");
  let cerrando = $state(false);

  let evTipo = $state<"Foto" | "Testimonio">("Testimonio");
  let evTexto = $state("");
  let evAutor = $state("");
  let errorEvidencia = $state("");

  let afectados = $state<EnviosAfectados>();
  let buscandoAfectados = $state(false);
  let seleccionado = $state(0);

  $effect(() => {
    const actual = id;
    incidente = undefined;
    afectados = undefined;
    error = "";
    api.incidente(actual).then((i) => (incidente = i)).catch((e) => (error = e.message));
  });
  $effect(() => {
    cargarRed().then((m) => (mapa = m)).catch(() => undefined);
  });

  async function cerrar(evento: SubmitEvent) {
    evento.preventDefault();
    cerrando = true;
    try {
      const r = await api.cerrarIncidente(id, motivo.trim() ? { motivoCierre: motivo.trim() } : {});
      incidente = r.incidente;
      aviso = r.status === 202 ? "El cierre se guardó en MongoDB, pero Neo4j no respondió: las rutas siguen rodeando el punto hasta reconciliar." : "";
      mapa = await recargarRed();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      cerrando = false;
    }
  }

  async function agregarEvidencia(evento: SubmitEvent) {
    evento.preventDefault();
    errorEvidencia = "";
    try {
      incidente = await api.agregarEvidencia(id, {
        tipo: evTipo,
        ...(evTipo === "Foto" ? { url: evTexto.trim() } : { texto: evTexto.trim() }),
        ...(evAutor.trim() ? { autor: evAutor.trim() } : {}),
      });
      evTexto = "";
    } catch (e) {
      errorEvidencia = (e as Error).message;
    }
  }

  async function buscarAfectados() {
    buscandoAfectados = true;
    try {
      afectados = await api.enviosAfectados(id);
      seleccionado = 0;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      buscandoAfectados = false;
    }
  }

  // Para el mapa, la ruta del envío elegido sin el incidente y su desvío (vienen como nombres de punto)
  const idsPorNombre = $derived(new Map(mapa?.puntos.map((p) => [p.nombre, p.idPunto]) ?? []));
  const envioVisto = $derived(afectados?.afectados[seleccionado]);
  const rutaDesvio = $derived(envioVisto?.desvio?.ruta.map((n) => idsPorNombre.get(n) ?? n) ?? []);
  const rutaOriginal = $derived(envioVisto?.rutaSinIncidente.ruta.map((n) => idsPorNombre.get(n) ?? n) ?? []);
</script>

<svelte:head><title>{id} · Hopwright</title></svelte:head>

<div class="grid h-full md:grid-cols-[480px_1fr]">
  <section class="overflow-y-auto border-r border-black/10 bg-white p-5">
    <a href="/incidentes" class="text-sm font-semibold text-senal-600 hover:underline">Volver a incidentes</a>

    {#if error}<Alert color="red" class="mt-3">{error}</Alert>{/if}
    {#if aviso}<Alert color="yellow" class="mt-3">{aviso}</Alert>{/if}

    {#if incidente}
      <header class="mt-3">
        <p class="cifra text-sm font-bold text-asfalto/60">{incidente.idIncidente}</p>
        <h1 class="text-2xl font-extrabold">{incidente.tipo} en {nombreDe(mapa, incidente.idPunto)}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <Gravedad gravedad={incidente.gravedad} />
          <span class={incidente.activo ? "font-semibold text-restrictivo" : "text-asfalto/60"}>{incidente.activo ? "Activo" : "Cerrado"}</span>
          <span class="text-asfalto/60">desde {fecha(incidente.fechaInicio)}</span>
          {#if !incidente.sincronizado}<span class="rounded bg-preventivo px-1.5 text-xs font-bold">Sin copiar a Neo4j</span>{/if}
        </div>
      </header>

      <p class="mt-4">{incidente.descripcion}</p>

      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-concreto p-4 text-sm">
        {#each Object.entries(incidente.detalle) as [clave, valor] (clave)}
          {@const campo = camposPorTipo[incidente.tipo]?.find((c) => c.nombre === clave)}
          <div>
            <dt class="text-asfalto/60">{campo?.etiqueta ?? clave}</dt>
            <dd class="font-semibold">{valorLegible(campo, valor)}</dd>
          </div>
        {/each}
        <div>
          <dt class="text-asfalto/60">Reportado por</dt>
          <dd class="font-semibold">{incidente.reportadoPor}</dd>
        </div>
        {#if incidente.fechaFin}
          <div>
            <dt class="text-asfalto/60">Cerrado</dt>
            <dd class="font-semibold">{fecha(incidente.fechaFin)}</dd>
          </div>
        {/if}
        {#if incidente.motivoCierre}
          <div class="col-span-2">
            <dt class="text-asfalto/60">Motivo del cierre</dt>
            <dd class="font-semibold">{incidente.motivoCierre}</dd>
          </div>
        {/if}
      </dl>

      {#if incidente.activo}
        <section class="mt-6 rounded-lg border-2 border-senal-500 p-4" aria-labelledby="afectados">
          <h2 id="afectados" class="font-bold">Envíos en camino que pasan por aquí</h2>
          <p class="mt-1 text-sm text-asfalto/70">Revisa en las tres bases qué envíos cruzan este punto y cuánto se tardan de más si lo rodean.</p>
          <Button class="mt-3" onclick={buscarAfectados} disabled={buscandoAfectados}>{buscandoAfectados ? "Revisando…" : "Revisar envíos"}</Button>

          {#if afectados}
            <div class="mt-3" aria-live="polite">
              {#each afectados.avisos as a, i (i)}<p class="text-sm text-asfalto/70">{a}</p>{/each}
              {#if afectados.afectados.length === 0}
                <p class="mt-2 font-semibold">Ninguno de los {afectados.revisados} envíos en camino pasa por este punto.</p>
              {:else}
                <ul class="mt-2 space-y-2">
                  {#each afectados.afectados as e, i (e.idEnvio)}
                    <li>
                      <button
                        type="button"
                        onclick={() => (seleccionado = i)}
                        aria-pressed={seleccionado === i}
                        class="w-full rounded-md border px-3 py-2 text-left {seleccionado === i ? 'border-senal-500 bg-senal-50' : 'border-black/10'}"
                      >
                        <span class="flex items-center justify-between gap-2">
                          <span class="font-bold">{e.idEnvio}{e.placa ? `, ${e.placa}` : ""}</span>
                          {#if e.prioridad === "Urgente"}<span class="rounded bg-restrictivo px-1.5 text-xs font-bold text-white">Urgente</span>{/if}
                        </span>
                        <span class="cifra block text-sm">
                          {#if e.minutosExtra === null}
                            No hay otra forma de llegar a {nombreDe(mapa, e.destino)}
                          {:else}
                            {e.minutosExtra === 0 ? "El desvío no agrega tiempo" : `${duracion(e.minutosExtra)} más`} rodeando, {km(e.desvio?.kilometros ?? 0)} en total
                          {/if}
                        </span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </section>

        <form class="mt-6 space-y-3 rounded-lg border border-black/10 p-4" onsubmit={cerrar}>
          <h2 class="font-bold">Cerrar el incidente</h2>
          <div>
            <Label for="motivo" class="mb-1">Motivo (opcional)</Label>
            <Input id="motivo" bind:value={motivo} placeholder="Se retiraron los manifestantes" />
          </div>
          <Button type="submit" color="alternative" disabled={cerrando}>{cerrando ? "Cerrando…" : "Cerrar incidente"}</Button>
        </form>
      {/if}

      <section class="mt-6" aria-labelledby="evidencias">
        <h2 id="evidencias" class="font-bold">Evidencias ({incidente.evidencias.length})</h2>
        <ol class="mt-2 space-y-3">
          {#each incidente.evidencias as e, i (i)}
            <li class="border-l-4 pl-3 {e.tipo === 'Foto' ? 'border-servicios' : 'border-preventivo'}">
              <p class="text-xs text-asfalto/60">{e.tipo}{e.autor ? `, ${e.autor}` : ""}, {fecha(e.fecha)}</p>
              {#if e.tipo === "Foto"}
                <p class="truncate text-sm">{e.url}</p>
              {:else}
                <p class="text-sm">{e.texto}</p>
              {/if}
            </li>
          {:else}
            <li class="text-sm text-asfalto/60">Todavía no hay evidencias.</li>
          {/each}
        </ol>

        <form class="mt-3 space-y-3 rounded-lg bg-concreto p-4" onsubmit={agregarEvidencia}>
          <div class="grid grid-cols-[140px_1fr] gap-2">
            <Select bind:value={evTipo} items={[{ value: "Testimonio", name: "Testimonio" }, { value: "Foto", name: "Foto (URL)" }]} aria-label="Tipo de evidencia" />
            <Input bind:value={evAutor} placeholder="Quién la aporta" aria-label="Autor" />
          </div>
          {#if evTipo === "Foto"}
            <Input bind:value={evTexto} type="url" required placeholder="https://..." aria-label="Dirección de la foto" />
          {:else}
            <Textarea bind:value={evTexto} rows={2} required minlength={2} class="w-full" placeholder="Lo que vio o le contaron" aria-label="Testimonio" />
          {/if}
          <Button type="submit" size="sm" color="alternative">Agregar evidencia</Button>
          {#if errorEvidencia}<Alert color="red">{errorEvidencia}</Alert>{/if}
        </form>
      </section>
    {:else if !error}
      <p class="mt-4 text-asfalto/60">Cargando…</p>
    {/if}
  </section>

  <section class="relative h-[60vh] md:h-full" aria-label="Mapa">
    {#if mapa}
      <MapaRed {mapa} cerrado={incidente?.activo && incidente.gravedad === "Alta" ? incidente.idPunto : null} ruta={rutaDesvio} rutaSecundaria={rutaOriginal} />
      {#if envioVisto}
        <div class="absolute bottom-6 left-4 z-[1000] rounded-md bg-white/95 px-3 py-2 text-sm shadow">
          <p><span class="mr-2 inline-block h-1.5 w-6 bg-senal-500 align-middle"></span>Desvío de {envioVisto.idEnvio}</p>
          <p><span class="mr-2 inline-block w-6 border-t-4 border-dashed border-[#5c6670] align-middle"></span>Ruta que llevaba</p>
        </div>
      {/if}
    {:else}
      <div class="grid h-full place-items-center text-asfalto/60">Cargando la red…</div>
    {/if}
  </section>
</div>
