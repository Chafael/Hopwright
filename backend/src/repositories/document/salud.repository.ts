import { mongoDb } from "../../db/mongo.js";

// Consulta mínima para saber si MongoDB responde
export async function pingMongo(): Promise<void> {
  const db = await mongoDb();
  await db.command({ ping: 1 });
}
