import { api, type Mapa, type Punto } from "./api";

// La red se pide una vez y la comparten todas las pantallas. Después de un cambio que la afecta
// (reportar o cerrar un incidente, mover un vehículo) se llama a recargarRed().
let promesa: Promise<Mapa> | null = null;

export function cargarRed(): Promise<Mapa> {
  promesa ??= api.mapa().catch((e) => {
    promesa = null; // si falló, el siguiente intento vuelve a pedirla
    throw e;
  });
  return promesa;
}

export function recargarRed(): Promise<Mapa> {
  promesa = null;
  return cargarRed();
}

// Opciones para los selectores, ordenadas por nombre
export const opciones = (puntos: Punto[], tipos: Punto["tipo"][]) =>
  puntos
    .filter((p) => tipos.includes(p.tipo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => ({ value: p.idPunto, name: p.tipo === "Ciudad" ? p.nombre : `${p.nombre} (${p.idPunto})` }));

export const nombreDe = (mapa: Mapa | undefined, id: string) => mapa?.puntos.find((p) => p.idPunto === id)?.nombre ?? id;
