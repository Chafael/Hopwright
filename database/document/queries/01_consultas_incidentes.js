// Consultas representativas de reportes_incidente.
// Se corren completas con mongosh (o se pegan una por una):
//   docker exec -i hopwright-mongo mongosh -u hopwright -p <contraseña> --authenticationDatabase admin hopwright --quiet --file <archivo>
// Cada una dice qué índice usa; se puede revisar con .explain("executionStats").
// Las que escriben (6 y 7) deshacen su cambio al final para no alterar los datos de prueba.

const titulo = (t) => print(`\n// ${t}`);

// 1. Incidentes activos de gravedad Alta, del más reciente al más antiguo (índice activos_por_gravedad).
//    Es lo que muestra la pantalla de incidentes.
titulo("1. Incidentes activos de gravedad Alta");
printjson(
  db.reportes_incidente
    .find({ activo: true, gravedad: "Alta" }, { _id: 0, idIncidente: 1, tipo: 1, idPunto: 1, fechaInicio: 1 })
    .sort({ fechaInicio: -1 })
    .toArray(),
);

// 2. Historial de incidentes de un punto de la red (índice por_punto).
titulo("2. Incidentes de Teopisca (07094)");
printjson(db.reportes_incidente.find({ idPunto: "07094" }, { _id: 0, idIncidente: 1, tipo: 1, gravedad: 1, activo: 1 }).toArray());

// 3. Reportes que no han llegado a Neo4j (índice parcial pendientes_de_sincronizar).
//    Es la primera consulta de la reconciliación. En una base sana viene vacía.
titulo("3. Reportes pendientes de copiar a Neo4j");
printjson(db.reportes_incidente.find({ sincronizado: false }, { _id: 0, idIncidente: 1, idPunto: 1, gravedad: 1, activo: 1 }).toArray());

// 4. Cuántos incidentes hubo por tipo y gravedad, y cuánto duraron en promedio los ya cerrados.
titulo("4. Incidentes por tipo y gravedad");
printjson(
  db.reportes_incidente
    .aggregate([
      {
        $group: {
          _id: { tipo: "$tipo", gravedad: "$gravedad" },
          total: { $sum: 1 },
          activos: { $sum: { $cond: ["$activo", 1, 0] } },
          horasPromedio: {
            $avg: { $cond: ["$fechaFin", { $dateDiff: { startDate: "$fechaInicio", endDate: "$fechaFin", unit: "hour" } }, null] },
          },
        },
      },
      { $sort: { "_id.tipo": 1, "_id.gravedad": 1 } },
    ])
    .toArray(),
);

// 5. Obras activas con su dependencia y fecha estimada de fin. El campo solo existe en el detalle de tipo Obra.
titulo("5. Obras activas y cuándo deberían terminar");
printjson(
  db.reportes_incidente
    .find(
      { tipo: "Obra", activo: true },
      { _id: 0, idIncidente: 1, idPunto: 1, "detalle.dependencia": 1, "detalle.fechaFinEstimada": 1 },
    )
    .toArray(),
);

// 6. Agregar una evidencia sin reescribir el reporte (lo hace POST /incidentes/{id}/evidencias).
titulo("6. $push de una evidencia a INC-0001 (y se quita al final)");
const marca = new Date();
printjson(
  db.reportes_incidente.updateOne(
    { idIncidente: "INC-0001" },
    { $push: { evidencias: { tipo: "Testimonio", texto: "Ya terminaron un carril.", autor: "Consulta de ejemplo", fecha: marca } } },
  ),
);
print(`evidencias ahora: ${db.reportes_incidente.findOne({ idIncidente: "INC-0001" }).evidencias.length}`);
db.reportes_incidente.updateOne({ idIncidente: "INC-0001" }, { $pull: { evidencias: { autor: "Consulta de ejemplo", fecha: marca } } });

// 7. Siguiente número de incidente; $inc es atómico (lo usa POST /incidentes). Aquí se usa un contador
//    de ejemplo para no gastar números reales.
titulo("7. Contador atómico con findOneAndUpdate y $inc");
printjson(db.contadores.findOneAndUpdate({ _id: "ejemplo" }, { $inc: { valor: 1 } }, { upsert: true, returnDocument: "after" }));
printjson(db.contadores.findOneAndUpdate({ _id: "ejemplo" }, { $inc: { valor: 1 } }, { upsert: true, returnDocument: "after" }));
db.contadores.deleteOne({ _id: "ejemplo" });

// 8. Plan de la consulta 1: debe usar el índice activos_por_gravedad (IXSCAN), no leer toda la colección.
titulo("8. Plan de ejecución de la consulta 1");
const plan = db.reportes_incidente.find({ activo: true, gravedad: "Alta" }).sort({ fechaInicio: -1 }).explain("executionStats");
const etapas = [];
for (let e = plan.queryPlanner.winningPlan; e; e = e.inputStage) etapas.push(e.indexName ? `${e.stage} (${e.indexName})` : e.stage);
printjson({ etapas, documentosRevisados: plan.executionStats.totalDocsExamined, regresados: plan.executionStats.nReturned });
