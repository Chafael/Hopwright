// Consultas representativas de bitacora_envio.
//   docker exec -i hopwright-mongo mongosh -u hopwright -p <contraseña> --authenticationDatabase admin hopwright --quiet --file <archivo>
// La 5 escribe en un envío de ejemplo que no existe (E-999901) y lo borra al final.

const titulo = (t) => print(`\n// ${t}`);

// 1. Bitácora completa de un envío (índice único idEnvio_unico). Es GET /envios/{id}/bitacora.
titulo("1. Bitácora de E-105");
printjson(db.bitacora_envio.findOne({ idEnvio: "E-105" }, { _id: 0 }));

// 2. Último evento de cada envío. Los eventos se guardan ordenados por fecha, así que es el último del arreglo.
titulo("2. Último evento de cada envío");
printjson(
  db.bitacora_envio
    .aggregate([
      { $project: { _id: 0, idEnvio: 1, eventos: { $size: "$eventos" }, ultimo: { $arrayElemAt: ["$eventos", -1] } } },
      { $project: { idEnvio: 1, eventos: 1, ultimoTipo: "$ultimo.tipo", ultimaFecha: "$ultimo.fecha" } },
      { $sort: { idEnvio: 1 } },
    ])
    .toArray(),
);

// 3. Cuántos eventos hay de cada tipo en todas las bitácoras.
titulo("3. Eventos por tipo");
printjson(
  db.bitacora_envio
    .aggregate([{ $unwind: "$eventos" }, { $group: { _id: "$eventos.tipo", total: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray(),
);

// 4. Horas entre la salida y la entrega de cada envío entregado, calculado solo con la bitácora.
titulo("4. Horas de la salida a la entrega");
printjson(
  db.bitacora_envio
    .aggregate([
      {
        $project: {
          _id: 0,
          idEnvio: 1,
          salida: { $first: { $filter: { input: "$eventos", cond: { $eq: ["$$this.tipo", "ENVIO_SALIO"] } } } },
          entrega: { $first: { $filter: { input: "$eventos", cond: { $eq: ["$$this.tipo", "ENVIO_ENTREGADO"] } } } },
        },
      },
      { $match: { salida: { $ne: null }, entrega: { $ne: null } } },
      { $project: { idEnvio: 1, horas: { $dateDiff: { startDate: "$salida.fecha", endDate: "$entrega.fecha", unit: "hour" } } } },
    ])
    .toArray(),
);

// 5. Agregar un evento como lo hace el procesador de eventos: crea la bitácora si no existe, no repite un evento
//    igual (mismo tipo y fecha) y mantiene el arreglo ordenado aunque el evento llegue tarde.
titulo("5. $push idempotente y ordenado (envío de ejemplo E-999901)");
const id = "E-999901";
const agregar = (tipo, fecha) => {
  db.bitacora_envio.updateOne({ idEnvio: id }, { $setOnInsert: { idEnvio: id, eventos: [] } }, { upsert: true });
  return db.bitacora_envio.updateOne(
    { idEnvio: id, eventos: { $not: { $elemMatch: { tipo, fecha } } } },
    { $push: { eventos: { $each: [{ tipo, fecha, detalle: { idEnvio: id } }], $sort: { fecha: 1 } } } },
  ).modifiedCount;
};
print(`ENVIO_SALIO agregado: ${agregar("ENVIO_SALIO", new Date("2026-11-21T09:00:00Z"))}`);
print(`ASIGNACION_CREADA (llega tarde, con fecha anterior) agregado: ${agregar("ASIGNACION_CREADA", new Date("2026-11-21T08:00:00Z"))}`);
print(`ENVIO_SALIO repetido (reintento) agregado: ${agregar("ENVIO_SALIO", new Date("2026-11-21T09:00:00Z"))}`);
printjson(db.bitacora_envio.findOne({ idEnvio: id }, { _id: 0, "eventos.tipo": 1 }));
db.bitacora_envio.deleteOne({ idEnvio: id });
