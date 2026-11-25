<script lang="ts">
  import { Button, Input, Label, Select } from "flowbite-svelte";
  import { ArrowLeft, PackagePlus } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import Aviso from "$lib/ui/Aviso.svelte";
  import { api, type Ciudad, type Cliente } from "$lib/api";
  import { sesion } from "$lib/sesion.svelte";

  // Alta de un envío (POST /envios, PostgreSQL). El manifiesto se captura después, en la página del envío.
  let clientes = $state<Cliente[]>([]);
  let ciudades = $state<Ciudad[]>([]);
  let idEnvio = $state("");
  let idCliente = $state("");
  let origen = $state("");
  let destino = $state("");
  let pesoKg = $state<number>();
  let prioridad = $state<"Normal" | "Urgente">("Normal");
  let error = $state("");
  let guardando = $state(false);

  $effect(() => {
    api.clientes().then((c) => (clientes = c)).catch((e) => (error = e.message));
    api.ciudades().then((c) => (ciudades = [...c].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")))).catch((e) => (error = e.message));
    // Propone el siguiente número libre: E- y el mayor número usado más uno
    api
      .envios()
      .then((lista) => {
        const mayor = Math.max(100, ...lista.map((e) => Number(e.idEnvio.slice(2))).filter((n) => Number.isFinite(n)));
        if (!idEnvio) idEnvio = `E-${mayor + 1}`;
      })
      .catch(() => undefined);
  });

  const opcionesCiudad = $derived(ciudades.map((c) => ({ value: c.idCiudad, name: c.nombre })));

  async function guardar(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    if (origen === destino) {
      error = "El origen y el destino deben ser ciudades distintas.";
      return;
    }
    guardando = true;
    try {
      const envio = await api.registrarEnvio({
        idEnvio: idEnvio.trim().toUpperCase(),
        idCliente: Number(idCliente),
        idCiudadOrigen: origen,
        idCiudadDestino: destino,
        pesoKg: Number(pesoKg),
        prioridad,
      });
      await goto(`/envios/${envio.idEnvio}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      guardando = false;
    }
  }
</script>

<svelte:head><title>Nuevo envío · Hopwright</title></svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-xl p-5 md:p-8">
    <a href="/envios" class="flex items-center gap-1 text-sm font-bold text-senal-600 hover:underline"><ArrowLeft class="h-4 w-4" />Envíos</a>
    <h1 class="mt-2 flex items-center gap-2 text-3xl font-extrabold"><PackagePlus class="h-7 w-7 text-senal-600" />Nuevo envío</h1>

    {#if !sesion.usuario}
      <div class="mt-4">
        <Aviso tono="azul">Para registrar un envío necesitas <a href="/entrar?volver=/envios/nuevo" class="font-bold underline">iniciar sesión</a>.</Aviso>
      </div>
    {:else}
      <form class="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" onsubmit={guardar}>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label for="id" class="mb-1 font-bold">Número de envío</Label>
            <Input id="id" bind:value={idEnvio} required pattern="[Ee]-[0-9]+" title="E- seguido de números, por ejemplo E-120" />
          </div>
          <div>
            <Label for="prioridad" class="mb-1 font-bold">Prioridad</Label>
            <Select id="prioridad" bind:value={prioridad} items={[{ value: "Normal", name: "Normal" }, { value: "Urgente", name: "Urgente" }]} />
          </div>
        </div>
        <div>
          <Label for="cliente" class="mb-1 font-bold">Cliente</Label>
          <Select id="cliente" bind:value={idCliente} required placeholder="Elige el cliente" items={clientes.map((c) => ({ value: String(c.idCliente), name: c.razonSocial }))} />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label for="origen" class="mb-1 font-bold">Sale de</Label>
            <Select id="origen" bind:value={origen} required placeholder="Ciudad" items={opcionesCiudad} />
          </div>
          <div>
            <Label for="destino" class="mb-1 font-bold">Va a</Label>
            <Select id="destino" bind:value={destino} required placeholder="Ciudad" items={opcionesCiudad} />
          </div>
        </div>
        <div>
          <Label for="peso" class="mb-1 font-bold">Peso total de la carga (kg)</Label>
          <Input id="peso" type="number" bind:value={pesoKg} required min="1" step="any" />
          <p class="mt-1 text-xs font-semibold">Con el peso se eligen los camiones que pueden llevarla.</p>
        </div>
        {#if error}<Aviso tono="rojo">{error}</Aviso>{/if}
        <Button type="submit" class="w-full" disabled={guardando}>{guardando ? "Guardando…" : "Registrar envío"}</Button>
      </form>
    {/if}
  </div>
</div>
