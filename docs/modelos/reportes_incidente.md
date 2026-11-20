# Modelo documental: reportes_incidente (MongoDB)

Cada documento es el reporte completo de un incidente en la red: dónde pasó, qué tan grave es, el detalle propio de su tipo y las evidencias que se van juntando. Es la fuente de verdad del incidente. En Neo4j solo copiamos `idIncidente`, `gravedad`, `activo` y el punto que bloquea, que es lo que usa el cálculo de rutas.

Lo pusimos en MongoDB por dos razones. Los cuatro tipos de incidente traen datos distintos: un bloqueo tiene causa y carriles cerrados, una obra tiene dependencia y fecha estimada de fin, un derrumbe tiene volumen. En una tabla eso serían muchas columnas vacías o una tabla por tipo. La otra razón son las evidencias, una lista de fotos y testimonios que crece mientras el incidente sigue abierto; en un documento se agregan con `$push` sin tocar lo demás.

Scripts: el validador está en `database/document/validators/reportes_incidente.js`, los datos de ejemplo en `database/document/data/02_reportes_incidente.js` y las consultas en `database/document/queries/01_consultas_incidentes.js`.

## Estructura del documento

```js
{
  idIncidente: "INC-0001",          // único, INC- y al menos 4 dígitos
  tipo: "Obra",                     // Bloqueo | Accidente | Obra | Derrumbe
  idPunto: "07094",                 // clave INEGI de una ciudad o id de una intersección (INT-...)
  tipoPunto: "Ciudad",              // Ciudad | Interseccion, debe coincidir con la forma de idPunto
  gravedad: "Media",                // Baja | Media | Alta
  descripcion: "Repavimentación en la entrada de Teopisca...",
  fechaInicio: ISODate("2026-11-16T13:00:00Z"),
  fechaFin: ISODate(...),           // solo si el incidente ya se cerró
  motivoCierre: "...",              // opcional, al cerrar
  detalle: { ... },                 // depende del tipo, ver abajo
  evidencias: [
    { tipo: "Foto", url: "https://...", autor: "Despacho Tuxtla", fecha: ISODate(...) },
    { tipo: "Testimonio", texto: "...", autor: "Conductor de CHP-1005", fecha: ISODate(...) }
  ],
  activo: true,
  sincronizado: true,               // false mientras el cambio no llega a Neo4j
  reportadoPor: "Despacho Tuxtla",
  creadoEn: ISODate(...),
  actualizadoEn: ISODate(...)       // opcional
}
```

El detalle de cada tipo:

- Bloqueo: `causa` (Manifestación, Retén, Vehículo varado u Otro) y `carrilesCerrados` (al menos 1) son obligatorios; `pasoAlternado` es opcional.
- Accidente: `vehiculosInvolucrados` (al menos 1) y `hayLesionados`; `autoridadEnSitio` es opcional.
- Obra: `dependencia` y `fechaFinEstimada`; `horario` es opcional.
- Derrumbe: `volumenEstimadoM3` y `requiereMaquinaria`.

## Qué exige el validador

La colección se crea con `validationLevel: "strict"` y `validationAction: "error"`, así que MongoDB rechaza cualquier documento que no cumpla, venga o no de la API. El `$jsonSchema` revisa:

- Los campos obligatorios y que no haya campos de más (`additionalProperties: false`).
- Tipos y valores permitidos de cada campo.
- Con un `oneOf`, que el `detalle` tenga exactamente los campos de su tipo. Un bloqueo con el detalle de una obra no entra.
- Que `tipoPunto` corresponda al `idPunto`: 5 dígitos es una ciudad, `INT-` es una intersección. Una estación de tren no puede tener incidentes en este modelo.
- Que un incidente activo no tenga `fechaFin` y uno cerrado sí la tenga.

El backend revisa lo mismo antes de guardar (`backend/src/services/incidentes.reglas.ts`) para responder con un mensaje claro. El validador queda como última barrera; si algo se le escapa al servicio, la API responde 400 con el detalle que da MongoDB.

## Índices

- `idIncidente_unico`: `{ idIncidente: 1 }`, único. Es el identificador del dominio.
- `activos_por_gravedad`: `{ activo: 1, gravedad: 1, fechaInicio: -1 }`. Lista de incidentes activos en la pantalla, del más reciente al más antiguo.
- `por_punto`: `{ idPunto: 1, activo: 1 }`. Historial de un punto de la red.
- `pendientes_de_sincronizar`: `{ sincronizado: 1 }` con `partialFilterExpression: { sincronizado: false }`. Solo indexa los que no han llegado a Neo4j, que deberían ser casi ninguno, y es lo primero que busca la reconciliación.

## Identificadores

Los números salen de la colección `contadores` (`{ _id: "incidentes", valor: 2 }` en los datos de ejemplo) con `findOneAndUpdate` y `$inc`. La operación es atómica, así que dos reportes que llegan al mismo tiempo nunca reciben el mismo número.

## Sincronización con el grafo

1. `POST /incidentes` guarda el documento con `sincronizado: false`.
2. Crea o actualiza el nodo `Incidente` y su arista `BLOQUEA` con `MERGE`.
3. Si Neo4j respondió, marca `sincronizado: true` y contesta 201. Si no, contesta 202 con un aviso: el reporte ya está guardado y el cálculo de rutas lo tomará en cuenta cuando se reconcilie.

Cerrar un incidente sigue los mismos pasos y contesta 200 o 202. No hay una transacción que abarque MongoDB y Neo4j, así que el campo `sincronizado` es lo que nos deja saber qué quedó a medias. La prueba `tests/consistencia/incidente-sin-neo4j.test.ts` apaga Neo4j, reporta un incidente, lo vuelve a encender y comprueba que la reconciliación lo copia.
