# Evidencia de la implementación de las bases

Generado por `npm run bases:desde-cero` (tests/implementacion/evidencia.mts) el 27/11/2026, 6:34:39 p.m., commit `86880b8`. Cada sección es la salida tal cual de un script de `database/` corrido dentro de su contenedor.

Antes de correr las pruebas se borraron los volúmenes y las tres bases se construyeron desde cero con los scripts del repositorio.

## Resumen

- PostgreSQL, pruebas de humo, integridad, cardinalidad y transacciones: 27 de 27 pruebas cumplen.
- PostgreSQL, consultas representativas: las 11 corrieron sin error.
- MongoDB, pruebas de humo, documentos válidos e inválidos e índices: 35 de 35 pruebas cumplen.
- MongoDB, 01_consultas_incidentes.js: corrió sin error.
- MongoDB, 02_consultas_manifiestos.js: corrió sin error.
- MongoDB, 03_consultas_bitacora.js: corrió sin error.
- Neo4j, prueba de humo: corrió sin error.
- Neo4j, pruebas de integridad y cardinalidad: 14 de 14 pruebas sin fallas.
- Neo4j, consultas representativas: corrieron sin error.

## Construcción desde cero

Archivo: `Se borraron los volúmenes y se levantaron los contenedores. Cada uno corrió sus scripts de esquema y datos en orden.`. Comando: `docker compose down -v && docker compose up -d`. Código de salida 0, 46565 ms.

```text
$ docker compose down -v

$ docker compose up -d


$ docker logs hopwright-postgres (líneas de la carga)
Ejecutando /hopwright/relational/schema/01_tablas.sql
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
Ejecutando /hopwright/relational/data/01_datos.sql
INSERT 0 124
INSERT 0 2
INSERT 0 4
INSERT 0 4
INSERT 0 7
INSERT 0 8
INSERT 0 4

$ docker logs hopwright-mongo (líneas de la carga)
Creando colección bitacora_envio
Creando colección manifiestos
Creando colección reportes_incidente
Cargando 1 documentos en contadores
Cargando 2 documentos en reportes_incidente
Cargando 2 documentos en bitacora_envio
Cargando 6 documentos en manifiestos

$ docker logs hopwright-neo4j-init
Ejecutando /hopwright/graph/schema/01_restricciones.cypher
Ejecutando /hopwright/graph/data/01_red_chiapas.cypher
Ejecutando /hopwright/graph/data/02_vehiculos.cypher
Ejecutando /hopwright/graph/data/03_incidentes.cypher
Base de grafos lista
```

## PostgreSQL: pruebas de humo, integridad, cardinalidad y transacciones

Archivo: `database/relational/tests/01_integridad.sql`. Comando: `docker exec -i hopwright-postgres psql -U <usuario> -d <base> < database/relational/tests/01_integridad.sql`. Código de salida 0, 170 ms. Resultado: 27 de 27 pruebas cumplen.

