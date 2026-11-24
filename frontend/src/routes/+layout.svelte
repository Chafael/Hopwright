<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Map as IconoMapa, RefreshCw, Route, Scale, TriangleAlert } from "@lucide/svelte";
  import { api, type Salud } from "$lib/api";

  let { children } = $props();

  const secciones = [
    { href: "/", texto: "Planear ruta", icono: Route },
    { href: "/camion-tren", texto: "Camión o tren", icono: Scale },
    { href: "/red", texto: "Mapa y cierres", icono: IconoMapa },
    { href: "/incidentes", texto: "Incidentes", icono: TriangleAlert },
    { href: "/mantenimiento", texto: "Sincronizar", icono: RefreshCw },
  ];

  const activa = (href: string) => (href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href));

  // Estado de las bases: se revisa al entrar y cada 20 segundos
  let salud = $state<Salud | null>(null);
  let sinApi = $state(false);
  async function revisar() {
    try {
      salud = await api.salud();
      sinApi = false;
    } catch {
      sinApi = true;
    }
  }
  onMount(() => {
    revisar();
    const t = setInterval(revisar, 20_000);
    return () => clearInterval(t);
  });

  const bases = [
    { clave: "postgres", nombre: "PostgreSQL", uso: "Envíos y flota" },
    { clave: "mongo", nombre: "MongoDB", uso: "Reportes" },
    { clave: "neo4j", nombre: "Neo4j", uso: "Red de carreteras" },
  ] as const;
</script>

<div class="flex min-h-full flex-col md:h-full md:flex-row">
  <aside class="flex shrink-0 flex-col bg-senal-500 text-white md:w-56">
    <a href="/" class="flex items-center gap-2.5 px-5 pt-5 pb-4 outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-white">
      <svg viewBox="0 0 32 32" class="h-9 w-9 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#fff" />
        <path d="M9 25 L14.5 7 M23 25 L17.5 7" stroke="#00674a" stroke-width="2.6" stroke-linecap="round" />
        <path d="M16 11v3M16 18v3" stroke="#f5b800" stroke-width="2.6" stroke-linecap="round" />
      </svg>
      <span>
        <span class="block text-xl leading-none font-extrabold tracking-tight">Hopwright</span>
        <span class="block text-xs font-semibold text-senal-100">Carga en Chiapas</span>
      </span>
    </a>

    <nav aria-label="Secciones" class="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
      {#each secciones as s (s.href)}
        <a
          href={s.href}
          aria-current={activa(s.href) ? "page" : undefined}
          class="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 font-bold outline-offset-2 focus-visible:outline-2 focus-visible:outline-white
            {activa(s.href) ? 'bg-white text-senal-700 shadow' : 'text-white hover:bg-senal-600'}"
        >
          <s.icono class="h-5 w-5" />
          {s.texto}
        </a>
      {/each}
    </nav>

    <section aria-label="Estado de las bases de datos" class="mt-auto hidden px-3 pb-4 md:block">
      <div class="rounded-xl bg-senal-700/60 p-3">
        <p class="mb-2 text-xs font-bold text-senal-100">Bases de datos</p>
        {#if sinApi}
          <p class="text-sm font-semibold">Sin conexión con la API</p>
        {:else if salud}
          <ul class="space-y-2">
            {#each bases as b (b.clave)}
              {@const estado = salud.bases[b.clave]}
              <li class="flex items-center gap-2" title={estado.detalle ?? `${b.nombre}: ${estado.ms} ms`}>
                <span class="h-2.5 w-2.5 shrink-0 rounded-full {estado.estado === 'ok' ? 'bg-[#3ee07a]' : 'bg-preventivo'}"></span>
                <span class="min-w-0 flex-1 leading-tight">
                  <span class="block text-sm font-bold">{b.nombre}</span>
                  <span class="block text-xs text-senal-100">{estado.estado === "ok" ? b.uso : "No responde"}</span>
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-sm">Revisando…</p>
        {/if}
      </div>
    </section>
  </aside>

  <main class="relative flex min-w-0 flex-1 flex-col md:h-full md:overflow-hidden">
    {#if sinApi || (salud && salud.estado !== "ok")}
      <div role="status" class="relative z-20 flex items-center gap-2 bg-preventivo px-4 py-2 text-sm font-bold text-asfalto">
        <TriangleAlert class="h-4 w-4" />
        {#if sinApi}
          La API no responde. Arranca el backend con npm run dev en la carpeta backend.
        {:else}
          Una base de datos no responde: algunas pantallas pueden fallar hasta que vuelva.
        {/if}
      </div>
    {/if}
    <div class="relative min-h-0 flex-1">{@render children()}</div>
  </main>
</div>
