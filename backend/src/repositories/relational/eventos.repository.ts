import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export type EventoPendiente = {
  id: number;
  tipo: string;
  payload: Record<string, unknown>;
  estado: string;
  intentos: number;
  ultimoError: string | null;
};

export async function encolarEvento(tipo: string, payload: Record<string, unknown>, cliente: PoolClient): Promise<void> {
  await cliente.query("INSERT INTO eventos_pendientes (tipo, payload) VALUES ($1, $2::jsonb)", [tipo, JSON.stringify(payload)]);
}

export async function tomarEventosPendientes(limite = 20): Promise<EventoPendiente[]> {
  const { rows } = await pool.query(
    `UPDATE eventos_pendientes SET estado = 'pendiente'
     WHERE id IN (
       SELECT id FROM eventos_pendientes
       WHERE estado = 'pendiente' AND intentos < 5
       ORDER BY creado_en
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, tipo, payload, estado, intentos, ultimo_error`,
    [limite],
  );
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    payload: r.payload,
    estado: r.estado,
    intentos: r.intentos,
    ultimoError: r.ultimo_error,
  }));
}

export async function marcarEventoAplicado(id: number): Promise<void> {
  await pool.query("UPDATE eventos_pendientes SET estado = 'aplicado', aplicado_en = NOW(), ultimo_error = NULL WHERE id = $1", [id]);
}

export async function marcarEventoFallido(id: number, error: string): Promise<void> {
  await pool.query(
    `UPDATE eventos_pendientes
     SET intentos = intentos + 1,
         ultimo_error = $2,
         estado = CASE WHEN intentos + 1 >= 5 THEN 'fallido' ELSE 'pendiente' END
     WHERE id = $1`,
    [id, error.slice(0, 1000)],
  );
}
