<script lang="ts">
  import { Button, Input, Label } from "flowbite-svelte";
  import { LogIn } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Aviso from "$lib/ui/Aviso.svelte";
  import { iniciarSesion } from "$lib/sesion.svelte";

  // POST /auth/login: PostgreSQL revisa la contraseña (bcrypt) y la API regresa un token con el rol
  let correo = $state("");
  let password = $state("");
  let error = $state("");
  let entrando = $state(false);

  // Solo se regresa a rutas internas de la app
  const volver = $derived.by(() => {
    const v = page.url.searchParams.get("volver") ?? "";
    return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/entrar") ? v : "/envios";
  });

  async function entrar(evento: SubmitEvent) {
    evento.preventDefault();
    error = "";
    entrando = true;
    try {
      await iniciarSesion(correo.trim(), password);
      await goto(volver);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      entrando = false;
    }
  }
</script>

<svelte:head><title>Iniciar sesión · Hopwright</title></svelte:head>

<div class="grid h-full place-items-center overflow-y-auto bg-concreto p-5">
  <form class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5" onsubmit={entrar}>
    <h1 class="flex items-center gap-2 text-2xl font-extrabold"><LogIn class="h-6 w-6 text-senal-600" />Iniciar sesión</h1>
    <p class="text-sm font-semibold">Para registrar envíos, asignar camiones o reportar incidentes. Las consultas no piden sesión.</p>
    <div>
      <Label for="correo" class="mb-1 font-bold">Correo</Label>
      <Input id="correo" type="email" bind:value={correo} required autocomplete="username" placeholder="despacho@hopwright.local" />
    </div>
    <div>
      <Label for="password" class="mb-1 font-bold">Contraseña</Label>
      <Input id="password" type="password" bind:value={password} required autocomplete="current-password" />
    </div>
    {#if error}<Aviso tono="rojo">{error}</Aviso>{/if}
    <Button type="submit" class="w-full gap-2" disabled={entrando}><LogIn class="h-4 w-4" />{entrando ? "Entrando…" : "Entrar"}</Button>
    <p class="rounded-lg bg-concreto px-3 py-2 text-xs font-semibold">
      Usuarios de prueba (contraseña <code>hopwright123</code>): <code>despacho@hopwright.local</code> (despachador) y
      <code>admin@hopwright.local</code> (administrador).
    </p>
  </form>
</div>