```text
tabla        | filas 
--------------------+-------
 usuario            |     2
 cliente            |     4
 conductor          |     4
 ciudad             |   124
 vehiculo           |     7
 envio              |     8
 asignacion         |     4
 eventos_pendientes |     0
(8 rows)

CREATE TABLE
CREATE FUNCTION
DO
DO
INSERT 0 5
    grupo     |                                prueba                                 |                          esperado                           |                                                      obtenido                                                      | cumple 
--------------+-----------------------------------------------------------------------+-------------------------------------------------------------+--------------------------------------------------------------------------------------------------------------------+--------
 integridad   | Llave primaria: ciudad repetida                                       | 23505                                                       | 23505 duplicate key value violates unique constraint "ciudad_pkey"                                                 | sí
 integridad   | CHECK: clave INEGI de 4 dígitos                                       | 23514                                                       | 23514 new row for relation "ciudad" violates check constraint "ciudad_id_ciudad_check"                             | sí
 integridad   | UNIQUE: RFC repetido                                                  | 23505                                                       | 23505 duplicate key value violates unique constraint "cliente_rfc_key"                                             | sí
 integridad   | NOT NULL: cliente sin razón social                                    | 23502                                                       | 23502 null value in column "razon_social" of relation "cliente" violates not-null constraint                       | sí
 integridad   | UNIQUE: licencia de conductor repetida                                | 23505                                                       | 23505 duplicate key value violates unique constraint "conductor_licencia_key"                                      | sí
 integridad   | CHECK: tipo de vehículo no permitido                                  | 23514                                                       | 23514 new row for relation "vehiculo" violates check constraint "vehiculo_tipo_check"                              | sí
 integridad   | CHECK: capacidad de 0 kg                                              | 23514                                                       | 23514 new row for relation "vehiculo" violates check constraint "vehiculo_capacidad_kg_check"                      | sí
 integridad   | Llave foránea: conductor que no existe                                | 23503                                                       | 23503 insert or update on table "vehiculo" violates foreign key constraint "vehiculo_id_conductor_fkey"            | sí
 integridad   | Llave foránea: cliente que no existe                                  | 23503                                                       | 23503 insert or update on table "envio" violates foreign key constraint "envio_id_cliente_fkey"                    | sí
 integridad   | Llave foránea: ciudad que no existe                                   | 23503                                                       | 23503 insert or update on table "envio" violates foreign key constraint "envio_id_ciudad_destino_fkey"             | sí
 integridad   | CHECK: origen igual al destino                                        | 23514                                                       | 23514 new row for relation "envio" violates check constraint "envio_check"                                         | sí
 integridad   | CHECK: peso de 0 kg                                                   | 23514                                                       | 23514 new row for relation "envio" violates check constraint "envio_peso_kg_check"                                 | sí
 integridad   | CHECK: identificador de envío sin formato E-número                    | 23514                                                       | 23514 new row for relation "envio" violates check constraint "envio_id_envio_check"                                | sí
 integridad   | CHECK: estado de envío no permitido                                   | 23514                                                       | 23514 new row for relation "envio" violates check constraint "envio_estado_check"                                  | sí
 integridad   | Llave foránea: borrar un cliente que tiene envíos                     | 23503                                                       | 23503 update or delete on table "cliente" violates foreign key constraint "envio_id_cliente_fkey" on table "envio" | sí
 integridad   | CHECK: tipo de evento no permitido                                    | 23514                                                       | 23514 new row for relation "eventos_pendientes" violates check constraint "eventos_pendientes_tipo_check"          | sí
 cardinalidad | Un envío no puede tener dos asignaciones activas                      | 23505                                                       | 23505 duplicate key value violates unique constraint "asignacion_envio_activa_idx"                                 | sí
 cardinalidad | Un vehículo no puede tener dos asignaciones activas                   | 23505                                                       | 23505 duplicate key value violates unique constraint "asignacion_vehiculo_activa_idx"                              | sí
 cardinalidad | Un envío sí puede tener varias asignaciones cerradas                  | sin error                                                   | sin error                                                                                                          | sí
 transacción  | Si falla el evento, la asignación y los cambios de estado se deshacen | 23514; E-101 Pendiente, CHP-1006 Disponible, 0 asignaciones | 23514; E-101 Pendiente, CHP-1006 Disponible, 0 asignaciones                                                        | sí
 transacción  | Los cuatro cambios de una asignación se aplican juntos                | E-101 Asignado, CHP-1006 En ruta, 1 evento                  | E-101 Asignado, CHP-1006 En ruta, 1 evento                                                                         | sí
 transacción  | Al deshacerla, todo regresa como estaba                               | E-101 Pendiente, CHP-1006 Disponible                        | E-101 Pendiente, CHP-1006 Disponible                                                                               | sí
 datos        | Envíos Asignado o En camino sin asignación activa                     | 0                                                           | 0                                                                                                                  | sí
 datos        | Envíos Pendiente, Entregado o Cancelado con asignación activa         | 0                                                           | 0                                                                                                                  | sí
 datos        | Vehículos con asignación activa que no están En ruta                  | 0                                                           | 0                                                                                                                  | sí
 datos        | Asignaciones activas con un vehículo que no aguanta el peso           | 0                                                           | 0                                                                                                                  | sí
 datos        | Asignaciones cerradas sin fecha de fin                                | 0                                                           | 0                                                                                                                  | sí
(27 rows)

 cumplen | pruebas 
---------+---------
      27 |      27
(1 row)
```

## PostgreSQL: consultas representativas

Archivo: `database/relational/queries/consultas.sql`. Comando: `docker exec -i hopwright-postgres psql -U <usuario> -d <base> < database/relational/queries/consultas.sql`. Código de salida 0, 136 ms.

