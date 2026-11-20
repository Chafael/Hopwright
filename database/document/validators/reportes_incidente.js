// Colección reportes_incidente: el reporte completo de cada incidente en la red.
// Es la fuente de verdad del incidente. En Neo4j solo vive una réplica mínima
// (idIncidente, gravedad, activo y la arista BLOQUEA) para que el cálculo de rutas lo tome en cuenta.
//
// Por qué va en MongoDB: cada tipo de incidente trae un detalle distinto (un bloqueo tiene causa y
// carriles cerrados, una obra tiene dependencia y fecha estimada de fin, etc.) y la lista de
// evidencias crece con el tiempo. Un documento por incidente guarda todo junto y el validador
// exige los campos que corresponden a cada tipo.

const fecha = { bsonType: "date" };
const texto = (min, max) => ({ bsonType: "string", minLength: min, maxLength: max });
const numero = (minimo) => ({ bsonType: ["int", "long", "double", "decimal"], minimum: minimo });
const booleano = { bsonType: "bool" };

// Detalle que exige cada tipo. Se combina con el tipo en un oneOf: el documento tiene que cumplir
// exactamente una de estas opciones.
const detallePorTipo = {
  Bloqueo: {
    required: ["causa", "carrilesCerrados"],
    properties: {
      causa: { enum: ["Manifestación", "Retén", "Vehículo varado", "Otro"] },
      carrilesCerrados: numero(1),
      pasoAlternado: booleano,
    },
  },
  Accidente: {
    required: ["vehiculosInvolucrados", "hayLesionados"],
    properties: {
      vehiculosInvolucrados: numero(1),
      hayLesionados: booleano,
      autoridadEnSitio: booleano,
    },
  },
  Obra: {
    required: ["dependencia", "fechaFinEstimada"],
    properties: {
      dependencia: texto(2, 150),
      fechaFinEstimada: fecha,
      horario: texto(2, 100),
    },
  },
  Derrumbe: {
    required: ["volumenEstimadoM3", "requiereMaquinaria"],
    properties: {
      volumenEstimadoM3: numero(0.1),
      requiereMaquinaria: booleano,
    },
  },
};

module.exports = {
  coleccion: "reportes_incidente",
  validador: {
    $jsonSchema: {
      bsonType: "object",
      title: "Reporte de incidente",
      required: [
        "idIncidente",
        "tipo",
        "idPunto",
        "tipoPunto",
        "gravedad",
        "descripcion",
        "fechaInicio",
        "detalle",
        "evidencias",
        "activo",
        "sincronizado",
        "reportadoPor",
        "creadoEn",
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        idIncidente: { bsonType: "string", pattern: "^INC-[0-9]{4,}$" },
        tipo: { enum: ["Bloqueo", "Accidente", "Obra", "Derrumbe"] },
        // El punto de la red donde ocurre: clave INEGI de una ciudad o id de una intersección
        idPunto: { bsonType: "string", pattern: "^([0-9]{5}|INT-[A-Z0-9]{2,10})$" },
        tipoPunto: { enum: ["Ciudad", "Interseccion"] },
        gravedad: { enum: ["Baja", "Media", "Alta"] },
        descripcion: texto(5, 1000),
        fechaInicio: fecha,
        fechaFin: fecha,
        motivoCierre: texto(2, 500),
        detalle: { bsonType: "object" },
        evidencias: {
          bsonType: "array",
          maxItems: 50,
          items: {
            bsonType: "object",
            required: ["tipo", "fecha"],
            additionalProperties: false,
            properties: {
              tipo: { enum: ["Foto", "Testimonio"] },
              url: texto(5, 500),
              texto: texto(2, 1000),
              autor: texto(2, 150),
              fecha,
            },
          },
        },
        activo: booleano,
        // false mientras el cambio no se ha copiado a Neo4j; la reconciliación busca los que se quedaron así
        sincronizado: booleano,
        reportadoPor: texto(2, 150),
        creadoEn: fecha,
        actualizadoEn: fecha,
      },
      allOf: [
        // El detalle debe corresponder al tipo
        {
          oneOf: Object.entries(detallePorTipo).map(([tipo, esquema]) => ({
            properties: {
              tipo: { enum: [tipo] },
              detalle: { bsonType: "object", additionalProperties: false, ...esquema },
            },
          })),
        },
        // El tipo de punto debe coincidir con la forma del id
        {
          oneOf: [
            { properties: { tipoPunto: { enum: ["Ciudad"] }, idPunto: { pattern: "^[0-9]{5}$" } } },
            { properties: { tipoPunto: { enum: ["Interseccion"] }, idPunto: { pattern: "^INT-" } } },
          ],
        },
        // Un incidente cerrado tiene fecha de fin; uno activo todavía no
        {
          oneOf: [
            { properties: { activo: { enum: [true] } }, not: { required: ["fechaFin"] } },
            { properties: { activo: { enum: [false] } }, required: ["fechaFin"] },
          ],
        },
      ],
    },
  },
  indices: [
    { campos: { idIncidente: 1 }, opciones: { unique: true, name: "idIncidente_unico" } },
    // Listado de incidentes activos por gravedad (pantalla de incidentes y reconciliación)
    { campos: { activo: 1, gravedad: 1, fechaInicio: -1 }, opciones: { name: "activos_por_gravedad" } },
    // Incidentes de un punto de la red
    { campos: { idPunto: 1, activo: 1 }, opciones: { name: "por_punto" } },
    // Solo indexa los pendientes de copiar a Neo4j, que deberían ser muy pocos
    { campos: { sincronizado: 1 }, opciones: { name: "pendientes_de_sincronizar", partialFilterExpression: { sincronizado: false } } },
  ],
};
