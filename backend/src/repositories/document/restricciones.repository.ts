import { mongoDb } from "../../db/mongo.js";

// Restricciones de ruta que trae el manifiesto de carga de un envío (colección manifiestos).
// Solo lee restriccionesRuta.evitarTerraceria; si el envío no tiene manifiesto, no hay restricción.
export async function evitaTerraceria(idEnvio: string): Promise<boolean> {
  const manifiesto = await (await mongoDb())
    .collection<{ idEnvio: string; restriccionesRuta?: { evitarTerraceria?: boolean } }>("manifiestos")
    .findOne({ idEnvio }, { projection: { _id: 0, restriccionesRuta: 1 } });
  return manifiesto?.restriccionesRuta?.evitarTerraceria ?? false;
}
