<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { api, type Salud } from "$lib/api";

  let { children } = $props();

  const secciones = [
    { href: "/", texto: "Rutas", detalle: "La mejor ruta entre dos ciudades" },
    { href: "/camion-tren", texto: "Camión o tren", detalle: "Qué conviene según el peso" },
    { href: "/red", texto: "Red y cierres", detalle: "Qué se aísla si se cierra un punto" },
    { href: "/incidentes", texto: "Incidentes", detalle: "Reportes y envíos afectados" },
    { href: "/mantenimiento", texto: "Mantenimiento", detalle: "Revisar las tres bases" },
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
    { clave: "postgres", nombre: "PostgreSQL" },
    { clave: "mongo", nombre: "MongoDB" },
    { clave: "neo4j", nombre: "Neo4j" },
  ] as const;
</script>

<div class="flex min-h-full flex-col md:h-full md:flex-row">
  <aside class="flex shrink-0 flex-col bg-senal-500 text-white md:w-64">
    <a href="/" class="block px-5 pt-5 pb-4 outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-white">
      <span class="block text-2xl font-extrabold tracking-tight">Hopwright</span>
      <span class="block text-sm text-senal-100">Despacho de carga en Chiapas</span>
    </a>

    <nav aria-label="Secciones" class="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
      {#each secciones as s (s.href)}
        <a
          href={s.href}
          aria-current={activa(s.href) ? "page" : undefined}
          class="shrink-0 rounded-md px-3 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-white
            {activa(s.href) ? 'bg-white text-senal-700' : 'text-white hover:bg-senal-600'}"
        >
          <span class="block font-bold">{s.texto}</span>
          <span class="hidden text-xs md:block {activa(s.href) ? 'text-senal-500' : 'text-senal-100'}">{s.detalle}</span>
        </a>
      {/each}
    </nav>

    <section aria-label="Estado de las bases de datos" class="mt-auto hidden border-t border-senal-400 px-5 py-4 text-sm md:block">
      {#if sinApi}
        <p class="text-senal-50">No hay conexión con la API.</p>
      {:else if salud}
        <ul class="space-y-1">
          {#each bases as b (b.clave)}
            {@const estado = salud.bases[b.clave]}
            <li class="flex items-center justify-between gap-2" title={estado.detalle ?? ""}>
              <span class="flex items-center gap-2">
                <span class="inline-block h-2.5 w-2.5 rounded-full {estado.estado === 'ok' ? 'bg-white' : 'bg-preventivo'}"></span>
                {b.nombre}
              </span>
              <span class="cifra text-senal-100">{estado.estado === "ok" ? `${estado.ms} ms` : "sin respuesta"}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-senal-100">Revisando las bases…</p>
      {/if}
    </section>
  </aside>

  <main class="min-w-0 flex-1 md:h-full md:overflow-hidden">
    {#if sinApi || (salud && salud.estado !== "ok")}
      <div role="status" class="bg-preventivo px-4 py-2 text-sm font-semibold text-asfalto">
        {#if sinApi}
          La API no responde. Levanta el backend con npm run dev en la carpeta backend.
        {:else}
          Una base de datos no responde; algunas pantallas pueden fallar hasta que vuelva.
        {/if}
      </div>
    {/if}
    {@render children()}
  </main>
</div>
