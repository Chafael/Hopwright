import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";

const url = `mongodb://${encodeURIComponent(env.mongo.user)}:${encodeURIComponent(env.mongo.password)}@${env.mongo.host}:${env.mongo.port}/?authSource=admin`;

// serverSelectionTimeoutMS corto para que /health no se quede esperando si Mongo está apagado
export const mongoClient = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });

let conectado = false;

export async function mongoDb(): Promise<Db> {
  if (!conectado) {
    await mongoClient.connect();
    conectado = true;
  }
  return mongoClient.db(env.mongo.database);
}

export async function cerrarMongo(): Promise<void> {
  await mongoClient.close();
  conectado = false;
}
