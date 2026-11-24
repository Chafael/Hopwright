import { Ban, CarFront, Construction, Mountain } from "@lucide/svelte";
import type { TipoIncidente } from "./api";

// Ícono de cada tipo de incidente, para que se reconozca sin leer
export const iconoTipo: Record<TipoIncidente, typeof Ban> = {
  Bloqueo: Ban,
  Accidente: CarFront,
  Obra: Construction,
  Derrumbe: Mountain,
};

// Qué significa cada gravedad para quien despacha
export const significadoGravedad: Record<string, string> = {
  Baja: "Se puede pasar",
  Media: "Hay retraso",
  Alta: "Cierra el paso",
};
