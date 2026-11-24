<script lang="ts">
  // Rombo de señal preventiva con la gravedad del incidente: el mismo símbolo que en el mapa
  let { gravedad }: { gravedad: string } = $props();
  const estilos: Record<string, string> = {
    Alta: "bg-restrictivo text-white",
    Media: "bg-preventivo text-asfalto",
    Baja: "bg-white text-asfalto",
  };
</script>

<span class="inline-flex items-center gap-2 text-sm font-semibold">
  <span class="grid h-4 w-4 rotate-45 place-items-center rounded-[2px] border-2 border-asfalto {estilos[gravedad] ?? estilos.Baja}" aria-hidden="true"></span>
  {gravedad}
</span>
