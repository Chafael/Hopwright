// Consultas representativas de reportes_incidente. Se pueden pegar en mongosh:
//   docker exec -it hopwright-mongo mongosh -u hopwright -p --authenticationDatabase admin hopwright
// Cada una indica qué índice usa (revisar con .explain("executionStats")).

// 1. Incidentes activos de gravedad Alta, del más reciente al más antiguo (índice activos_por_gravedad).
//    Es lo que muestra la pantalla de incidentes.
db.reportes_incidente
  .find({ activo: true, gravedad: "Alta" }, { _id: 0, idIncidente: 1, tipo: 1, idPunto: 1, fechaInicio: 1 })
  .sort({ fechaInicio: -1 });

// 2. Historial de incidentes de un punto de la red (índice por_punto).
db.reportes_incidente.find({ idPunto: "07094" }, { _id: 0, idIncidente: 1, tipo: 1, gravedad: 1, activo: 1 });

// 3. Reportes que no han llegado a Neo4j (índice parcial pendientes_de_sincronizar).
//    Es la primera consulta de la reconciliación.
db.reportes_incidente.find({ sincronizado: false }, { _id: 0, idIncidente: 1, idPunto: 1, gravedad: 1, activo: 1 });

// 4. Cuántos incidentes hubo por tipo y gravedad, y cuánto duraron en promedio los ya cerrados.
db.reportes_incidente.aggregate([
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
]);

// 5. Obras cuya fecha estimada de fin ya pasó y siguen activas (campo que solo existe en el detalle de tipo Obra).
db.reportes_incidente.find(
  { tipo: "Obra", activo: true, "detalle.fechaFinEstimada": { $lt: new Date() } },
  { _id: 0, idIncidente: 1, idPunto: 1, "detalle.dependencia": 1, "detalle.fechaFinEstimada": 1 },
);

// 6. Agregar una evidencia sin reescribir el reporte (lo hace POST /incidentes/{id}/evidencias).
db.reportes_incidente.updateOne(
  { idIncidente: "INC-0001" },
  {
    $push: { evidencias: { tipo: "Testimonio", texto: "Ya terminaron un carril.", autor: "Despacho Tuxtla", fecha: new Date() } },
    $set: { actualizadoEn: new Date() },
  },
);

// 7. Siguiente número de incidente; $inc es atómico (lo usa POST /incidentes).
db.contadores.findOneAndUpdate({ _id: "incidentes" }, { $inc: { valor: 1 } }, { upsert: true, returnDocument: "after" });
