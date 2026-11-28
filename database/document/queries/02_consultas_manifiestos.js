// Consultas representativas de manifiestos.
//   docker exec -i hopwright-mongo mongosh -u hopwright -p <contraseña> --authenticationDatabase admin hopwright --quiet --file <archivo>
// Ninguna escribe.

const titulo = (t) => print(`\n// ${t}`);

// 1. El manifiesto de un envío (índice único idEnvio_unico). Es lo que lee el flujo integrado.
titulo("1. Manifiesto de E-103");
printjson(db.manifiestos.findOne({ idEnvio: "E-103" }, { _id: 0 }));

// 2. Cargas peligrosas con lo que necesita saber el conductor en una emergencia.
//    Los campos claseUN, numeroONU y telefonoEmergencia solo existen en este tipo de carga.
titulo("2. Cargas peligrosas");
printjson(
  db.manifiestos
    .find({ tipoCarga: "peligrosa" }, { _id: 0, idEnvio: 1, claseUN: 1, numeroONU: 1, telefonoEmergencia: 1 })
    .sort({ idEnvio: 1 })
    .toArray(),
);

// 3. Cargas refrigeradas con su rango de temperatura y el tiempo máximo que aguantan en camino.
titulo("3. Cargas refrigeradas");
printjson(
  db.manifiestos
    .find({ tipoCarga: "refrigerada" }, { _id: 0, idEnvio: 1, tempMinC: 1, tempMaxC: 1, tiempoMaxMin: 1 })
    .sort({ tiempoMaxMin: 1 })
    .toArray(),
);

// 4. Peso declarado en cada manifiesto (cantidad por peso unitario de cada artículo) y cuántos artículos trae.
//    Este total se puede comparar con peso_kg del envío en PostgreSQL.
titulo("4. Peso declarado por manifiesto");
printjson(
  db.manifiestos
    .aggregate([
      { $unwind: "$articulos" },
      {
        $group: {
          _id: "$idEnvio",
          tipoCarga: { $first: "$tipoCarga" },
          articulos: { $sum: 1 },
          piezas: { $sum: "$articulos.cantidad" },
          pesoDeclaradoKg: { $sum: { $multiply: ["$articulos.cantidad", "$articulos.pesoKg"] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray(),
);

// 5. Cuántos manifiestos hay de cada tipo de carga y cuántos piden evitar terracería.
titulo("5. Manifiestos por tipo de carga");
printjson(
  db.manifiestos
    .aggregate([
      {
        $group: {
          _id: "$tipoCarga",
          manifiestos: { $sum: 1 },
          evitanTerraceria: { $sum: { $cond: ["$restriccionesRuta.evitarTerraceria", 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray(),
);

// 6. Buscar dentro del arreglo de artículos: envíos que llevan algún solvente ($elemMatch sobre un subdocumento).
titulo("6. Envíos que llevan solvente");
printjson(
  db.manifiestos
    .find({ articulos: { $elemMatch: { descripcion: /solvente/i } } }, { _id: 0, idEnvio: 1, "articulos.descripcion": 1 })
    .toArray(),
);

// 7. Plan de la consulta 1: debe ser un IXSCAN sobre idEnvio_unico que revisa un solo documento.
titulo("7. Plan de ejecución de la consulta 1");
const plan = db.manifiestos.find({ idEnvio: "E-103" }).explain("executionStats");
const etapas = [];
for (let e = plan.queryPlanner.winningPlan; e; e = e.inputStage) etapas.push(e.indexName ? `${e.stage} (${e.indexName})` : e.stage);
printjson({ etapas, documentosRevisados: plan.executionStats.totalDocsExamined, regresados: plan.executionStats.nReturned });