```text
id_envio |             cliente              |  ciudad_origen   |       ciudad_destino       | peso_kg | prioridad |  estado   
----------+----------------------------------+------------------+----------------------------+---------+-----------+-----------
 E-106    | Farmacéutica Maya SA de CV       | Cintalapa        | Tonalá                     | 1500.00 | Urgente   | Pendiente
 E-101    | Alimentos del Soconusco SA de CV | Tuxtla Gutiérrez | San Cristóbal de las Casas | 1200.00 | Normal    | Pendiente
 E-103    | Químicos Chiapas SA de CV        | Tuxtla Gutiérrez | Comitán de Domínguez       | 3000.00 | Normal    | Pendiente
(3 rows)

  placa   |  tipo   | capacidad_kg |   estado   
----------+---------+--------------+------------
 CHP-1006 | Camión  |      8000.00 | Disponible
 CHP-1002 | Tráiler |     25000.00 | Disponible
 TREN-01  | Tren    |     60000.00 | Disponible
(3 rows)

 id_asignacion | id_envio |    fecha_asignacion    | fecha_fin | activa | estado_envio 
---------------+----------+------------------------+-----------+--------+--------------
             1 | E-102    | 2026-11-20 14:15:00+00 |           | t      | Asignado
(1 row)

 id_envio |      fecha_salida      |  placa   |  tipo  | capacidad_kg |  conductor   
----------+------------------------+----------+--------+--------------+--------------
 E-104    | 2026-11-20 15:00:00+00 | CHP-1003 | Camión |      8000.00 | José Ramírez
(1 row)

           razon_social           | por_salir | en_camino | entregados | cancelados | kg_movidos 
----------------------------------+-----------+-----------+------------+------------+------------
 Alimentos del Soconusco SA de CV |         1 |         0 |          1 |          0 |    8200.00
 Químicos Chiapas SA de CV        |         2 |         0 |          0 |          0 |    5200.00
 Comercial del Sureste SA de CV   |         0 |         1 |          0 |          1 |    5000.00
 Farmacéutica Maya SA de CV       |         2 |         0 |          0 |          0 |    2400.00
(4 rows)

  tipo   |   estado   | vehiculos | capacidad_total_kg 
---------+------------+-----------+--------------------
 Camión  | Disponible |         1 |            8000.00
 Camión  | En ruta    |         3 |           19500.00
 Tráiler | Disponible |         1 |           25000.00
 Tráiler | En taller  |         1 |           25000.00
 Tren    | Disponible |         1 |           60000.00
(5 rows)

 id_ciudad |           nombre           | salen | llegan 
-----------+----------------------------+-------+--------
 07101     | Tuxtla Gutiérrez           |     2 |      2
 07065     | Palenque                   |     1 |      1
 07078     | San Cristóbal de las Casas |     1 |      1
 07089     | Tapachula                  |     1 |      1
 07009     | Arriaga                    |     0 |      1
 07017     | Cintalapa                  |     1 |      0
 07019     | Comitán de Domínguez       |     0 |      1
 07059     | Ocosingo                   |     1 |      0
 07097     | Tonalá                     |     0 |      1
 07108     | Villaflores                |     1 |      0
(10 rows)

 id_envio |      fecha_salida      |      entregado_en      | horas 
----------+------------------------+------------------------+-------
 E-105    | 2026-11-19 13:00:00+00 | 2026-11-20 00:00:00+00 |  11.0
(1 row)

 tipo | estado | eventos | max_intentos | ultimo_error 
------+--------+---------+--------------+--------------
(0 rows)

 id_conductor | nombre | licencia 
--------------+--------+----------
(0 rows)

                                  QUERY PLAN                                   
-------------------------------------------------------------------------------
 Bitmap Heap Scan on envio  (cost=4.16..9.50 rows=2 width=32)
   Recheck Cond: (estado = 'Pendiente'::text)
   ->  Bitmap Index Scan on envio_estado_idx  (cost=0.00..4.16 rows=2 width=0)
         Index Cond: (estado = 'Pendiente'::text)
(4 rows)
```

## MongoDB: pruebas de humo, documentos válidos e inválidos

Archivo: `database/document/tests/01_validacion.js`. Comando: `docker exec hopwright-mongo mongosh -u <usuario> -p <contraseña> --authenticationDatabase admin <base> --quiet --file 01_validacion.js`. Código de salida 0, 779 ms. Resultado: 35 de 35 pruebas cumplen.

