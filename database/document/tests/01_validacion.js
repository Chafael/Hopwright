// Pruebas de humo, de documentos válidos e inválidos y de índices de la base documental.
//   docker exec -i hopwright-mongo mongosh -u hopwright -p <contraseña> --authenticationDatabase admin hopwright --quiet --file <archivo>
//
// Cada prueba inserta un documento directo en MongoDB, sin pasar por la API, para ver qué hace el validador
// $jsonSchema por sí solo. Un documento inválido debe salir con el código 121 (Document failed validation)
// y uno con un identificador repetido con el 11000 (índice único). Lo que sí entra se borra enseguida.
// Al final imprime una tabla con cada prueba, el resultado esperado, el obtenido y si cumple.

const resultados = [];
const ahora = new Date();

function probar(grupo, prueba, coleccion, documento, esperado) {
  let obtenido;
  try {
    // Se inserta una copia: insertOne le agrega _id al objeto y no queremos arrastrarlo a la siguiente prueba
    const r = db.getCollection(coleccion).insertOne({ ...documento });
    obtenido = "aceptado";
    db.getCollection(coleccion).deleteOne({ _id: r.insertedId });
  } catch (error) {
    obtenido = String(error.code ?? error.message);
  }
  resultados.push({ grupo, prueba, esperado, obtenido, cumple: obtenido === esperado ? "sí" : "NO" });
}

// ---------- Humo: las colecciones existen, tienen validador y los datos de prueba ----------
print("\n// Colecciones, validador, índices y documentos");
printjson(
  db.getCollectionInfos({ name: { $in: ["manifiestos", "bitacora_envio", "reportes_incidente", "contadores"] } }).map((c) => ({
    coleccion: c.name,
    validador: c.options.validator ? c.options.validationLevel + "/" + c.options.validationAction : "sin validador",
    indices: db.getCollection(c.name).getIndexes().map((i) => i.name),
    documentos: db.getCollection(c.name).countDocuments(),
  })),
);

// ---------- manifiestos ----------
const articulos = [{ descripcion: "Cajas de café", cantidad: 10, pesoKg: 25 }];
const general = {
  idEnvio: "E-990001",
  tipoCarga: "general",
  articulos,
  restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: null },
  creadoEn: ahora,
};
const refrigerada = {
  idEnvio: "E-990002",
  tipoCarga: "refrigerada",
  articulos,
  tempMinC: 2,
  tempMaxC: 8,
  tiempoMaxMin: 300,
  restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: 300 },
  creadoEn: ahora,
};
const peligrosa = {
  idEnvio: "E-990003",
  tipoCarga: "peligrosa",
  articulos,
  claseUN: 3,
  numeroONU: "UN1263",
  hojaSeguridad: "https://docs.hopwright.local/hs.pdf",
  telefonoEmergencia: "9615550000",
  restriccionesRuta: { evitarTerraceria: true, tiempoMaxMin: null },
  creadoEn: ahora,
};
const sin = (doc, campo) => {
  const copia = { ...doc };
  delete copia[campo];
  return copia;
};

probar("manifiestos", "Carga general válida", "manifiestos", general, "aceptado");
probar("manifiestos", "Carga refrigerada válida", "manifiestos", refrigerada, "aceptado");
probar("manifiestos", "Carga peligrosa válida", "manifiestos", peligrosa, "aceptado");
probar("manifiestos", "Peligrosa con claseUN 9 (límite superior)", "manifiestos", { ...peligrosa, claseUN: 9 }, "aceptado");
probar("manifiestos", "Peligrosa con claseUN 10", "manifiestos", { ...peligrosa, claseUN: 10 }, "121");
probar("manifiestos", "Peligrosa sin numeroONU", "manifiestos", sin(peligrosa, "numeroONU"), "121");
probar("manifiestos", "Refrigerada sin tiempoMaxMin", "manifiestos", sin(refrigerada, "tiempoMaxMin"), "121");
probar("manifiestos", "General con temperatura (campo de otro tipo)", "manifiestos", { ...general, tempMinC: 2 }, "121");
probar("manifiestos", "Tipo de carga que no existe", "manifiestos", { ...general, tipoCarga: "viva" }, "121");
probar("manifiestos", "Sin artículos", "manifiestos", { ...general, articulos: [] }, "121");
probar("manifiestos", "Artículo con cantidad 0", "manifiestos", { ...general, articulos: [{ descripcion: "Caja", cantidad: 0, pesoKg: 1 }] }, "121");
probar("manifiestos", "idEnvio sin formato E-número", "manifiestos", { ...general, idEnvio: "ENVIO-1" }, "121");
probar("manifiestos", "Campo que no está en el esquema", "manifiestos", { ...general, comentario: "hola" }, "121");
probar("manifiestos", "Segundo manifiesto de E-101 (índice único)", "manifiestos", { ...general, idEnvio: "E-101" }, "11000");

