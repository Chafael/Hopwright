<script lang="ts">
  import { CircleCheck, CircleX, Info, TriangleAlert } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  // Aviso con ícono. amarillo: atención; rojo: error; verde: todo bien; azul: información.
  let { tono = "amarillo", children }: { tono?: "amarillo" | "rojo" | "verde" | "azul"; children: Snippet } = $props();
  const estilos = {
    amarillo: { caja: "bg-[#fff3c4] border-preventivo", icono: TriangleAlert, color: "text-[#7a5a00]" },
    rojo: { caja: "bg-[#fde8eb] border-restrictivo", icono: CircleX, color: "text-restrictivo" },
    verde: { caja: "bg-senal-50 border-senal-500", icono: CircleCheck, color: "text-senal-600" },
    azul: { caja: "bg-[#e7f0fb] border-servicios", icono: Info, color: "text-servicios" },
  };
  const e = $derived(estilos[tono]);
</script>

<div class="flex gap-2.5 rounded-xl border-l-4 px-3 py-2.5 text-sm text-asfalto {e.caja}" role={tono === "rojo" ? "alert" : "status"}>
  <e.icono class="mt-0.5 h-4 w-4 shrink-0 {e.color}" />
  <div class="min-w-0">{@render children()}</div>
</div>
