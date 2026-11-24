<script lang="ts">
  import { Button, Input, Textarea } from "flowbite-svelte";
  import { ArrowLeft, Camera, CircleCheck, Clock, MessageSquare, PackageSearch, RefreshCw, Truck } from "@lucide/svelte";
  import { page } from "$app/state";
  import MapaRed from "$lib/MapaRed.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import Gravedad from "$lib/Gravedad.svelte";
  import { camposPorTipo, valorLegible } from "$lib/camposIncidente";
  import { iconoTipo, significadoGravedad } from "$lib/iconosIncidente";
  import { api, duracion, fecha, km, type EnviosAfectados, type Incidente, type Mapa } from "$lib/api";
  import { cargarRed, nombreDe, recargarRed } from "$lib/red.svelte";

  // Un incidente: su reporte (MongoDB), a qué envíos afecta (C5), cerrarlo y agregar evidencias
  const id = $derived(page.params.id ?? "");
  let incidente = $state<Incidente>();
  let mapaRed = $state<Mapa>();
  let error = $state("");
  // ?pendiente=1 llega desde el alta cuando la API respondió 202
  let pendiente = $state(Boolean(page.url.searchParams.get("pendiente")));

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
    cargarRed().then((m) => (mapaRed = m)).catch(() => undefined);
  });

  async function cerrar(evento: SubmitEvent) {
    evento.preventDefault();
    cerrando = true;
    try {
      const r = await api.cerrarIncidente(id, motivo.trim() ? { motivoCierre: motivo.trim() } : {});
      incidente = r.incidente;
      pendiente = r.status === 202;
      mapaRed = await recargarRed();
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

  // En el mapa: la ruta que llevaba el envío elegido y su desvío (la API los manda como nombres)
  const idsPorNombre = $derived(new Map(mapaRed?.puntos.map((p) => [p.nombre, p.idPunto]) ?? []));
  const envioVisto = $derived(afectados?.afectados[seleccionado]);
  const rutaDesvio = $derived(envioVisto?.desvio?.ruta.map((n) => idsPorNombre.get(n) ?? n) ?? []);
  const rutaOriginal = $derived(envioVisto?.rutaSinIncidente.ruta.map((n) => idsPorNombre.get(n) ?? n) ?? []);
</script>

<svelte:head><title>{id} · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed
        mapa={mapaRed}
        margen={420}
        cerrado={incidente?.activo && incidente.gravedad === "Alta" ? incidente.idPunto : null}
        ruta={rutaDesvio}
        rutaSecundaria={rutaOriginal}
        colorSecundaria="#c8102e"
      />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">Cargando el mapa…</div>
    {/if}
  {/snippet}

  {#snippet encima()}
    {#if envioVisto}
      <div class="absolute right-14 bottom-6 z-10 space-y-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold shadow-lg">
        <p><span class="mr-2 inline-block w-6 border-t-4 border-dashed border-restrictivo align-middle"></span>Ruta que llevaba {envioVisto.idEnvio}</p>
        <p><span class="mr-2 inline-block h-1.5 w-6 rounded bg-senal-500 align-middle"></span>Desvío para rodear el incidente</p>
      </div>
    {/if}
  {/snippet}

  <a href="/incidentes" class="flex items-center gap-1 text-sm font-bold text-senal-600 hover:underline"><ArrowLeft class="h-4 w-4" />Incidentes</a>

  {#if error}<div class="mt-3"><Aviso tono="rojo">{error}</Aviso></div>{/if}
  {#if pendiente}
    <div class="mt-3">
      <Aviso tono="azul">
        <p class="font-bold">Guardado, pero falta sincronizar</p>
        <p>Neo4j no respondió, así que las rutas todavía no toman en cuenta este cambio. Se corrige en Sincronizar.</p>
      </Aviso>
    </div>
  {/if}

  {#if incidente}
    {@const Icono = iconoTipo[incidente.tipo]}
    <header class="mt-3 flex items-start gap-3">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl {incidente.activo ? (incidente.gravedad === 'Alta' ? 'bg-restrictivo text-white' : 'bg-preventivo text-asfalto') : 'bg-concreto'}">
        <Icono class="h-7 w-7" />
      </span>
      <div>
        <h1 class="text-2xl leading-tight font-extrabold">{incidente.tipo} en {nombreDe(mapaRed, incidente.idPunto)}</h1>
        <p class="mt-1 flex flex-wrap items-center gap-x-3 text-sm font-semibold">
          <Gravedad gravedad={incidente.gravedad} /><span>{significadoGravedad[incidente.gravedad]}</span>
        </p>
      </div>
    </header>

    <div class="mt-3 flex flex-wrap gap-2 text-sm font-bold">
      <span class="rounded-full px-2.5 py-0.5 {incidente.activo ? 'bg-[#fde8eb] text-restrictivo' : 'bg-senal-50 text-senal-700'}">{incidente.activo ? "Activo" : "Cerrado"}</span>
      <span class="flex items-center gap-1 rounded-full bg-concreto px-2.5 py-0.5"><Clock class="h-3.5 w-3.5" />Desde {fecha(incidente.fechaInicio)}</span>
      <span class="rounded-full bg-concreto px-2.5 py-0.5">{incidente.idIncidente}</span>
    </div>

    <p class="mt-3 text-[15px] font-semibold">{incidente.descripcion}</p>

    <dl class="mt-3 grid grid-cols-2 gap-2">
      {#each Object.entries(incidente.detalle) as [clave, valor] (clave)}
        {@const campo = camposPorTipo[incidente.tipo]?.find((c) => c.nombre === clave)}
        <div class="rounded-xl bg-concreto px-3 py-2">
          <dt class="text-xs font-semibold">{campo?.etiqueta ?? clave}</dt>
          <dd class="font-extrabold">{valorLegible(campo, valor)}</dd>
        </div>
      {/each}
      <div class="rounded-xl bg-concreto px-3 py-2">
        <dt class="text-xs font-semibold">Lo reportó</dt>
        <dd class="font-extrabold">{incidente.reportadoPor}</dd>
      </div>
      {#if incidente.motivoCierre}
        <div class="col-span-2 rounded-xl bg-senal-50 px-3 py-2">
          <dt class="text-xs font-semibold">Por qué se cerró</dt>
          <dd class="font-extrabold">{incidente.motivoCierre}</dd>
        </div>
      {/if}
    </dl>

    {#if incidente.activo}
      <section class="mt-5 rounded-xl border-2 border-senal-500 p-4" aria-labelledby="afectados">
        <h2 id="afectados" class="flex items-center gap-2 text-lg font-extrabold"><PackageSearch class="h-5 w-5 text-senal-600" />¿A quién afecta?</h2>
        <p class="mt-1 text-sm font-semibold">Revisa qué envíos en camino pasan por aquí y cuánto tardan de más si lo rodean.</p>
        <Button class="mt-3 w-full gap-2" onclick={buscarAfectados} disabled={buscandoAfectados}><Truck class="h-4 w-4" />{buscandoAfectados ? "Revisando…" : "Revisar envíos"}</Button>

        {#if afectados}
          <div class="mt-3 space-y-2" aria-live="polite">
            {#if afectados.afectados.length === 0}
              <Aviso tono="verde">Ninguno de los {afectados.revisados} envíos en camino pasa por este punto.</Aviso>
            {:else}
              {#each afectados.afectados as e, i (e.idEnvio)}
                <button
                  type="button"
                  onclick={() => (seleccionado = i)}
                  aria-pressed={seleccionado === i}
                  class="flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left {seleccionado === i ? 'border-senal-500 bg-senal-50' : 'border-black/10'}"
                >
                  <Truck class="h-6 w-6 shrink-0" />
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-x-2 font-extrabold">
                      <span class="whitespace-nowrap">Envío {e.idEnvio}</span>
                      {#if e.prioridad === "Urgente"}<span class="rounded bg-restrictivo px-1.5 text-xs text-white">Urgente</span>{/if}
                    </span>
                    {#if e.placa}<span class="block text-sm font-bold">Camión {e.placa}</span>{/if}
                    <span class="text-sm font-semibold">Va a {nombreDe(mapaRed, e.destino)}</span>
                  </span>
                  <span class="cifra shrink-0 text-right">
                    {#if e.minutosExtra === null}
                      <span class="block text-sm font-extrabold text-restrictivo">Sin otro camino</span>
                    {:else}
                      <span class="block text-lg leading-tight font-extrabold text-restrictivo">+{duracion(e.minutosExtra)}</span>
                      <span class="text-xs font-semibold">{km(e.desvio?.kilometros ?? 0)} rodeando</span>
                    {/if}
                  </span>
                </button>
              {/each}
            {/if}
            {#each afectados.avisos as a, i (i)}<p class="text-xs font-semibold">{a}</p>{/each}
          </div>
        {/if}
      </section>

      <form class="mt-4 space-y-3 rounded-xl border-2 border-black/10 p-4" onsubmit={cerrar}>
        <h2 class="flex items-center gap-2 text-lg font-extrabold"><CircleCheck class="h-5 w-5 text-senal-600" />¿Ya se resolvió?</h2>
        <Input bind:value={motivo} placeholder="Por qué se cierra (opcional)" aria-label="Motivo del cierre" />
        <Button type="submit" color="alternative" class="w-full" disabled={cerrando}>{cerrando ? "Cerrando…" : "Cerrar incidente"}</Button>
      </form>
    {/if}

    <section class="mt-5" aria-labelledby="evidencias">
      <h2 id="evidencias" class="text-lg font-extrabold">Evidencias ({incidente.evidencias.length})</h2>
      <ol class="mt-2 space-y-2">
        {#each incidente.evidencias as e, i (i)}
          <li class="flex gap-3 rounded-xl bg-concreto p-3">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg {e.tipo === 'Foto' ? 'bg-servicios' : 'bg-preventivo'} {e.tipo === 'Foto' ? 'text-white' : 'text-asfalto'}">
              {#if e.tipo === "Foto"}<Camera class="h-5 w-5" />{:else}<MessageSquare class="h-5 w-5" />{/if}
            </span>
            <div class="min-w-0">
              {#if e.tipo === "Foto"}
                <a href={e.url} target="_blank" rel="noopener" class="block truncate text-sm font-bold text-servicios underline">{e.url}</a>
              {:else}
                <p class="text-sm font-semibold">“{e.texto}”</p>
              {/if}
              <p class="text-xs font-semibold text-asfalto">{e.autor ?? "Sin autor"}, {fecha(e.fecha)}</p>
            </div>
          </li>
        {:else}
          <li class="text-sm font-semibold">Todavía no hay evidencias.</li>
        {/each}
      </ol>

      <form class="mt-3 space-y-2 rounded-xl border-2 border-dashed border-black/15 p-3" onsubmit={agregarEvidencia}>
        <div class="grid grid-cols-2 gap-2">
          {#each [{ v: "Testimonio", t: "Testimonio", i: MessageSquare }, { v: "Foto", t: "Foto", i: Camera }] as op (op.v)}
            <label class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-black/10 py-1.5 text-sm font-bold has-[:checked]:border-senal-500 has-[:checked]:bg-senal-50">
              <input type="radio" name="evidencia" value={op.v} bind:group={evTipo} class="sr-only" />
              <op.i class="h-4 w-4" />{op.t}
            </label>
          {/each}
        </div>
        {#if evTipo === "Foto"}
          <Input bind:value={evTexto} type="url" required placeholder="Enlace de la foto (https://…)" aria-label="Enlace de la foto" />
        {:else}
          <Textarea bind:value={evTexto} rows={2} required minlength={2} class="w-full" placeholder="Lo que vio o le contaron" aria-label="Testimonio" />
        {/if}
        <Input bind:value={evAutor} placeholder="¿Quién lo aporta?" aria-label="Quién lo aporta" />
        <Button type="submit" size="sm" color="alternative" class="w-full">Agregar evidencia</Button>
        {#if errorEvidencia}<Aviso tono="rojo">{errorEvidencia}</Aviso>{/if}
      </form>
    </section>
  {:else if !error}
    <p class="mt-4 flex items-center gap-2 font-semibold"><RefreshCw class="h-4 w-4 animate-spin" />Cargando…</p>
  {/if}
</VistaMapa>
