import { escribir } from "../db/neo4j.js";
import { agregarEventoBitacora } from "../repositories/document/bitacora.repository.js";
import { marcarEventoAplicado, marcarEventoFallido, tomarEventosPendientes } from "../repositories/relational/eventos.repository.js";

let intervalo: NodeJS.Timeout | null = null;
let procesando = false;

async function aplicarEvento(evento: { tipo: string; payload: Record<string, unknown> }) {
  if (evento.tipo === "CIUDAD_GUARDADA") {
    const { idCiudad, nombre } = evento.payload as { idCiudad: string; nombre: string };
    await escribir(`MERGE (c:Ciudad {idCiudad: $idCiudad}) SET c.nombre = $nombre`, { idCiudad, nombre });
    return;
  }
  if (evento.tipo === "VEHICULO_GUARDADO") {
    const { placa } = evento.payload as { placa: string };
    await escribir(`MERGE (v:Vehiculo {placa: $placa})`, { placa });
    return;
  }
  if (evento.tipo === "ASIGNACION_CREADA" || evento.tipo === "ENVIO_SALIO" || evento.tipo === "ENVIO_ENTREGADO") {
    const idEnvio = String(evento.payload.idEnvio);
    const fecha = evento.payload.fecha ? new Date(String(evento.payload.fecha)) : new Date();
    await agregarEventoBitacora(idEnvio, { tipo: evento.tipo, fecha, detalle: evento.payload });
  }
}

export async function procesarEventosPendientes(): Promise<void> {
  if (procesando) return;
  procesando = true;
  try {
    const eventos = await tomarEventosPendientes(20);
    for (const evento of eventos) {
      try {
        await aplicarEvento(evento);
        await marcarEventoAplicado(evento.id);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        await marcarEventoFallido(evento.id, mensaje);
      }
    }
  } finally {
    procesando = false;
  }
}

export function iniciarProcesadorEventos(): void {
  if (intervalo) return;
  intervalo = setInterval(() => {
    procesarEventosPendientes().catch(() => undefined);
  }, 5000);
  intervalo.unref?.();
}

export function detenerProcesadorEventos(): void {
  if (intervalo) clearInterval(intervalo);
  intervalo = null;
}
