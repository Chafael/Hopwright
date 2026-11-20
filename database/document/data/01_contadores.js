// Contadores para generar identificadores con prefijo (INC-0003, INC-0004, ...).
// El backend los incrementa con findOneAndUpdate y $inc, que es atómico: dos reportes que
// llegan al mismo tiempo nunca reciben el mismo número.
// El valor es el último número usado; los datos de ejemplo ya ocupan INC-0001 e INC-0002.

module.exports = {
  coleccion: "contadores",
  documentos: [{ _id: "incidentes", valor: 2 }],
};