```text
// Colecciones, validador, índices y documentos
[
  {
    coleccion: 'bitacora_envio',
    validador: 'strict/error',
    indices: [
      '_id_',
      'idEnvio_unico'
    ],
    documentos: 2
  },
  {
    coleccion: 'contadores',
    validador: 'sin validador',
    indices: [
      '_id_'
    ],
    documentos: 1
  },
  {
    coleccion: 'manifiestos',
    validador: 'strict/error',
    indices: [
      '_id_',
      'idEnvio_unico'
    ],
    documentos: 6
  },
  {
    coleccion: 'reportes_incidente',
    validador: 'strict/error',
    indices: [
      '_id_',
      'idIncidente_unico',
      'activos_por_gravedad',
      'por_punto',
      'pendientes_de_sincronizar'
    ],
    documentos: 2
  }
]

// Resultado
sí  manifiestos         Carga general válida                                     esperado aceptado  obtenido aceptado
sí  manifiestos         Carga refrigerada válida                                 esperado aceptado  obtenido aceptado
sí  manifiestos         Carga peligrosa válida                                   esperado aceptado  obtenido aceptado
sí  manifiestos         Peligrosa con claseUN 9 (límite superior)                esperado aceptado  obtenido aceptado
sí  manifiestos         Peligrosa con claseUN 10                                 esperado 121       obtenido 121
sí  manifiestos         Peligrosa sin numeroONU                                  esperado 121       obtenido 121
sí  manifiestos         Refrigerada sin tiempoMaxMin                             esperado 121       obtenido 121
sí  manifiestos         General con temperatura (campo de otro tipo)             esperado 121       obtenido 121
sí  manifiestos         Tipo de carga que no existe                              esperado 121       obtenido 121
sí  manifiestos         Sin artículos                                            esperado 121       obtenido 121
sí  manifiestos         Artículo con cantidad 0                                  esperado 121       obtenido 121
sí  manifiestos         idEnvio sin formato E-número                             esperado 121       obtenido 121
sí  manifiestos         Campo que no está en el esquema                          esperado 121       obtenido 121
sí  manifiestos         Segundo manifiesto de E-101 (índice único)               esperado 11000     obtenido 11000
sí  bitacora_envio      Bitácora válida                                          esperado aceptado  obtenido aceptado
sí  bitacora_envio      Bitácora vacía (envío sin eventos todavía)               esperado aceptado  obtenido aceptado
sí  bitacora_envio      Evento con la fecha como texto                           esperado 121       obtenido 121
sí  bitacora_envio      Evento sin detalle                                       esperado 121       obtenido 121
sí  bitacora_envio      Segunda bitácora de E-105 (índice único)                 esperado 11000     obtenido 11000
sí  reportes_incidente  Bloqueo válido                                           esperado aceptado  obtenido aceptado
sí  reportes_incidente  Derrumbe válido en una ciudad                            esperado aceptado  obtenido aceptado
sí  reportes_incidente  Cerrado con fecha de fin                                 esperado aceptado  obtenido aceptado
sí  reportes_incidente  Bloqueo con el detalle de un derrumbe                    esperado 121       obtenido 121
sí  reportes_incidente  Bloqueo sin carriles cerrados                            esperado 121       obtenido 121
sí  reportes_incidente  Gravedad que no existe                                   esperado 121       obtenido 121
sí  reportes_incidente  tipoPunto Ciudad con un id de intersección               esperado 121       obtenido 121
sí  reportes_incidente  Activo pero con fecha de fin                             esperado 121       obtenido 121
sí  reportes_incidente  Cerrado sin fecha de fin                                 esperado 121       obtenido 121
sí  reportes_incidente  Foto sin fecha en las evidencias                         esperado 121       obtenido 121
sí  reportes_incidente  idIncidente con formato inválido                         esperado 121       obtenido 121
sí  reportes_incidente  INC-0001 repetido (índice único)                         esperado 11000     obtenido 11000
sí  datos               Incidentes activos con fechaFin o cerrados sin ella      esperado 0         obtenido 0
sí  datos               Bitácoras con eventos fuera de orden                     esperado 0         obtenido 0
sí  datos               Manifiestos peligrosos que no evitan terracería          esperado 0         obtenido 0
sí  datos               El contador de incidentes va atrás del número más alto usado esperado 0         obtenido 0
35 de 35 pruebas cumplen
```

## MongoDB: consultas incidentes

Archivo: `database/document/queries/01_consultas_incidentes.js`. Comando: `docker exec hopwright-mongo mongosh ... --quiet --file 01_consultas_incidentes.js`. Código de salida 0, 693 ms.

