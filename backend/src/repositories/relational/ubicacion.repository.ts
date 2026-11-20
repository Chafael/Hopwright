import { pool } from "../../db/postgres.js";

// El tipo de vehículo (Camión, Tráiler, Tren) vive en PostgreSQL, que es su fuente de verdad.
// Mover un vehículo en el grafo lo consulta para aplicar la regla R11.

export type TipoVehiculo =
  | { disponible: true; tipo: string | null } // tipo null: la placa no está registrada
  | { disponible: false; motivo: string }; // no se pudo consultar (tabla aún no creada o base caída)

export async function tipoDeVehiculo(placa: string): Promise<TipoVehiculo> {
  try {
    const { rows } = await pool.query<{ tipo: string }>("SELECT tipo FROM vehiculo WHERE placa = $1", [placa]);
    return { disponible: true, tipo: rows[0]?.tipo ?? null };
  } catch (error) {
    // 42P01: la tabla no existe. Pasa mientras el esquema relacional no está cargado.
    const codigo = (error as { code?: string }).code;
    return { disponible: false, motivo: codigo === "42P01" ? "la tabla vehiculo todavía no existe" : "PostgreSQL no respondió" };
  }
}