// ---------- bitacora_envio ----------
const bitacora = { idEnvio: "E-990004", eventos: [{ tipo: "ASIGNACION_CREADA", fecha: ahora, detalle: { placa: "CHP-1001" } }] };
probar("bitacora_envio", "Bitácora válida", "bitacora_envio", bitacora, "aceptado");
probar("bitacora_envio", "Bitácora vacía (envío sin eventos todavía)", "bitacora_envio", { idEnvio: "E-990005", eventos: [] }, "aceptado");
probar("bitacora_envio", "Evento con la fecha como texto", "bitacora_envio", { idEnvio: "E-990006", eventos: [{ tipo: "ENVIO_SALIO", fecha: "2026-11-20", detalle: {} }] }, "121");
probar("bitacora_envio", "Evento sin detalle", "bitacora_envio", { idEnvio: "E-990006", eventos: [{ tipo: "ENVIO_SALIO", fecha: ahora }] }, "121");
probar("bitacora_envio", "Segunda bitácora de E-105 (índice único)", "bitacora_envio", { idEnvio: "E-105", eventos: [] }, "11000");

// ---------- reportes_incidente ----------
const reporte = {
  idIncidente: "INC-9901",
  tipo: "Bloqueo",
  idPunto: "INT-CHC",
  tipoPunto: "Interseccion",
  gravedad: "Alta",
  descripcion: "Bloqueo de prueba en la caseta",
  fechaInicio: ahora,
  detalle: { causa: "Manifestación", carrilesCerrados: 2 },
  evidencias: [],
  activo: true,
  sincronizado: true,
  reportadoPor: "Prueba de validación",
  creadoEn: ahora,
};
probar("reportes_incidente", "Bloqueo válido", "reportes_incidente", reporte, "aceptado");
probar("reportes_incidente", "Derrumbe válido en una ciudad", "reportes_incidente", { ...reporte, idIncidente: "INC-9902", tipo: "Derrumbe", idPunto: "07094", tipoPunto: "Ciudad", detalle: { volumenEstimadoM3: 30, requiereMaquinaria: true } }, "aceptado");
probar("reportes_incidente", "Cerrado con fecha de fin", "reportes_incidente", { ...reporte, idIncidente: "INC-9903", activo: false, fechaFin: ahora, motivoCierre: "Se liberó" }, "aceptado");
probar("reportes_incidente", "Bloqueo con el detalle de un derrumbe", "reportes_incidente", { ...reporte, detalle: { volumenEstimadoM3: 30, requiereMaquinaria: true } }, "121");
probar("reportes_incidente", "Bloqueo sin carriles cerrados", "reportes_incidente", { ...reporte, detalle: { causa: "Manifestación" } }, "121");
probar("reportes_incidente", "Gravedad que no existe", "reportes_incidente", { ...reporte, gravedad: "Extrema" }, "121");
probar("reportes_incidente", "tipoPunto Ciudad con un id de intersección", "reportes_incidente", { ...reporte, tipoPunto: "Ciudad" }, "121");
probar("reportes_incidente", "Activo pero con fecha de fin", "reportes_incidente", { ...reporte, fechaFin: ahora }, "121");
probar("reportes_incidente", "Cerrado sin fecha de fin", "reportes_incidente", { ...reporte, activo: false }, "121");
probar("reportes_incidente", "Foto sin fecha en las evidencias", "reportes_incidente", { ...reporte, evidencias: [{ tipo: "Foto", url: "https://x.mx/a.jpg" }] }, "121");
probar("reportes_incidente", "idIncidente con formato inválido", "reportes_incidente", { ...reporte, idIncidente: "INCIDENTE-1" }, "121");
probar("reportes_incidente", "INC-0001 repetido (índice único)", "reportes_incidente", { ...reporte, idIncidente: "INC-0001" }, "11000");

// ---------- Datos cargados: cada conteo es de algo que no debería existir ----------
const conteo = (grupo, prueba, n) => resultados.push({ grupo, prueba, esperado: "0", obtenido: String(n), cumple: n === 0 ? "sí" : "NO" });
conteo("datos", "Incidentes activos con fechaFin o cerrados sin ella", db.reportes_incidente.countDocuments({ $or: [{ activo: true, fechaFin: { $exists: true } }, { activo: false, fechaFin: { $exists: false } }] }));
conteo("datos", "Bitácoras con eventos fuera de orden", db.bitacora_envio.countDocuments({ $expr: { $ne: ["$eventos.fecha", { $sortArray: { input: "$eventos.fecha", sortBy: 1 } }] } }));
conteo("datos", "Manifiestos peligrosos que no evitan terracería", db.manifiestos.countDocuments({ tipoCarga: "peligrosa", "restriccionesRuta.evitarTerraceria": { $ne: true } }));
const maxIncidente = db.reportes_incidente.aggregate([{ $group: { _id: null, max: { $max: { $toInt: { $substrCP: ["$idIncidente", 4, 10] } } } } }]).toArray()[0]?.max ?? 0;
conteo("datos", "El contador de incidentes va atrás del número más alto usado", (db.contadores.findOne({ _id: "incidentes" })?.valor ?? 0) >= maxIncidente ? 0 : 1);

// ---------- Resultado ----------
print("\n// Resultado");
for (const r of resultados) {
  print(`${r.cumple.padEnd(3)} ${r.grupo.padEnd(19)} ${r.prueba.padEnd(56)} esperado ${r.esperado.padEnd(9)} obtenido ${r.obtenido}`);
}
print(`${resultados.filter((r) => r.cumple === "sí").length} de ${resultados.length} pruebas cumplen`);