```text
// 1. Incidentes activos de gravedad Alta
[]

// 2. Incidentes de Teopisca (07094)
[
  {
    idIncidente: 'INC-0001',
    tipo: 'Obra',
    gravedad: 'Media',
    activo: true
  }
]

// 3. Reportes pendientes de copiar a Neo4j
[]

// 4. Incidentes por tipo y gravedad
[
  {
    _id: {
      tipo: 'Derrumbe',
      gravedad: 'Alta'
    },
    total: 1,
    activos: 0,
    horasPromedio: 59
  },
  {
    _id: {
      tipo: 'Obra',
      gravedad: 'Media'
    },
    total: 1,
    activos: 1,
    horasPromedio: null
  }
]

// 5. Obras activas y cuándo deberían terminar
[
  {
    idIncidente: 'INC-0001',
    idPunto: '07094',
    detalle: {
      dependencia: 'Obras Públicas del Estado de Chiapas',
      fechaFinEstimada: ISODate('2026-12-06T00:00:00.000Z')
    }
  }
]

// 6. $push de una evidencia a INC-0001 (y se quita al final)
{
  acknowledged: true,
  insertedId: null,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0
}
evidencias ahora: 3

// 7. Contador atómico con findOneAndUpdate y $inc
{
  _id: 'ejemplo',
  valor: 1
}
{
  _id: 'ejemplo',
  valor: 2
}

// 8. Plan de ejecución de la consulta 1
{
  etapas: [
    'FETCH',
    'IXSCAN (activos_por_gravedad)'
  ],
  documentosRevisados: 0,
  regresados: 0
}
```

## MongoDB: consultas manifiestos

Archivo: `database/document/queries/02_consultas_manifiestos.js`. Comando: `docker exec hopwright-mongo mongosh ... --quiet --file 02_consultas_manifiestos.js`. Código de salida 0, 670 ms.

```text
// 1. Manifiesto de E-103
{
  idEnvio: 'E-103',
  tipoCarga: 'peligrosa',
  articulos: [
    {
      descripcion: 'Solvente industrial',
      cantidad: 10,
      pesoKg: 200
    },
    {
      descripcion: 'Aditivo químico',
      cantidad: 5,
      pesoKg: 200
    }
  ],
  claseUN: 3,
  numeroONU: 'UN1993',
  hojaSeguridad: 'https://docs.hopwright.local/hs-e103.pdf',
  telefonoEmergencia: '9615550103',
  restriccionesRuta: {
    evitarTerraceria: true,
    tiempoMaxMin: null
  },
  creadoEn: ISODate('2026-11-20T14:25:00.000Z')
}

// 2. Cargas peligrosas
[
  {
    idEnvio: 'E-103',
    claseUN: 3,
    numeroONU: 'UN1993',
    telefonoEmergencia: '9615550103'
  },
  {
    idEnvio: 'E-107',
    claseUN: 9,
    numeroONU: 'UN3480',
    telefonoEmergencia: '9615550107'
  }
]

// 3. Cargas refrigeradas
[
  {
    idEnvio: 'E-106',
    tempMinC: 1,
    tempMaxC: 6,
    tiempoMaxMin: 240
  },
  {
    idEnvio: 'E-102',
    tempMinC: 2,
    tempMaxC: 8,
    tiempoMaxMin: 480
  }
]

// 4. Peso declarado por manifiesto
[
  {
    _id: 'E-101',
    tipoCarga: 'general',
    articulos: 2,
    piezas: 30,
    pesoDeclaradoKg: 1200
  },
  {
    _id: 'E-102',
    tipoCarga: 'refrigerada',
    articulos: 2,
    piezas: 45,
    pesoDeclaradoKg: 900
  },
  {
    _id: 'E-103',
    tipoCarga: 'peligrosa',
    articulos: 2,
    piezas: 15,
    pesoDeclaradoKg: 3000
  },
  {
    _id: 'E-104',
    tipoCarga: 'general',
    articulos: 1,
    piezas: 50,
    pesoDeclaradoKg: 5000
  },
  {
    _id: 'E-106',
    tipoCarga: 'refrigerada',
    articulos: 1,
    piezas: 60,
    pesoDeclaradoKg: 1500
  },
  {
    _id: 'E-107',
    tipoCarga: 'peligrosa',
    articulos: 1,
    piezas: 40,
    pesoDeclaradoKg: 2200
  }
]

// 5. Manifiestos por tipo de carga
[
  {
    _id: 'general',
    manifiestos: 2,
    evitanTerraceria: 0
  },
  {
    _id: 'peligrosa',
    manifiestos: 2,
    evitanTerraceria: 2
  },
  {
    _id: 'refrigerada',
    manifiestos: 2,
    evitanTerraceria: 0
  }
]

// 6. Envíos que llevan solvente
[
  {
    idEnvio: 'E-103',
    articulos: [
      {
        descripcion: 'Solvente industrial'
      },
      {
        descripcion: 'Aditivo químico'
      }
    ]
  }
]

// 7. Plan de ejecución de la consulta 1
{
  etapas: [
    'FETCH',
    'IXSCAN (idEnvio_unico)'
  ],
  documentosRevisados: 1,
  regresados: 1
}
```

