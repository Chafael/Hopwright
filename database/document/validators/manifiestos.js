// Colección manifiestos: fuente de verdad de la carga de cada envío.
// El servicio valida que el idEnvio exista en PostgreSQL antes de insertar.

module.exports = {
  coleccion: "manifiestos",
  validador: {
    $jsonSchema: {
      bsonType: "object",
      title: "Manifiesto de carga",
      required: ["idEnvio", "tipoCarga", "articulos", "restriccionesRuta", "creadoEn"],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        idEnvio: { bsonType: "string", pattern: "^E-[0-9]+$" },
        tipoCarga: { enum: ["general", "refrigerada", "peligrosa"] },
        articulos: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["descripcion", "cantidad", "pesoKg"],
            additionalProperties: false,
            properties: {
              descripcion: { bsonType: "string", minLength: 1, maxLength: 200 },
              cantidad: { bsonType: ["int", "long", "double", "decimal"], minimum: 1 },
              pesoKg: { bsonType: ["int", "long", "double", "decimal"], minimum: 0.01 },
            },
          },
        },
        tempMinC: { bsonType: ["int", "long", "double", "decimal"] },
        tempMaxC: { bsonType: ["int", "long", "double", "decimal"] },
        tiempoMaxMin: { bsonType: ["int", "long", "double", "decimal"], minimum: 1 },
        claseUN: { bsonType: ["int", "long"], minimum: 1, maximum: 9 },
        numeroONU: { bsonType: "string", minLength: 1, maxLength: 20 },
        hojaSeguridad: { bsonType: "string", minLength: 1, maxLength: 500 },
        telefonoEmergencia: { bsonType: "string", minLength: 5, maxLength: 30 },
        restriccionesRuta: {
          bsonType: "object",
          required: ["evitarTerraceria", "tiempoMaxMin"],
          additionalProperties: false,
          properties: {
            evitarTerraceria: { bsonType: "bool" },
            tiempoMaxMin: { bsonType: ["int", "long", "double", "decimal", "null"], minimum: 1 },
          },
        },
        creadoEn: { bsonType: "date" },
      },
      allOf: [
        {
          oneOf: [
            {
              properties: { tipoCarga: { enum: ["general"] } },
              not: {
                anyOf: [
                  { required: ["tempMinC"] },
                  { required: ["tempMaxC"] },
                  { required: ["tiempoMaxMin"] },
                  { required: ["claseUN"] },
                  { required: ["numeroONU"] },
                  { required: ["hojaSeguridad"] },
                  { required: ["telefonoEmergencia"] },
                ],
              },
            },
            {
              properties: { tipoCarga: { enum: ["refrigerada"] } },
              required: ["tempMinC", "tempMaxC", "tiempoMaxMin"],
              not: {
                anyOf: [
                  { required: ["claseUN"] },
                  { required: ["numeroONU"] },
                  { required: ["hojaSeguridad"] },
                  { required: ["telefonoEmergencia"] },
                ],
              },
            },
            {
              properties: { tipoCarga: { enum: ["peligrosa"] } },
              required: ["claseUN", "numeroONU", "hojaSeguridad", "telefonoEmergencia"],
              not: {
                anyOf: [
                  { required: ["tempMinC"] },
                  { required: ["tempMaxC"] },
                  { required: ["tiempoMaxMin"] },
                ],
              },
            },
          ],
        },
      ],
    },
  },
  indices: [{ campos: { idEnvio: 1 }, opciones: { unique: true, name: "idEnvio_unico" } }],
};
