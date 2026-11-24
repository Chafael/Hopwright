import { mongoDb } from "../../db/mongo.js";

export type ArticuloManifiesto = { descripcion: string; cantidad: number; pesoKg: number };
export type Manifiesto = {
  idEnvio: string;
  tipoCarga: "general" | "refrigerada" | "peligrosa";
  articulos: ArticuloManifiesto[];
  tempMinC?: number;
  tempMaxC?: number;
  tiempoMaxMin?: number;
  claseUN?: number;
  numeroONU?: string;
  hojaSeguridad?: string;
  telefonoEmergencia?: string;
  restriccionesRuta: { evitarTerraceria: boolean; tiempoMaxMin: number | null };
  creadoEn: Date;
};

const sinId = { projection: { _id: 0 } } as const;

async function coleccion() {
  return (await mongoDb()).collection<Manifiesto>("manifiestos");
}

export async function buscarManifiesto(idEnvio: string): Promise<Manifiesto | null> {
  return (await coleccion()).findOne({ idEnvio }, sinId);
}

export async function crearManifiesto(manifiesto: Manifiesto): Promise<void> {
  await (await coleccion()).insertOne({ ...manifiesto });
}

export async function listarManifiestos(): Promise<Manifiesto[]> {
  return (await coleccion()).find({}, sinId).sort({ creadoEn: -1 }).toArray();
}
