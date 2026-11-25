import { mongoDb } from "../../db/mongo.js";

export type EventoBitacora = { tipo: string; fecha: Date; detalle: Record<string, unknown> };
export type BitacoraEnvio = { idEnvio: string; eventos: EventoBitacora[] };

const sinId = { projection: { _id: 0 } } as const;

async function coleccion() {
  return (await mongoDb()).collection<BitacoraEnvio>("bitacora_envio");
}

export async function buscarBitacora(idEnvio: string): Promise<BitacoraEnvio | null> {
  return (await coleccion()).findOne({ idEnvio }, sinId);
}

export async function agregarEventoBitacora(idEnvio: string, evento: EventoBitacora): Promise<void> {
  const col = await coleccion();
  await col.updateOne({ idEnvio }, { $setOnInsert: { idEnvio, eventos: [] } }, { upsert: true });
  await col.updateOne(
    { idEnvio, eventos: { $not: { $elemMatch: { tipo: evento.tipo, fecha: evento.fecha } } } },
    { $push: { eventos: { $each: [evento], $sort: { fecha: 1 } } } },
  );
}
