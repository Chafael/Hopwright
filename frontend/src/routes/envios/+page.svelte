<script lang="ts">
  import { Button } from "flowbite-svelte";
  import { ArrowRight, Package, Plus, RefreshCw } from "@lucide/svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import EstadoEnvio from "$lib/EstadoEnvio.svelte";
  import { api, fecha, type Ciudad, type Cliente, type Envio, type EstadoEnvio as Estado } from "$lib/api";
  import { sesion } from "$lib/sesion.svelte";

  // Lista de envíos (PostgreSQL) con filtro por estado
  const estados: Estado[] = ["Pendiente", "Asignado", "En camino", "Entregado", "Cancelado"];
  let filtro = $state<Estado | "">("");
  let envios = $state<Envio[]>();
  let ciudades = $state<Map<string, string>>(new Map());
  let clientes = $state<Map<number, string>>(new Map());
  let error = $state("");

  $effect(() => {
    const estado = filtro;
    envios = undefined;
    error = "";
    api.envios(estado || undefined).then((e) => (envios = e)).catch((e) => (error = e.message));
  });
  $effect(() => {
    api.ciudades().then((c: Ciudad[]) => (ciudades = new Map(c.map((x) => [x.idCiudad, x.nombre])))).catch(() => undefined);
    api.clientes().then((c: Cliente[]) => (clientes = new Map(c.map((x) => [x.idCliente, x.razonSocial])))).catch(() => undefined);
  });

  const ciudad = (id: string) => ciudades.get(id) ?? id;
  const peso = (kg: number) => `${kg.toLocaleString("es-MX", { maximumFractionDigits: 0 })} kg`;
</script>

<svelte:head><title>Envíos · Hopwright</title></svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-4xl p-5 md:p-8">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="flex flex-1 items-center gap-2 text-3xl font-extrabold"><Package class="h-7 w-7 text-senal-600" />Envíos</h1>
      {#if sesion.usuario}
        <Button href="/envios/nuevo" class="gap-2"><Plus class="h-4 w-4" />Nuevo envío</Button>
      {:else}
        <a href="/entrar?volver=/envios/nuevo" class="text-sm font-bold text-senal-600 hover:underline">Inicia sesión para registrar envíos</a>
      {/if}
    </div>
    <p class="mt-2 max-w-2xl text-[15px] font-semibold">
      Cada envío vive en PostgreSQL. Su manifiesto de carga está en MongoDB y su ruta se calcula en Neo4j.
    </p>

    <div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      {#each [{ v: "", t: "Todos" }, ...estados.map((e) => ({ v: e, t: e }))] as op (op.v)}
        <button
          type="button"
          aria-pressed={filtro === op.v}
          onclick={() => (filtro = op.v as Estado | "")}
          class="rounded-full border-2 px-3 py-1 text-sm font-bold {filtro === op.v ? 'border-senal-500 bg-senal-500 text-white' : 'border-black/10 bg-white hover:border-senal-300'}"
        >
          {op.t}
        </button>
      {/each}
    </div>

    {#if error}<div class="mt-4"><Aviso tono="rojo">{error}</Aviso></div>{/if}

    {#if envios}
      <ul class="mt-4 space-y-2">
        {#each envios as e (e.idEnvio)}
          <li>
            <a
              href="/envios/{e.idEnvio}"
              class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 hover:ring-senal-300 focus-visible:outline-2 focus-visible:outline-senal-500"
            >
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="text-lg font-extrabold">{e.idEnvio}</span>
                  <EstadoEnvio estado={e.estado} />
                  {#if e.prioridad === "Urgente"}<span class="rounded bg-restrictivo px-1.5 text-xs font-bold text-white">Urgente</span>{/if}
                </span>
                <span class="mt-0.5 block font-bold">{ciudad(e.idCiudadOrigen)} <ArrowRight class="inline h-4 w-4" /> {ciudad(e.idCiudadDestino)}</span>
                <span class="block text-sm font-semibold text-asfalto/80">{clientes.get(e.idCliente) ?? `Cliente ${e.idCliente}`}, {fecha(e.creadoEn)}</span>
              </span>
              <span class="cifra shrink-0 text-right text-lg font-extrabold">{peso(e.pesoKg)}</span>
            </a>
          </li>
        {:else}
          <li class="rounded-xl bg-white p-6 text-center font-semibold">
            {filtro ? `No hay envíos en estado ${filtro.toLowerCase()}.` : "Todavía no hay envíos."}
          </li>
        {/each}
      </ul>
    {:else if !error}
      <p class="mt-4 flex items-center gap-2 font-semibold"><RefreshCw class="h-4 w-4 animate-spin" />Cargando…</p>
    {/if}
  </div>
</div>
