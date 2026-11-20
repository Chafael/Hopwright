import { pool } from "../../db/postgres.js";

// Envíos que van en camino y el vehículo que los lleva (fuente de verdad: PostgreSQL).
// Tablas envio y asignacion del esquema relacional (docs/plan-de-trabajo.md, sección 7).

export type EnvioEnCamino = { idEnvio: string; origen: string; destino: string; prioridad: string; placa: string | null };

// Regresa null si las tablas todavía no existen (código 42P01), para responder con un aviso en lugar de un error.
export async function enviosEnCamino(): Promise<EnvioEnCamino[] | null> {
  try {
    const { rows } = await pool.query<EnvioEnCamino>(
      `SELECT e.id_envio          AS "idEnvio",
              e.id_ciudad_origen  AS origen,
              e.id_ciudad_destino AS destino,
              e.prioridad,
              a.placa
       FROM envio e
       LEFT JOIN asignacion a ON a.id_envio = e.id_envio AND a.activa
       WHERE e.estado = 'En camino'
       ORDER BY e.prioridad = 'Urgente' DESC, e.id_envio`,
    );
    return rows;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
}
