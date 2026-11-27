<script lang="ts">
  import type { EstadoEnvio } from "$lib/api";

  // Etiqueta del estado de un envío, con los colores de las señales de tránsito
  let { estado }: { estado: EstadoEnvio } = $props();
  const estilos: Record<EstadoEnvio, string> = {
    Pendiente: "bg-[#fff3c4] text-[#7a5a00]",
    Asignado: "bg-[#e7f0fb] text-servicios",
    "En camino": "bg-senal-50 text-senal-700",
    Entregado: "bg-concreto text-asfalto",
    Cancelado: "bg-[#fde8eb] text-restrictivo",
  };
</script>

<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap {estilos[estado]}">{estado}</span>
