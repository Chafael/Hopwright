// Bitácora de seguimiento por envío. Se alimenta desde eventos de PostgreSQL.

module.exports = {
  coleccion: "bitacora_envio",
  validador: {
    $jsonSchema: {
      bsonType: "object",
      title: "Bitácora de envío",
      required: ["idEnvio", "eventos"],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        idEnvio: { bsonType: "string", pattern: "^E-[0-9]+$" },
        eventos: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["tipo", "fecha", "detalle"],
            additionalProperties: false,
            properties: {
              tipo: { bsonType: "string", minLength: 1, maxLength: 80 },
              fecha: { bsonType: "date" },
              detalle: { bsonType: "object" },
            },
          },
        },
      },
    },
  },
  indices: [{ campos: { idEnvio: 1 }, opciones: { unique: true, name: "idEnvio_unico" } }],
};