## MongoDB: consultas bitacora

Archivo: `database/document/queries/03_consultas_bitacora.js`. Comando: `docker exec hopwright-mongo mongosh ... --quiet --file 03_consultas_bitacora.js`. Código de salida 0, 669 ms.

```text
// 1. Bitácora de E-105
{
  idEnvio: 'E-105',
  eventos: [
    {
      tipo: 'ASIGNACION_CREADA',
      fecha: ISODate('2026-11-19T12:30:00.000Z'),
      detalle: {
        idEnvio: 'E-105',
        placa: 'CHP-1002'
      }
    },
    {
      tipo: 'ENVIO_SALIO',
      fecha: ISODate('2026-11-19T13:00:00.000Z'),
      detalle: {
        idEnvio: 'E-105',
        fecha: '2026-11-19T07:00:00-06:00'
      }
    },
    {
      tipo: 'ENVIO_ENTREGADO',
      fecha: ISODate('2026-11-20T00:00:00.000Z'),
      detalle: {
        idEnvio: 'E-105',
        fecha: '2026-11-19T18:00:00-06:00'
      }
    }
  ]
}

// 2. Último evento de cada envío
[
  {
    idEnvio: 'E-104',
    eventos: 2,
    ultimoTipo: 'ENVIO_SALIO',
    ultimaFecha: ISODate('2026-11-20T15:00:00.000Z')
  },
  {
    idEnvio: 'E-105',
    eventos: 3,
    ultimoTipo: 'ENVIO_ENTREGADO',
    ultimaFecha: ISODate('2026-11-20T00:00:00.000Z')
  }
]

// 3. Eventos por tipo
[
  {
    _id: 'ASIGNACION_CREADA',
    total: 2
  },
  {
    _id: 'ENVIO_ENTREGADO',
    total: 1
  },
  {
    _id: 'ENVIO_SALIO',
    total: 2
  }
]

// 4. Horas de la salida a la entrega
[
  {
    idEnvio: 'E-105',
    horas: Long('11')
  }
]

// 5. $push idempotente y ordenado (envío de ejemplo E-999901)
ENVIO_SALIO agregado: 1
ASIGNACION_CREADA (llega tarde, con fecha anterior) agregado: 1
ENVIO_SALIO repetido (reintento) agregado: 0
{
  eventos: [
    {
      tipo: 'ASIGNACION_CREADA'
    },
    {
      tipo: 'ENVIO_SALIO'
    }
  ]
}
```

## Neo4j: prueba de humo

Archivo: `database/graph/tests/00_humo.cypher`. Comando: `docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> < database/graph/tests/00_humo.cypher`. Código de salida 0, 2749 ms.

```text
etiqueta, nodos
"Ciudad", 124
"Estacion", 5
"Incidente", 2
"Interseccion", 9
"Vehiculo", 7
relacion, aristas
"BLOQUEA", 2
"CARRETERA", 666
"SE_ENCUENTRA_EN", 7
"UBICADA_EN", 5
"VIA_FERREA", 8
name, labelsOrTypes, properties, type
"ciudad_id", ["Ciudad"], ["idCiudad"], "UNIQUENESS"
"estacion_id", ["Estacion"], ["idEstacion"], "UNIQUENESS"
"estacion_nombre", ["Estacion"], ["nombre"], "UNIQUENESS"
"incidente_id", ["Incidente"], ["idIncidente"], "UNIQUENESS"
"interseccion_id", ["Interseccion"], ["idInterseccion"], "UNIQUENESS"
"vehiculo_placa", ["Vehiculo"], ["placa"], "UNIQUENESS"
name, labelsOrTypes, properties, type
"ciudad_id", ["Ciudad"], ["idCiudad"], "RANGE"
"ciudad_nombre", ["Ciudad"], ["nombre"], "RANGE"
"estacion_id", ["Estacion"], ["idEstacion"], "RANGE"
"estacion_nombre", ["Estacion"], ["nombre"], "RANGE"
"incidente_activo", ["Incidente"], ["activo"], "RANGE"
"incidente_id", ["Incidente"], ["idIncidente"], "RANGE"
"interseccion_id", ["Interseccion"], ["idInterseccion"], "RANGE"
"vehiculo_placa", ["Vehiculo"], ["placa"], "RANGE"
ciudadesConClave07101
1
```

