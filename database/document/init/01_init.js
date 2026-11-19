// Lo ejecuta el contenedor de MongoDB la primera vez que se crea el volumen.
// Crea cada colección con su validador ($jsonSchema) y después carga los datos de prueba.
// Cada archivo de validators/ exporta { coleccion, validador, indices }.
// Cada archivo de data/ exporta { coleccion, documentos }.
const fs = require("fs");
const path = require("path");

const base = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || "hopwright");

function archivosJs(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(carpeta, f));
}

for (const archivo of archivosJs("/hopwright/validators")) {
  const { coleccion, validador, indices = [] } = require(archivo);
  print(`Creando colección ${coleccion}`);
  base.createCollection(coleccion, { validator: validador, validationLevel: "strict", validationAction: "error" });
  for (const indice of indices) base.getCollection(coleccion).createIndex(indice.campos, indice.opciones || {});
}

for (const archivo of archivosJs("/hopwright/data")) {
  const { coleccion, documentos } = require(archivo);
  print(`Cargando ${documentos.length} documentos en ${coleccion}`);
  base.getCollection(coleccion).insertMany(documentos);
}
