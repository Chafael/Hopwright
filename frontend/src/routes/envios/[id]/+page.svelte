<script lang="ts">
  import { Button, Input, Label, Select } from "flowbite-svelte";
  import { ArrowLeft, ArrowRight, Ban, CircleCheck, ClipboardList, Flag, PackageCheck, Plus, RefreshCw, Route, Trash2, Truck } from "@lucide/svelte";
  import { page } from "$app/state";
  import MapaRed from "$lib/MapaRed.svelte";
  import VistaMapa from "$lib/ui/VistaMapa.svelte";
  import Aviso from "$lib/ui/Aviso.svelte";
  import EstadoEnvio from "$lib/EstadoEnvio.svelte";
  import {
    api,
    duracion,
    ErrorApi,
    fecha,
    km,
    pesos,
    type Articulo,
    type Bitacora,
    type Criterio,
    type Envio,
    type Manifiesto,
    type Mapa,
    type RutaEnvio,
    type TipoCarga,
    type Vehiculo,
  } from "$lib/api";
  import { cargarRed, nombreDe, recargarRed } from "$lib/red.svelte";
  import { sesion } from "$lib/sesion.svelte";

  // Un envío de punta a punta: sus datos (PostgreSQL), su manifiesto y bitácora (MongoDB),
  // su ruta con las restricciones de la carga (las tres bases) y los cambios de estado.
  const id = $derived(page.params.id ?? "");
  let envio = $state<Envio>();
  let manifiesto = $state<Manifiesto | null>();
  let bitacora = $state<Bitacora>();
  let ruta = $state<RutaEnvio>();
  let vehiculos = $state<Vehiculo[]>([]);
  let mapaRed = $state<Mapa>();
  let cliente = $state("");
  let error = $state("");
  let errorAccion = $state("");
  let ocupado = $state(false);
  let criterio = $state<Criterio>("tiempo");
  let calculando = $state(false);
  let placa = $state("");

  async function cargarManifiesto(actual: string) {
    try {
      manifiesto = await api.manifiesto(actual);
    } catch (e) {
      // 404: el envío todavía no tiene manifiesto
      if (e instanceof ErrorApi && e.status === 404) manifiesto = null;
      else throw e;
    }
  }

  $effect(() => {
    const actual = id;
    envio = undefined;
    manifiesto = undefined;
    bitacora = undefined;
    ruta = undefined;
    error = "";
    api
      .envio(actual)
      .then(async (e) => {
        envio = e;
        api.clientes().then((c) => (cliente = c.find((x) => x.idCliente === e.idCliente)?.razonSocial ?? "")).catch(() => undefined);
        await cargarManifiesto(actual);
      })
      .catch((e) => (error = e.message));
    api.bitacora(actual).then((b) => (bitacora = b)).catch(() => undefined);
  });
  $effect(() => {
    cargarRed().then((m) => (mapaRed = m)).catch(() => undefined);
    api.vehiculos().then((v) => (vehiculos = v)).catch(() => undefined);
  });

  // La ruta se pide cuando ya se sabe si hay manifiesto (cambia las restricciones) y cada vez que cambia el criterio
  $effect(() => {
    if (envio && manifiesto !== undefined) calcular(criterio);
  });

  async function calcular(c: Criterio) {
    calculando = true;
    try {
      ruta = await api.rutaEnvio(id, c);
      if (!placa || !ruta.candidatos.includes(placa)) placa = ruta.vehiculoSugerido?.placa ?? ruta.candidatos[0] ?? "";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      calculando = false;
    }
  }

  // Después de cambiar de estado: el envío y la ruta se recargan; la bitácora y la ubicación del camión
  // las escribe el procesador de eventos unos segundos después, por eso se vuelven a pedir con retraso.
  async function accion(hacer: () => Promise<unknown>) {
    ocupado = true;
    errorAccion = "";
    try {
      await hacer();
      envio = await api.envio(id);
      vehiculos = await api.vehiculos();
      await calcular(criterio);
      setTimeout(async () => {
        bitacora = await api.bitacora(id).catch(() => bitacora);
        mapaRed = await recargarRed().catch(() => mapaRed);
      }, 6000);
    } catch (e) {
      errorAccion = (e as Error).message;
    } finally {
      ocupado = false;
    }
  }

  // ---------- Manifiesto ----------
  let tipoCarga = $state<TipoCarga>("general");
  let articulos = $state<Articulo[]>([{ descripcion: "", cantidad: 1, pesoKg: 1 }]);
  let evitarTerraceria = $state(false);
  let tiempoMaxGeneral = $state<number>();
  let tempMinC = $state<number>(2);
  let tempMaxC = $state<number>(8);
  let tiempoMaxMin = $state<number>(240);
  let claseUN = $state<number>(3);
  let numeroONU = $state("");
  let hojaSeguridad = $state("");
  let telefonoEmergencia = $state("");
  let errorManifiesto = $state("");

  const pesoArticulos = $derived(articulos.reduce((s, a) => s + (Number(a.cantidad) || 0) * (Number(a.pesoKg) || 0), 0));

  async function guardarManifiesto(evento: SubmitEvent) {
    evento.preventDefault();
    errorManifiesto = "";
    const cuerpo: Record<string, unknown> = {
      tipoCarga,
      articulos: articulos.map((a) => ({ descripcion: a.descripcion.trim(), cantidad: Number(a.cantidad), pesoKg: Number(a.pesoKg) })),
    };
    if (tipoCarga === "general") cuerpo.restriccionesRuta = { evitarTerraceria, tiempoMaxMin: tiempoMaxGeneral ? Number(tiempoMaxGeneral) : null };
    if (tipoCarga === "refrigerada") Object.assign(cuerpo, { tempMinC: Number(tempMinC), tempMaxC: Number(tempMaxC), tiempoMaxMin: Number(tiempoMaxMin) });
    if (tipoCarga === "peligrosa") Object.assign(cuerpo, { claseUN: Number(claseUN), numeroONU: numeroONU.trim(), hojaSeguridad: hojaSeguridad.trim(), telefonoEmergencia: telefonoEmergencia.trim() });
    try {
      manifiesto = await api.guardarManifiesto(id, cuerpo);
    } catch (e) {
      errorManifiesto = (e as Error).message;
    }
  }

  const tiposCarga: { v: TipoCarga; t: string; nota: string }[] = [
    { v: "general", t: "General", nota: "Sin cuidados especiales" },
    { v: "refrigerada", t: "Refrigerada", nota: "Tiene tiempo máximo de viaje" },
    { v: "peligrosa", t: "Peligrosa", nota: "No puede ir por terracería" },
  ];

  // ---------- Textos ----------
  const ciudad = (idCiudad: string) => nombreDe(mapaRed, idCiudad);
  const kg = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} kg`;
  const vehiculo = (p: string) => vehiculos.find((v) => v.placa === p);
  const textoEvento: Record<string, (d: Record<string, unknown>) => string> = {
    ASIGNACION_CREADA: (d) => `Se asignó el vehículo ${d.placa ?? ""}`,
    ENVIO_SALIO: () => "Salió a carretera",
    ENVIO_ENTREGADO: (d) => (d.moverA ? `Se entregó; el vehículo ${d.placa} quedó en ${ciudad(String(d.moverA))}` : "Se entregó"),
    ENVIO_CANCELADO: () => "Se canceló",
  };
  const puedeEditar = $derived(Boolean(sesion.usuario) && envio !== undefined && (envio.estado === "Pendiente" || envio.estado === "Asignado"));
</script>

<svelte:head><title>{id} · Hopwright</title></svelte:head>

<VistaMapa>
  {#snippet mapa()}
    {#if mapaRed}
      <MapaRed mapa={mapaRed} margen={420} ruta={ruta?.encontrada ? ruta.ruta.map((p) => p.idPunto) : []} mostrarVehiculos />
    {:else}
      <div class="grid h-full place-items-center bg-[#e4e8e2] font-semibold">Cargando el mapa…</div>
    {/if}
  {/snippet}

  <a href="/envios" class="flex items-center gap-1 text-sm font-bold text-senal-600 hover:underline"><ArrowLeft class="h-4 w-4" />Envíos</a>
  {#if error}<div class="mt-3"><Aviso tono="rojo">{error}</Aviso></div>{/if}

  {#if envio}
    <header class="mt-3">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-2xl leading-tight font-extrabold">Envío {envio.idEnvio}</h1>
        <EstadoEnvio estado={envio.estado} />
        {#if envio.prioridad === "Urgente"}<span class="rounded bg-restrictivo px-1.5 text-xs font-bold text-white">Urgente</span>{/if}
      </div>
      <p class="mt-1 text-lg font-bold">{ciudad(envio.idCiudadOrigen)} <ArrowRight class="inline h-4 w-4" /> {ciudad(envio.idCiudadDestino)}</p>
      <p class="text-sm font-semibold">{cliente || `Cliente ${envio.idCliente}`}, {kg(envio.pesoKg)}, registrado {fecha(envio.creadoEn)}</p>
    </header>

    <!-- Ruta: lo que aporta cada base -->
    <section class="mt-5 rounded-xl border-2 border-senal-500 p-4" aria-labelledby="ruta">
      <h2 id="ruta" class="flex items-center gap-2 text-lg font-extrabold"><Route class="h-5 w-5 text-senal-600" />Ruta del envío</h2>
      <div class="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Qué conviene más">
        {#each [{ v: "tiempo", t: "Más rápida" }, { v: "distancia", t: "Más corta" }, { v: "costo", t: "Menos casetas" }] as op (op.v)}
          <button
            type="button"
            aria-pressed={criterio === op.v}
            onclick={() => (criterio = op.v as Criterio)}
            class="rounded-lg border-2 px-2 py-1.5 text-sm font-bold {criterio === op.v ? 'border-senal-500 bg-senal-50' : 'border-black/10'}"
          >
            {op.t}
          </button>
        {/each}
      </div>

      {#if ruta}
        <div class="mt-3 space-y-3" aria-live="polite" aria-busy={calculando}>
          {#if ruta.encontrada}
            <div class="grid grid-cols-3 gap-2">
              {#each [{ e: "Tiempo", v: duracion(ruta.minutos) }, { e: "Distancia", v: km(ruta.kilometros) }, { e: "Casetas", v: pesos(ruta.costoCasetas) }] as d (d.e)}
                <div class="rounded-xl bg-concreto px-2.5 py-2">
                  <p class="cifra text-[15px] leading-tight font-extrabold whitespace-nowrap">{d.v}</p>
                  <p class="text-xs font-semibold">{d.e}</p>
                </div>
              {/each}
            </div>
            <p class="text-sm font-semibold">Pasa por {ruta.ruta.slice(1, -1).map((p) => p.nombre).join(", ") || "ningún punto intermedio"}.</p>
          {:else}
            <Aviso tono="rojo">No hay una ruta que cumpla lo que pide la carga.</Aviso>
          {/if}

          <div class="flex flex-wrap gap-1.5 text-xs font-bold">
            {#if ruta.restricciones.evitarTerraceria}<span class="rounded-full bg-[#fff3c4] px-2 py-0.5 text-[#7a5a00]">Sin terracería</span>{/if}
            {#if ruta.restricciones.tiempoMaxMin}<span class="rounded-full bg-[#e7f0fb] px-2 py-0.5 text-servicios">Máximo {duracion(ruta.restricciones.tiempoMaxMin)}</span>{/if}
            {#if !ruta.restricciones.evitarTerraceria && !ruta.restricciones.tiempoMaxMin}<span class="rounded-full bg-concreto px-2 py-0.5">Sin restricciones de carga</span>{/if}
          </div>

          {#if ruta.vehiculoSugerido}
            {@const v = vehiculo(ruta.vehiculoSugerido.placa)}
            <div class="flex items-center gap-3 rounded-xl bg-senal-50 p-3">
              <Truck class="h-6 w-6 shrink-0 text-senal-600" />
              <p class="text-sm font-semibold">
                <span class="block font-extrabold">Conviene el {v?.tipo.toLowerCase() ?? "vehículo"} {ruta.vehiculoSugerido.placa}</span>
                {ruta.vehiculoSugerido.minutosAlOrigen === 0 ? `Ya está en ${ciudad(ruta.origen)}` : `Llega a ${ciudad(ruta.origen)} en ${duracion(ruta.vehiculoSugerido.minutosAlOrigen)}`}{v ? `; carga hasta ${kg(v.capacidadKg)}` : ""}.
              </p>
            </div>
          {/if}

          {#each ruta.avisos as a, i (i)}<Aviso tono="amarillo">{a}</Aviso>{/each}

          <details class="rounded-lg bg-concreto px-3 py-2 text-xs font-semibold">
            <summary class="cursor-pointer font-bold">De dónde sale cada dato</summary>
            <ul class="mt-1 space-y-0.5">
              <li><span class="font-extrabold">PostgreSQL:</span> {ruta.fuentes.postgresql}</li>
              <li><span class="font-extrabold">MongoDB:</span> {ruta.fuentes.mongodb}</li>
              <li><span class="font-extrabold">Neo4j:</span> {ruta.fuentes.neo4j}</li>
            </ul>
          </details>
        </div>
      {:else}
        <p class="mt-3 flex items-center gap-2 text-sm font-semibold"><RefreshCw class="h-4 w-4 animate-spin" />Calculando…</p>
      {/if}
    </section>

    <!-- Estado y vehículo -->
    <section class="mt-4 rounded-xl border-2 border-black/10 p-4" aria-labelledby="vehiculo">
      <h2 id="vehiculo" class="flex items-center gap-2 text-lg font-extrabold"><Truck class="h-5 w-5 text-senal-600" />Vehículo y entrega</h2>
      {#if !sesion.usuario && (envio.estado !== "Entregado" && envio.estado !== "Cancelado")}
        <p class="mt-2 text-sm font-semibold">Para asignar un vehículo o cambiar el estado, <a href="/entrar?volver=/envios/{id}" class="font-bold text-senal-600 underline">inicia sesión</a>.</p>
      {:else if envio.estado === "Pendiente"}
        {#if ruta && ruta.candidatos.length > 0}
          <Label for="placa" class="mt-2 mb-1 font-bold">Vehículos disponibles que aguantan {kg(envio.pesoKg)}</Label>
          <Select
            id="placa"
            bind:value={placa}
            items={ruta.candidatos.map((p) => {
              const v = vehiculo(p);
              return { value: p, name: `${p}${v ? `, ${v.tipo.toLowerCase()} de ${kg(v.capacidadKg)}` : ""}${p === ruta?.vehiculoSugerido?.placa ? " (sugerido)" : ""}` };
            })}
          />
          <Button class="mt-2 w-full gap-2" disabled={ocupado || !placa} onclick={() => accion(() => api.asignar(id, placa))}><Truck class="h-4 w-4" />Asignar vehículo</Button>
        {:else if ruta}
          <p class="mt-2 text-sm font-semibold">Ahora no hay vehículos disponibles que aguanten esta carga.</p>
        {/if}
      {:else if envio.estado === "Asignado"}
        <p class="mt-2 text-sm font-semibold">Tiene vehículo asignado. Cuando salga a carretera, regístralo.</p>
        <Button class="mt-2 w-full gap-2" disabled={ocupado} onclick={() => accion(() => api.cambiarEstado(id, "salida"))}><Flag class="h-4 w-4" />Registrar salida</Button>
      {:else if envio.estado === "En camino"}
        <p class="mt-2 text-sm font-semibold">Salió {envio.fechaSalida ? fecha(envio.fechaSalida) : ""}. Al entregarlo, el vehículo queda libre en {ciudad(envio.idCiudadDestino)}.</p>
        <Button class="mt-2 w-full gap-2" disabled={ocupado} onclick={() => accion(() => api.cambiarEstado(id, "entrega"))}><PackageCheck class="h-4 w-4" />Registrar entrega</Button>
      {:else if envio.estado === "Entregado"}
        <div class="mt-2"><Aviso tono="verde">Entregado en {ciudad(envio.idCiudadDestino)}.</Aviso></div>
      {:else}
        <div class="mt-2"><Aviso tono="rojo">Este envío se canceló.</Aviso></div>
      {/if}
      {#if sesion.usuario && (envio.estado === "Pendiente" || envio.estado === "Asignado")}
        <Button color="alternative" size="sm" class="mt-2 w-full gap-2" disabled={ocupado} onclick={() => confirm(`¿Cancelar el envío ${id}?`) && accion(() => api.cambiarEstado(id, "cancelacion"))}>
          <Ban class="h-4 w-4" />Cancelar envío
        </Button>
      {/if}
      {#if errorAccion}<div class="mt-2"><Aviso tono="rojo">{errorAccion}</Aviso></div>{/if}
    </section>

    <!-- Manifiesto (MongoDB) -->
    <section class="mt-4 rounded-xl border-2 border-black/10 p-4" aria-labelledby="carga">
      <h2 id="carga" class="flex items-center gap-2 text-lg font-extrabold"><ClipboardList class="h-5 w-5 text-senal-600" />Qué lleva</h2>
      {#if manifiesto}
        <p class="mt-1 text-sm font-bold">Carga {manifiesto.tipoCarga}</p>
        <ul class="mt-2 space-y-1 text-sm font-semibold">
          {#each manifiesto.articulos as a, i (i)}
            <li class="flex justify-between gap-2 rounded-lg bg-concreto px-3 py-1.5"><span>{a.cantidad} × {a.descripcion}</span><span class="cifra">{kg(a.cantidad * a.pesoKg)}</span></li>
          {/each}
        </ul>
        <dl class="mt-2 grid grid-cols-2 gap-2 text-sm">
          {#if manifiesto.tipoCarga === "refrigerada"}
            <div class="rounded-xl bg-concreto px-3 py-2"><dt class="text-xs font-semibold">Temperatura</dt><dd class="font-extrabold">{manifiesto.tempMinC} a {manifiesto.tempMaxC} °C</dd></div>
            <div class="rounded-xl bg-concreto px-3 py-2"><dt class="text-xs font-semibold">Tiempo máximo</dt><dd class="font-extrabold">{duracion(manifiesto.tiempoMaxMin ?? 0)}</dd></div>
          {:else if manifiesto.tipoCarga === "peligrosa"}
            <div class="rounded-xl bg-concreto px-3 py-2"><dt class="text-xs font-semibold">Clase UN</dt><dd class="font-extrabold">{manifiesto.claseUN}</dd></div>
            <div class="rounded-xl bg-concreto px-3 py-2"><dt class="text-xs font-semibold">Número ONU</dt><dd class="font-extrabold">{manifiesto.numeroONU}</dd></div>
            <div class="col-span-2 rounded-xl bg-concreto px-3 py-2"><dt class="text-xs font-semibold">Teléfono de emergencia</dt><dd class="font-extrabold">{manifiesto.telefonoEmergencia}</dd></div>
          {/if}
        </dl>
      {:else if manifiesto === null}
        {#if puedeEditar}
          <p class="mt-1 text-sm font-semibold">Todavía no tiene manifiesto. Sin él, la ruta no sabe si la carga necesita cuidados.</p>
          <form class="mt-3 space-y-3" onsubmit={guardarManifiesto}>
            <div class="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo de carga">
              {#each tiposCarga as op (op.v)}
                <label class="cursor-pointer rounded-lg border-2 border-black/10 px-2 py-1.5 text-center text-sm font-bold has-[:checked]:border-senal-500 has-[:checked]:bg-senal-50">
                  <input type="radio" name="tipoCarga" value={op.v} bind:group={tipoCarga} class="sr-only" />
                  {op.t}<span class="block text-[11px] leading-tight font-semibold">{op.nota}</span>
                </label>
              {/each}
            </div>

            <fieldset class="space-y-2">
              <legend class="text-sm font-bold">Artículos (peso de cada pieza)</legend>
              <div class="grid grid-cols-[1fr_4.5rem_5rem_2.25rem] gap-1.5 text-xs font-semibold">
                <span>Qué es</span><span>Piezas</span><span>Kg c/u</span><span></span>
              </div>
              {#each articulos as a, i (i)}
                <div class="grid grid-cols-[1fr_4.5rem_5rem_2.25rem] items-center gap-1.5">
                  <div class="min-w-0"><Input bind:value={a.descripcion} required placeholder="Cajas de café" aria-label="Descripción del artículo {i + 1}" /></div>
                  <div><Input type="number" bind:value={a.cantidad} required min="1" aria-label="Piezas del artículo {i + 1}" /></div>
                  <div><Input type="number" bind:value={a.pesoKg} required min="0.01" step="any" aria-label="Kilos por pieza del artículo {i + 1}" /></div>
                  {#if articulos.length > 1}
                    <button type="button" class="grid h-9 w-9 place-items-center rounded-lg hover:bg-concreto" aria-label="Quitar artículo {i + 1}" onclick={() => (articulos = articulos.filter((_, j) => j !== i))}>
                      <Trash2 class="h-4 w-4" />
                    </button>
                  {:else}<span></span>{/if}
                </div>
              {/each}
              <div class="flex items-center justify-between text-sm">
                <button type="button" class="flex items-center gap-1 font-bold text-senal-600 hover:underline" onclick={() => (articulos = [...articulos, { descripcion: "", cantidad: 1, pesoKg: 1 }])}>
                  <Plus class="h-4 w-4" />Otro artículo
                </button>
                <span class="font-semibold {Math.abs(pesoArticulos - envio.pesoKg) > 0.5 ? 'text-restrictivo' : ''}">Suman {kg(pesoArticulos)} de {kg(envio.pesoKg)}</span>
              </div>
            </fieldset>

            {#if tipoCarga === "general"}
              <label class="flex items-center gap-2 text-sm font-bold"><input type="checkbox" bind:checked={evitarTerraceria} class="h-4 w-4 accent-senal-500" />Evitar terracería</label>
              <div>
                <Label for="tmaxg" class="mb-1 text-sm font-bold">Tiempo máximo en minutos (opcional)</Label>
                <Input id="tmaxg" type="number" bind:value={tiempoMaxGeneral} min="1" />
              </div>
            {:else if tipoCarga === "refrigerada"}
              <div class="grid grid-cols-3 gap-2">
                <div><Label for="tmin" class="mb-1 text-sm font-bold">Mín. °C</Label><Input id="tmin" type="number" bind:value={tempMinC} required step="any" /></div>
                <div><Label for="tmax" class="mb-1 text-sm font-bold">Máx. °C</Label><Input id="tmax" type="number" bind:value={tempMaxC} required step="any" /></div>
                <div><Label for="tvia" class="mb-1 text-sm font-bold">Máx. min</Label><Input id="tvia" type="number" bind:value={tiempoMaxMin} required min="1" /></div>
              </div>
            {:else}
              <div class="grid grid-cols-2 gap-2">
                <div><Label for="clase" class="mb-1 text-sm font-bold">Clase UN (1 a 9)</Label><Input id="clase" type="number" bind:value={claseUN} required min="1" max="9" /></div>
                <div><Label for="onu" class="mb-1 text-sm font-bold">Número ONU</Label><Input id="onu" bind:value={numeroONU} required placeholder="UN1993" /></div>
              </div>
              <div><Label for="hoja" class="mb-1 text-sm font-bold">Hoja de seguridad (enlace)</Label><Input id="hoja" bind:value={hojaSeguridad} required /></div>
              <div><Label for="tel" class="mb-1 text-sm font-bold">Teléfono de emergencia</Label><Input id="tel" bind:value={telefonoEmergencia} required minlength={5} /></div>
            {/if}

            {#if errorManifiesto}<Aviso tono="rojo">{errorManifiesto}</Aviso>{/if}
            <Button type="submit" class="w-full gap-2"><CircleCheck class="h-4 w-4" />Guardar manifiesto</Button>
          </form>
        {:else}
          <p class="mt-1 text-sm font-semibold">Este envío no tiene manifiesto.</p>
        {/if}
      {:else}
        <p class="mt-2 flex items-center gap-2 text-sm font-semibold"><RefreshCw class="h-4 w-4 animate-spin" />Cargando…</p>
      {/if}
    </section>

    <!-- Bitácora (MongoDB) -->
    <section class="mt-4" aria-labelledby="historial">
      <h2 id="historial" class="text-lg font-extrabold">Historial</h2>
      <ol class="mt-2 space-y-1.5">
        {#each bitacora?.eventos ?? [] as ev, i (i)}
          <li class="flex gap-3 rounded-xl bg-concreto px-3 py-2 text-sm">
            <span class="w-28 shrink-0 font-semibold">{fecha(ev.fecha)}</span>
            <span class="font-bold">{textoEvento[ev.tipo]?.(ev.detalle) ?? ev.tipo}</span>
          </li>
        {:else}
          <li class="text-sm font-semibold">Sin movimientos todavía.</li>
        {/each}
      </ol>
    </section>
  {:else if !error}
    <p class="mt-4 flex items-center gap-2 font-semibold"><RefreshCw class="h-4 w-4 animate-spin" />Cargando…</p>
  {/if}
</VistaMapa>