## Neo4j: pruebas de integridad y cardinalidad

Archivo: `database/graph/tests/01_integridad.cypher`. Comando: `docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> < database/graph/tests/01_integridad.cypher`. Código de salida 0, 3159 ms. Resultado: 14 de 14 pruebas sin fallas.

```text
prueba, fallas
"R3 nodos con propiedades obligatorias vacías", 0
prueba, fallas
"R4 tramos sin distancia o tiempo", 0
prueba, fallas
"R5 pesos en cero o negativos", 0
prueba, fallas
"R6 nodos con valores no permitidos", 0
prueba, fallas
"R6 carreteras con tipoVia no permitido", 0
prueba, fallas
"R12 CARRETERA entre nodos equivocados", 0
prueba, fallas
"R12 VIA_FERREA entre nodos equivocados", 0
prueba, fallas
"R2 tramos duplicados", 0
prueba, fallas
"R14 tramos sin vuelta", 0
prueba, fallas
"R15 velocidades imposibles", 0
prueba, fallas
"Cardinalidad puntos aislados", 0
prueba, fallas
"Cardinalidad estaciones sin ciudad o con varias", 0
prueba, fallas
"Cardinalidad incidentes que no bloquean un solo punto", 0
prueba, fallas
"Cardinalidad vehículos sin ubicación o con varias", 0
```

## Neo4j: consultas representativas

Archivo: `database/graph/queries/01_consultas_rutas.cypher, con origen Tuxtla (07101) y destino Arriaga (07009)`. Comando: `docker exec -i hopwright-neo4j cypher-shell -u <usuario> -p <contraseña> -P "{origen: '07101', destino: '07009'}" < database/graph/queries/01_consultas_rutas.cypher`. Código de salida 0, 2560 ms.

```text
ruta, minutos
["Tuxtla Gutiérrez", "Ocozocoautla de Espinosa", "Arriaga"], 122.0
estaciones, minutos, costoPorTonelada
["Estación Arriaga", "Estación Tonalá", "Estación Pijijiapan", "Estación Huixtla", "Estación Tapachula"], 340.0, 138.0
hacia, km, minutos, via, caseta
"Chiapa de Corzo", 18.1, 21, "Estatal", 0.0
"Caseta Chiapa de Corzo", 20.0, 25, "Federal", 0.0
"San Fernando", 20.9, 26, "Federal", 0.0
"Berriozábal", 22.0, 26, "Estatal", 0.0
"Suchiapa", 21.2, 31, "Estatal", 0.0
"Ocozocoautla de Espinosa", 33.1, 33, "Federal", 0.0
"Entronque Ocozocoautla", 30.7, 34, "Federal", 0.0
"Jiquipilas", 69.2, 68, "Federal", 0.0
incidente, gravedad, punto
"INC-0001", "Media", "Teopisca"
placa, lugar, tipo, desde
"CHP-1001", "Tuxtla Gutiérrez", "Ciudad", 2026-11-20T08:00-06:00
"CHP-1002", "Tuxtla Gutiérrez", "Ciudad", 2026-11-20T08:00-06:00
"CHP-1003", "Tapachula", "Ciudad", 2026-11-20T08:00-06:00
"CHP-1004", "Arriaga", "Ciudad", 2026-11-20T08:00-06:00
"CHP-1005", "San Cristóbal de las Casas", "Ciudad", 2026-11-20T08:00-06:00
"CHP-1006", "Comitán de Domínguez", "Ciudad", 2026-11-20T08:00-06:00
"TREN-01", "Estación Arriaga", "Estacion", 2026-11-20T08:00-06:00
```
