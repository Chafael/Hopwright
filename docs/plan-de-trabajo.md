# Hopwright: plan de trabajo y contexto del proyecto

Este documento junta todo lo que hay que saber para trabajar en el proyecto final: qué estamos construyendo, qué pide la guía del profe, qué decisiones ya tomamos, qué está hecho en el repositorio, cómo está organizado el código y qué le toca a cada quien hasta la entrega del 27 de noviembre.

Si vas llegando al proyecto, léelo completo una vez. Después úsalo como referencia.

Documentos relacionados:

- Propuesta completa (Entregable 1): https://claude.ai/artifact/MVyccJ3zmyGNBBCJu2PaqT (si no te abre, pídele a Rafael que te la comparta o que la exporte a PDF).
- Guía del proyecto final: el PDF "Guía del proyecto final de Bases de Datos" que dio el profe.
- Modelo lógico de grafos de la actividad anterior (caso Hopwright): de ahí sale la base de grafos.

---

## 1. Qué es Hopwright

Hopwright es una aplicación para empresas de paquetería regionales en Chiapas que mandan mercancía por carretera y tren.

El problema que resuelve:

- Cuando hay un bloqueo, un derrumbe o una obra en la carretera, nadie sabe rápido qué envíos van a pasar por ahí ni cuál es el camino alterno.
- La asignación de camiones se lleva a mano y a veces el mismo camión queda asignado a dos envíos, o se le asigna una carga más pesada de lo que aguanta.
- Cada tipo de carga tiene requisitos distintos (refrigerada, peligrosa) y esa información queda lejos de la decisión de la ruta.

Usuarios:

- Despachador: registra envíos y su manifiesto de carga, asigna vehículos, pide la ruta de cada envío y consulta qué envíos afecta un incidente.
- Administrador de red: da de alta ciudades, intersecciones, estaciones y tramos con sus pesos, reporta incidentes y administra usuarios.

Los clientes de la paquetería no usan el sistema; sus datos los captura el despachador.

Objetivo: que el despachador asigne vehículos sin conflictos y obtenga para cada envío la ruta más conveniente por tiempo, distancia o costo, respetando los requisitos de la carga y esquivando incidentes activos.

Lo que no se hace (exclusiones que ya pusimos en la propuesta): GPS en tiempo real, pagos o facturación, app para conductores, consulta pública para clientes, mapas visuales, optimizar varios envíos en un mismo viaje y una red nacional real. Usamos una red de ejemplo de unos 30 puntos de Chiapas.

---

## 2. Qué pide la guía (resumen)

El proyecto es una sola aplicación que usa tres bases de datos coordinadas por una API. Lo que más pesa en la evaluación:

1. Que cada base resuelva una necesidad distinta. La prueba del profe es: "si quitamos una base, ¿qué capacidad se pierde?".
2. Que cada dato tenga una fuente de verdad. Si se copia a otra base, hay que documentar cómo se sincroniza.
3. Que una escritura en dos bases que falle a la mitad se detecte y se corrija. Nunca responder "todo bien" si una parte falló.
4. Que todo se pueda construir desde cero con scripts y documentación.
5. Evidencia de ejecución: catálogo de operaciones con casos normales, límite y de error, y pruebas de integración de extremo a extremo.

El profe aclaró que la aplicación se evalúa hasta el punto en que se sirven, consultan, modifican y eliminan datos, y los servicios que eso requiere. El peso está en el backend y la API. La interfaz debe existir y consumir la API, pero puede ser sencilla.

Los 8 entregables de la guía:

1. Propuesta de aplicación. Ya está hecha.
2. Modelado de datos: modelo conceptual común, modelo lógico relacional, modelo documental, modelo de grafos, diccionario de datos y reglas.
3. Arquitectura y selección tecnológica: diagrama, responsabilidades de cada capa, matriz de comparación del stack, fuente de verdad y sincronización.
4. Implementación de las tres bases: scripts de creación y carga, restricciones, índices, consultas y pruebas.
5. Catálogo de operaciones y consultas: cada operación con su propósito, bases que usa, parámetros, validaciones, resultado esperado, casos normales, límite y de error, y evidencia.
6. Backend y API: controladores, servicios y repositorios separados, drivers oficiales, validación, manejo de errores, autorización, consultas parametrizadas, credenciales fuera del código y contrato documentado.
7. Aplicación e integración: interfaz funcional, flujos que usen cada base y al menos un caso integrado que combine varias.
8. Pruebas, documentación y despliegue: pruebas unitarias, de cada base, de integración, funcionales, de errores y consistencia, rendimiento básico, instrucciones de instalación y `.env` de ejemplo.

Errores que la guía dice que hay que evitar: elegir los motores primero e inventar la justificación después, tener bases aisladas, guardar los mismos datos en las tres bases sin fuente de verdad, diagramas sin scripts o scripts sin evidencia, conectar la interfaz directo a las bases, decir que la integración funciona cuando solo se probó cada base por separado, y dejar la documentación y las pruebas para el final.

---

## 3. Para qué sirve cada base

- PostgreSQL (relacional): usuarios, clientes, conductores, vehículos, catálogo de ciudades, envíos y asignaciones. Se justifica porque asignar un vehículo cambia dos registros a la vez, no puede quedar a medias y no puede duplicarse si dos despachadores lo intentan al mismo tiempo. Eso pide transacciones, llaves foráneas y restricciones.
- MongoDB (documental): manifiestos de carga, reportes de incidente y bitácora de seguimiento. Se justifica porque un manifiesto cambia de forma según el tipo de carga (una refrigerada lleva rango de temperatura, una peligrosa lleva clase UN y hoja de seguridad) y un reporte de incidente trae fotos, testimonios y campos distintos según el tipo. En tablas serían muchas columnas vacías.
- Neo4j (grafos): la red de carreteras y vías de tren con pesos (kilómetros, minutos, costo). Se justifica porque la pregunta central es cuál es el mejor camino entre dos puntos sumando pesos por un número de tramos que no se conoce de antemano.

Flujo integrado que demuestra que las tres trabajan juntas (punto 8.1 de la guía), "planear la ruta de un envío":

1. La interfaz pide la ruta de un envío.
2. PostgreSQL da el origen, el destino, el peso y los vehículos disponibles que aguantan ese peso.
3. MongoDB da el manifiesto. Si la carga es peligrosa, la ruta no puede usar terracería; si es refrigerada, hay un tiempo máximo.
4. Neo4j calcula la ruta más rápida que cumple esas condiciones sin pasar por incidentes activos, y cuál vehículo candidato llega antes al origen.
5. El servicio arma una sola respuesta con ruta, minutos, kilómetros, vehículo sugerido y avisos.

---

## 4. Decisiones que ya tomamos

Conviene que los dos las conozcan porque son las que nos pueden preguntar en la defensa.

- Stack del backend: Node.js con Fastify y TypeScript. Separado en controladores, servicios y repositorios, con una carpeta de repositorios por base.
- Contrato de la API con Swagger (OpenAPI). Se genera solo a partir de los esquemas que validan cada ruta, así que la documentación no se puede quedar atrás del código. Se ve en http://localhost:3000/docs. Cubre el punto 7.6 de la guía.
- Las tres bases corren en Docker con `docker-compose.yml`, para que cualquiera las levante con un comando y se creen desde cero con los scripts (punto 7.4).
- Neo4j usa la librería APOC para calcular la ruta más corta con pesos (`apoc.algo.dijkstra`).
- La imagen de Neo4j es la edición Community. Solo permite restricciones de unicidad; las de "propiedad obligatoria" y de tipo son de la versión Enterprise. Por eso las propiedades obligatorias y los valores permitidos del grafo los valida el backend antes de escribir, y los revisan las consultas de `database/graph/tests/`. Si el profe pregunta, esa es la razón.
- Envío ya no está en el grafo. En el modelo lógico de la actividad de Neo4j, Envio era un nodo con SALE_DE, VA_A y TRANSPORTADO_EN. Lo sacamos para no guardar el mismo envío en dos bases. Ahora vive en PostgreSQL y las consultas del grafo reciben origen y destino como parámetros.
- Vehiculo en el grafo solo guarda la placa y su arista SE_ENCUENTRA_EN (la ubicación). Tipo, capacidad y estado viven en PostgreSQL.
- Ciudad en el grafo solo guarda `idCiudad` y `nombre`. El catálogo oficial (clave INEGI, nombre, estado) vive en PostgreSQL.
- Incidente en el grafo es una réplica mínima (id, gravedad, activo, arista BLOQUEA) para que las rutas lo esquiven. El reporte completo vive en MongoDB.
- PostgreSQL de Docker usa el puerto 5433 en tu computadora (dentro del contenedor sigue siendo 5432). Lo cambiamos porque si tienes PostgreSQL instalado en Windows, ese ya ocupa el 5432 y el backend se conecta al equivocado.

### Fuente de verdad de cada dato

- Ciudad (clave INEGI, nombre, estado): fuente PostgreSQL. Se copia `idCiudad` y `nombre` a Neo4j por medio de eventos pendientes.
- Intersecciones, estaciones y tramos: fuente Neo4j. No se copian.
- Cliente, conductor, envío y asignación: fuente PostgreSQL. No se copian.
- Datos del vehículo (placa, tipo, capacidad, estado): fuente PostgreSQL. Se copia solo la placa a Neo4j por eventos pendientes.
- Ubicación del vehículo: fuente Neo4j (es una conexión con la red).
- Manifiesto de carga: fuente MongoDB. Guarda `idEnvio` como referencia; antes de guardarlo se revisa en PostgreSQL que el envío exista.
- Reporte de incidente: fuente MongoDB. Se copia `idIncidente`, `gravedad`, `activo` y la arista BLOQUEA a Neo4j, con el campo `sincronizado`.
- Bitácora de seguimiento: fuente MongoDB. Se escribe a partir de eventos que nacen en PostgreSQL (asignación, salida, entrega).

### Qué pasa si una escritura falla a la mitad

Hay dos mecanismos, según dónde empieza el cambio:

1. Cuando empieza en PostgreSQL (ciudad nueva, vehículo nuevo, asignación): en la misma transacción se guarda un registro en la tabla `eventos_pendientes` (patrón outbox). Si la transacción falla, no queda ni el cambio ni el evento. Si se confirma, un procesador del backend lee los eventos pendientes, los aplica en Neo4j o MongoDB y los marca como aplicados. Si la otra base no responde, el evento sigue pendiente y se reintenta.
2. Cuando empieza en MongoDB (reporte de incidente): se guarda el documento con `sincronizado: false`, se crea el bloqueo en Neo4j y, si funciona, se marca `sincronizado: true`. Si Neo4j falla, la API responde 202 con un aviso de que el reporte se guardó pero el bloqueo todavía no se aplica.

Además habrá un endpoint de reconciliación que compara cada fuente con su réplica y corrige lo que falte o sobre. La prueba de consistencia se hace apagando Neo4j a propósito durante una escritura.

---

## 5. Lo que ya está hecho

Repositorio: https://github.com/Chafael/Hopwright

### Estructura del repositorio

Es la estructura que propone la guía en el punto 10:

```
hopwright/
  .env.example           variables de entorno de ejemplo (copiar a .env)
  .gitignore             excluye .env, node_modules, dist
  .gitattributes         obliga saltos de línea LF en .sh, .sql, .cypher y .js
  docker-compose.yml     levanta PostgreSQL, MongoDB, Neo4j y el cargador del grafo
  README.md              cómo levantar el proyecto
  docs/
    plan-de-trabajo.md   este documento
    modelos/             modelos conceptual, relacional, documental y de grafos (Entregable 2)
    api/                 contrato de la API y catálogo de operaciones
    pruebas/             reportes y evidencias de pruebas
  database/
    relational/
      init.sh            corre schema/*.sql y luego data/*.sql la primera vez
      schema/            .sql de creación (tablas, llaves, restricciones, índices)
      data/              .sql de datos de prueba
      queries/           consultas representativas
    document/
      init/01_init.js    crea cada colección con su validador y carga los datos
      validators/        un .js por colección: { coleccion, validador, indices }
      data/              un .js por colección: { coleccion, documentos }
      queries/           consultas representativas
    graph/
      load.sh            corre schema/*.cypher y luego data/*.cypher
      schema/01_restricciones.cypher   restricciones de unicidad e índices
      data/              red de ejemplo de Chiapas
      queries/           consultas Cypher del catálogo
      tests/             consultas que verifican integridad y cardinalidades
  backend/
    package.json         scripts: dev, build, start, typecheck, test
    tsconfig.json
    src/
      index.ts           arranca el servidor y cierra conexiones con Ctrl+C
      server.ts          construye la app: Swagger, manejo de errores, rutas
      config/env.ts      lee y valida las variables del .env
      db/postgres.ts     pool de conexiones y helper enTransaccion()
      db/mongo.ts        cliente de MongoDB y función mongoDb()
      db/neo4j.ts        driver de Neo4j
      plugins/swagger.ts registra Swagger y la interfaz en /docs
      controllers/       rutas HTTP con sus esquemas
      services/          reglas de negocio y coordinación entre bases
      repositories/
        relational/      consultas a PostgreSQL
        document/        consultas a MongoDB
        graph/           consultas a Neo4j
  frontend/              interfaz web (por hacer)
  tests/
    unit/  integration/  e2e/
```

### Cómo funciona lo que ya existe

- `docker-compose.yml` levanta cuatro contenedores. `hopwright-postgres`, `hopwright-mongo` y `hopwright-neo4j` son las bases. `hopwright-neo4j-init` espera a que Neo4j esté listo, corre los scripts del grafo y termina; es normal que aparezca como detenido. Neo4j no tiene carpeta de inicio automática como PostgreSQL o MongoDB, por eso existe ese contenedor.
- Los scripts de carga solo corren la primera vez que se crea cada volumen. Para cargar de nuevo desde cero: `docker compose down -v` y luego `docker compose up -d`. Ojo: `down -v` borra todos los datos.
- El backend lee el `.env` de la raíz del proyecto, el mismo que usa Docker, para que las credenciales sean las mismas.
- `GET /health` revisa las tres bases al mismo tiempo y responde 200 si las tres contestan o 503 si alguna falla, con el tiempo y el error de cada una. Es la prueba de conectividad del punto 9 de la guía. Ya se probó con las tres bases en verde.
- Todos los errores salen con la misma forma: `{ "error": "...", "mensaje": "...", "statusCode": 400 }`. Una ruta que no existe responde 404 con ese formato.
- `db/postgres.ts` trae `enTransaccion(trabajo)`: abre una transacción, ejecuta lo que le pases y hace COMMIT, o ROLLBACK si algo lanza un error. Úsenlo para cualquier operación que toque más de una tabla.
- `db/neo4j.ts` crea el driver con `disableLosslessIntegers: true`, así los enteros de Neo4j llegan como números normales de JavaScript.

### Cómo levantar el proyecto

Necesitas Docker Desktop abierto y Node.js 22 o superior.

```
cd C:\Dev\hopwright
Copy-Item .env.example .env
docker compose up -d
docker compose ps
cd backend
npm install
npm run dev
```

Después abre http://localhost:3000/docs, ejecuta `GET /health` y debe responder 200.

### Problemas que ya nos pasaron y cómo se arreglan

- `failed to connect to the docker API ... dockerDesktopLinuxEngine`: Docker Desktop no está abierto. Ábrelo y espera a que diga "Engine running".
- `/health` responde 503 con PostgreSQL en error: tienes PostgreSQL instalado en Windows en el puerto 5432. El `.env.example` ya usa 5433; revisa que tu `.env` también. Si MongoDB choca, cambia `MONGO_PORT` a 27018.
- `EADDRINUSE ... :3000`: ya hay otro backend corriendo. Ciérralo con `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess -Force`.
- Cambiaste el `.env` y no pasa nada: `tsx watch` solo recarga cuando cambia el código. Detén el servidor con Ctrl+C y corre `npm run dev` otra vez.
- Ves "Documentaci├│n" en la consola: es la codificación de la terminal de Windows. Corre `chcp 65001` o usa la terminal de VS Code.
- Aviso de `esbuild` al hacer `npm install`: no afecta. Si molesta, `npm install-scripts approve esbuild`.

---

## 6. Cómo se escribe código en este proyecto

Para que las dos partes se vean igual y se puedan juntar sin pelear:

### Capas

- Controlador (`controllers/`): define la ruta, su esquema de entrada y de respuesta, y llama al servicio. No tiene lógica de negocio ni consultas.
- Servicio (`services/`): aplica las reglas de negocio y coordina las bases. Es el único lugar donde una operación puede tocar más de una base.
- Repositorio (`repositories/<base>/`): solo consultas a su base. Un repositorio de PostgreSQL nunca llama a Neo4j, y al revés.

La interfaz nunca se conecta directo a una base, solo a la API.

### Cómo agregar una ruta

1. En el repositorio, escribe la consulta con parámetros. Nunca concatenes valores en el texto de la consulta.
   - PostgreSQL: `pool.query("SELECT * FROM envio WHERE id_envio = $1", [idEnvio])`
   - MongoDB: los filtros ya son objetos, solo no armes filtros a partir de texto que mande el usuario sin validar.
   - Neo4j: `sesion.executeRead(tx => tx.run("MATCH (c:Ciudad {idCiudad: $id}) RETURN c", { id }))`. Usa `executeRead` para lecturas y `executeWrite` para escrituras; reintentan solos si hay un fallo temporal. Cierra siempre la sesión en un `finally`.
2. En el servicio, aplica las reglas (por ejemplo, "el peso no puede pasar la capacidad") y lanza un error con `statusCode` si algo no se cumple.
3. En el controlador, registra la ruta con su `schema` completo: `body`, `params` o `querystring`, y `response` con los códigos de éxito y de error. Ponle `tags` y `summary` para que se vea ordenada en Swagger.
4. Registra el controlador en `server.ts`.
5. Agrega su prueba en `tests/` y su entrada en el catálogo de operaciones.

### Nombres

- Código y comentarios en español, como lo que ya existe (`revisarSalud`, `enTransaccion`, `pingNeo4j`).
- Tablas y columnas de PostgreSQL en `snake_case`: `id_envio`, `capacidad_kg`.
- Campos de MongoDB y propiedades de Neo4j en `camelCase`: `idEnvio`, `tiempoMin`.
- Etiquetas de Neo4j en `PascalCase` (`Ciudad`, `Interseccion`) y relaciones en mayúsculas (`CARRETERA`, `VIA_FERREA`).
- Rutas de la API en plural y minúsculas: `/envios`, `/vehiculos/{placa}`, `/incidentes`.

### Git

- Cada quien trabaja en su rama: `feature/<lo-que-hace>`, por ejemplo `feature/rutas-grafo` o `feature/asignacion-vehiculo`.
- Antes de unir a `main`, el otro revisa el Pull Request. Así los dos conocen el código del otro, que es justo lo que nos van a preguntar.
- Antes de hacer push: `npm run typecheck` y `npm test` sin errores.
- Nunca se sube el `.env`.

---

## 7. Modelo de datos acordado (preliminar)

Esto es el punto de partida para el Entregable 2 y para los scripts. Si algo cambia al hacer el modelo formal, se actualiza aquí y se avisa al otro.

### PostgreSQL

- `usuario`: `id_usuario` (PK), `nombre`, `correo` (único), `password_hash`, `rol` (`despachador` o `administrador`), `activo`, `creado_en`.
- `cliente`: `id_cliente` (PK), `razon_social`, `rfc` (único), `telefono`, `correo`.
- `conductor`: `id_conductor` (PK), `nombre`, `licencia` (única), `telefono`, `activo`.
- `ciudad`: `id_ciudad` (PK, clave de municipio del INEGI, texto), `nombre`, `estado`.
- `vehiculo`: `placa` (PK), `tipo` (`Camión`, `Tráiler`, `Tren`), `capacidad_kg` (mayor que 0), `estado` (`Disponible`, `En ruta`, `En taller`), `id_conductor` (FK, puede ser nulo).
- `envio`: `id_envio` (PK, texto tipo `E-102`), `id_cliente` (FK), `id_ciudad_origen` (FK), `id_ciudad_destino` (FK, distinta del origen), `peso_kg` (mayor que 0), `prioridad` (`Normal`, `Urgente`), `estado` (`Pendiente`, `Asignado`, `En camino`, `Entregado`, `Cancelado`), `fecha_salida`, `creado_en`.
- `asignacion`: `id_asignacion` (PK), `id_envio` (FK), `placa` (FK), `fecha_asignacion`, `fecha_fin` (nula mientras está activa), `activa`. Un vehículo solo puede tener una asignación activa a la vez, y un envío también: se garantiza con índices únicos parciales (`WHERE activa`). Con el tiempo un vehículo acumula muchas asignaciones; lo que no puede es tener dos al mismo tiempo, porque optimizar varios envíos en un viaje está fuera del alcance.
- `eventos_pendientes`: `id` (PK), `tipo`, `payload` (JSONB), `estado` (`pendiente`, `aplicado`, `fallido`), `intentos`, `ultimo_error`, `creado_en`, `aplicado_en`.

### MongoDB

- `manifiestos`: `idEnvio`, `tipoCarga` (`general`, `refrigerada`, `peligrosa`), `articulos` (lista de `{ descripcion, cantidad, pesoKg }`), y según el tipo:
  - `refrigerada`: `{ tempMinC, tempMaxC, tiempoMaxMin }`
  - `peligrosa`: `{ claseUN (1 a 9), numeroONU, hojaSeguridad, telefonoEmergencia }`
  - además `restriccionesRuta: { evitarTerraceria, tiempoMaxMin }`, que es lo que lee el flujo integrado, y `creadoEn`.
- `reportes_incidente`: `idIncidente`, `tipo` (`Bloqueo`, `Accidente`, `Obra`, `Derrumbe`), `idPunto` y `tipoPunto` (`Ciudad` o `Interseccion`), `gravedad` (`Baja`, `Media`, `Alta`), `descripcion`, `fechaInicio`, `fechaFin` (opcional), `evidencias` (lista de fotos o testimonios), un objeto con el detalle propio de cada tipo, `activo`, `sincronizado`, `reportadoPor`.
- `bitacora_envio`: un documento por envío con `idEnvio` y `eventos` (lista de `{ tipo, fecha, detalle }`).

### Neo4j

- Nodos: `Ciudad {idCiudad, nombre}`, `Interseccion {idInterseccion, nombre, tipo, latitud, longitud}`, `Estacion {idEstacion, nombre, tipoServicio}`, `Incidente {idIncidente, gravedad, activo}`, `Vehiculo {placa}`.
- Relaciones: `CARRETERA {distanciaKm, tiempoMin, costoCaseta, tipoVia, abierto}` entre ciudades e intersecciones, una por sentido; `VIA_FERREA {distanciaKm, tiempoMin, costoPorTonelada}` entre estaciones; `UBICADA_EN {tiempoCambioMin}` de estación a ciudad; `BLOQUEA` de incidente a ciudad o intersección; `SE_ENCUENTRA_EN {fechaHora}` de vehículo a ciudad, intersección o estación.

### Identificadores compartidos

Para que las bases se puedan cruzar sin confusiones, estos identificadores son los mismos en todas:

- Ciudad: la clave INEGI, en texto (`"07101"` es Tuxtla Gutiérrez). En PostgreSQL es `id_ciudad`; en Neo4j, `idCiudad`.
- Vehículo: la placa, en mayúsculas y sin espacios.
- Envío: texto con prefijo, por ejemplo `E-102`.
- Incidente: texto con prefijo, por ejemplo `INC-0007`.

Datos de prueba que ya existen en la red de ejemplo (`database/graph/data/`). Los datos de prueba de PostgreSQL y MongoDB deben usar exactamente estos:

- Ciudades (22, con su clave INEGI): 07101 Tuxtla Gutiérrez, 07027 Chiapa de Corzo, 07078 San Cristóbal de las Casas, 07019 Comitán de Domínguez, 07094 Teopisca, 07059 Ocosingo, 07065 Palenque, 07012 Berriozábal, 07061 Ocozocoautla de Espinosa, 07046 Jiquipilas, 07017 Cintalapa, 07009 Arriaga, 07097 Tonalá, 07069 Pijijiapan, 07051 Mapastepec, 07040 Huixtla, 07089 Tapachula, 07086 Suchiapa, 07108 Villaflores, 07099 La Trinitaria, 07057 Motozintla, 07068 Pichucalco. Conviene confirmar las claves contra el catálogo del INEGI; si alguna está mal, se corrige en los dos lados.
- Vehículos y dónde están: `CHP-1001` y `CHP-1002` en Tuxtla, `CHP-1003` en Tapachula, `CHP-1004` en Arriaga, `CHP-1005` en San Cristóbal, `CHP-1006` en Comitán y `TREN-01` en la Estación Arriaga. En PostgreSQL el compañero les pone tipo y capacidad (sugerencia: 1001, 1003 y 1006 camiones de 8,000 kg; 1002 y 1004 tráileres de 25,000 kg; 1005 camión de 3,500 kg; TREN-01 tren de 60,000 kg).
- Incidentes: `INC-0001` (obra en Teopisca, gravedad Media, activo) e `INC-0002` (derrumbe en la Glorieta Frontera Comalapa, gravedad Alta, ya cerrado). Sus reportes completos van en MongoDB.

---

## 8. Reparto del trabajo

Repartimos por funcionalidades completas y no por capas. Cada quien trabaja con las tres bases y su módulo va de punta a punta: script, repositorio, servicio, endpoint, prueba y documentación. Así, en la defensa, cualquiera de los dos puede explicar cómo se usan las tres bases.

Lo que ya está hecho (esqueleto, Docker, conexiones, Swagger, `/health` y la propuesta) no cuenta en este reparto. Lo que falta se divide parejo.

### Antes de empezar: base común (ya está hecha)

Tres piezas pequeñas que usan las dos partes. Ya están en el repositorio:

- Clases de error comunes (`NoEncontrado` 404, `Conflicto` 409, `DatosInvalidos` 400) y un esquema `Error` compartido para documentarlas en Swagger.
- `@fastify/cors`, para que la interfaz pueda llamar a la API.
- Configuración de Vitest para correr pruebas contra la app con `app.inject()`.

Cómo usarlas:

- En un servicio: `throw new NoEncontrado("El envío E-999 no existe")` o `throw new Conflicto("El vehículo ya tiene una asignación activa")`. Están en `backend/src/errores.ts`. El manejador global las convierte en la respuesta con el código correcto.
- En el esquema de una ruta: `response: { 200: miRespuesta, ...respuestasError(400, 404, 409) }`, de `backend/src/schemas/comunes.ts`. Ahí también está `esquemaIdCiudad`.
- Si una base no responde, la API ya contesta 503 sola; no hay que manejarlo en cada ruta.
- Para Neo4j hay helpers en `backend/src/db/neo4j.ts`: `leer(cypher, params)` y `escribir(cypher, params)`. Si un procedimiento pide un entero, usa `entero(n)`.
- Pruebas: van en `tests/unit/` o `tests/integration/` con nombre `*.test.ts`. `describe`, `it` y `expect` están disponibles sin importarlos. Se corren desde `backend/` con `npm test`. Ver `tests/integration/rutas.test.ts` como ejemplo con `app.inject()`.

### Rafael: red, rutas e incidentes

Base de grafos:

- [x] `database/graph/data/`: red de ejemplo de Chiapas con unos 30 puntos (ciudades, intersecciones y estaciones) y sus tramos con distancia, tiempo y costo. Cada tramo de doble sentido va como dos aristas.
- [x] `database/graph/tests/`: consultas que verifican que no haya tramos con peso menor o igual a cero, tramos duplicados, puntos sin tramos, ni CARRETERA o VIA_FERREA entre tipos de nodo equivocados.
- [x] `repositories/graph/`: consultas de ruta (Dijkstra con APOC), ciudades aisladas y vecinos de un punto.
- [x] Endpoints de la red para el administrador: alta y cambio de intersecciones, estaciones y tramos (`POST /red/tramos`, `PATCH /red/tramos/...`), validando los pesos en el servicio porque Neo4j Community no puede hacerlo solo.
- [x] `GET /rutas?origen=&destino=&criterio=tiempo|distancia|costo` (consulta C1).
- [x] `GET /rutas/camion-tren?origen=&destino=` que compara la ruta solo en camión contra la que usa tren (consulta C2).
- [x] `GET /red/ciudades-aisladas?punto=` (consulta C4).
- [ ] `PATCH /vehiculos/{placa}/ubicacion`: mueve el vehículo en el grafo (SE_ENCUENTRA_EN).

Base documental:

- [ ] `database/document/validators/reportes_incidente.js` con `$jsonSchema`, campos obligatorios según el tipo de incidente e índices.
- [ ] `database/document/data/`: algunos reportes de ejemplo.
- [ ] `POST /incidentes`, `GET /incidentes`, `GET /incidentes/{id}`, `PATCH /incidentes/{id}/cerrar`.

Integración entre bases:

- [ ] Sincronización incidente hacia grafo: guardar en Mongo con `sincronizado: false`, crear Incidente y BLOQUEA en Neo4j, marcar `sincronizado: true`; si Neo4j falla, responder 202 con aviso.
- [ ] `POST /admin/reconciliar`: compara incidentes activos de Mongo contra Neo4j, y ciudades y vehículos de PostgreSQL contra Neo4j; corrige lo que falte o sobre y regresa un resumen.
- [ ] `GET /incidentes/{id}/envios-afectados` (consulta C5): toma los envíos en camino de PostgreSQL, revisa en el grafo si su ruta pasa por el punto bloqueado y calcula los minutos extra del desvío.
- [ ] La parte de grafo del flujo integrado: una función de servicio `calcularRutaConRestricciones({ origen, destino, criterio, evitarTerraceria, tiempoMaxMin, candidatos })` que regresa ruta, minutos, kilómetros y el vehículo candidato que llega antes.

Pruebas y documentación de su parte:

- [ ] Pruebas de rutas sobre una red pequeña cuyo resultado se conoce, ruta con un punto bloqueado, ruta imposible y documentos de incidente válidos e inválidos.
- [ ] Prueba de consistencia: apagar Neo4j (`docker stop hopwright-neo4j`), reportar un incidente, comprobar el 202 y `sincronizado: false`, encender Neo4j, reconciliar y comprobar que el bloqueo aparece.
- [ ] Modelo de grafos y modelo de `reportes_incidente` en `docs/modelos/`, y sus operaciones en el catálogo.
- [ ] Pantallas de la interfaz: ruta de un envío e incidentes.

### Compañero: envíos, flota y usuarios

Base relacional:

- [ ] `database/relational/schema/`: tablas de la sección 7 con llaves primarias y foráneas, `CHECK`, `UNIQUE`, `NOT NULL`, los índices únicos parciales de `asignacion` y los índices que usen las consultas.
- [ ] `database/relational/data/`: datos de prueba coherentes con la red del grafo (las mismas claves INEGI de ciudades), con clientes, conductores, vehículos de distintos tipos y capacidades, y envíos en distintos estados.
- [ ] `database/relational/queries/`: consultas representativas.
- [ ] CRUD con validación: `/clientes`, `/conductores`, `/vehiculos`, `/ciudades`, `/envios`.
- [ ] `POST /envios/{id}/asignacion`: asignación en una transacción con `enTransaccion()` y `SELECT ... FOR UPDATE`. Revisa que el vehículo esté Disponible, que aguante el peso y que ni el vehículo ni el envío tengan otra asignación activa; cambia los estados y guarda la asignación.
- [ ] Estados del envío: `POST /envios/{id}/salida` y `POST /envios/{id}/entrega`.

Base documental:

- [ ] `database/document/validators/manifiestos.js` con `$jsonSchema` que exija los campos según `tipoCarga`, y `bitacora_envio.js`.
- [ ] `database/document/data/`: manifiestos de los tres tipos para los envíos de prueba.
- [ ] `POST /envios/{id}/manifiesto` (revisa en PostgreSQL que el envío exista), `GET /envios/{id}/manifiesto`, `GET /envios/{id}/bitacora`.

Integración entre bases:

- [ ] Que crear o cambiar una ciudad o un vehículo, y crear una asignación o cambiar el estado de un envío, guarde su evento en `eventos_pendientes` dentro de la misma transacción.
- [ ] Procesador de eventos pendientes: cada pocos segundos lee los eventos pendientes, los aplica (ciudad o vehículo en Neo4j con `MERGE`, eventos del envío en `bitacora_envio`), los marca como aplicados o suma un intento y guarda el error. Que se pueda correr dos veces el mismo evento sin duplicar nada.
- [ ] La parte relacional y documental del flujo integrado: una función de servicio `obtenerDatosParaRuta(idEnvio)` que regresa origen, destino, peso, placas de vehículos candidatos y las restricciones del manifiesto.

Autenticación:

- [ ] `POST /auth/login` con `@fastify/jwt` y contraseñas con `bcrypt`.
- [ ] Un `preHandler` tipo `requiereRol("administrador")` y aplicarlo a las rutas que correspondan.

Pruebas y documentación de su parte:

- [ ] Pruebas de llaves y `CHECK` (que la base rechace datos inválidos), de dos asignaciones simultáneas al mismo vehículo (solo una debe pasar) y de manifiestos válidos e inválidos por tipo.
- [ ] Prueba del outbox: apagar Neo4j, crear un vehículo, comprobar que el evento queda pendiente, encender Neo4j y comprobar que se aplica.
- [ ] Modelo relacional y modelos de `manifiestos` y `bitacora_envio` en `docs/modelos/`, y sus operaciones en el catálogo.
- [ ] Pantallas de la interfaz: envíos (lista, alta, manifiesto) y asignación de vehículo.

### Entre los dos

- [ ] Modelo conceptual común del dominio (Entregable 2).
- [ ] `GET /envios/{id}/ruta`, el flujo integrado: une `obtenerDatosParaRuta` del compañero con `calcularRutaConRestricciones` de Rafael y arma una sola respuesta con avisos. La prueba de extremo a extremo de este flujo la hacen juntos.
- [ ] Decidir el framework de la interfaz (que los dos lo conozcan) y armar su base: navegación y cliente de la API.
- [ ] Documento de arquitectura y matriz de comparación del stack (Entregable 3).
- [ ] Prueba de rendimiento básica de los flujos principales, anotando el equipo y la cantidad de datos.
- [ ] README final, evidencias en `docs/pruebas/` y ensayo de la demostración.

---

## 9. Contrato entre las dos partes

Para que cada quien avance sin esperar al otro, estas son las piezas que se conectan y la forma que deben tener. Si alguien necesita cambiarlas, lo avisa antes.

`obtenerDatosParaRuta(idEnvio)` (compañero) regresa:

```ts
{
  idEnvio: string;
  origen: string;          // clave INEGI
  destino: string;         // clave INEGI
  pesoKg: number;
  candidatos: string[];    // placas de vehículos Disponibles con capacidad suficiente
  restricciones: {
    evitarTerraceria: boolean;
    tiempoMaxMin: number | null;
  };
  avisos: string[];        // por ejemplo "El envío no tiene manifiesto"
}
```

`calcularRutaConRestricciones(entrada)` (Rafael) recibe:

```ts
{
  origen: string;
  destino: string;
  criterio: "tiempo" | "distancia" | "costo";
  evitarTerraceria: boolean;
  tiempoMaxMin: number | null;
  candidatos: string[];
}
```

y regresa:

```ts
{
  ruta: { idPunto: string; nombre: string }[];
  minutos: number;
  kilometros: number;
  costo: number;
  vehiculoSugerido: { placa: string; minutosAlOrigen: number } | null;
  avisos: string[];        // por ejemplo "No hay ruta que cumpla las restricciones"
}
```

Tipos de evento en `eventos_pendientes` (los escribe el compañero; los que van a Neo4j deben coincidir con lo que espera la reconciliación de Rafael):

- `CIUDAD_GUARDADA` con `{ idCiudad, nombre }` hacia Neo4j.
- `VEHICULO_GUARDADO` con `{ placa }` hacia Neo4j.
- `ASIGNACION_CREADA` con `{ idEnvio, placa, fecha }` hacia la bitácora.
- `ENVIO_SALIO` y `ENVIO_ENTREGADO` con `{ idEnvio, fecha }` hacia la bitácora.

---

## 10. Calendario

- 20 de noviembre: entrega del avance (propuesta, matriz de responsabilidades, fuente de verdad). Base común lista en el repositorio.
- 21 y 22: modelos de cada parte en `docs/modelos/`, modelo conceptual común y scripts de las tres bases cargando con `docker compose up -d`.
- 23 y 24: endpoints, servicios y repositorios de cada parte, el flujo integrado y el catálogo de operaciones.
- 25: interfaz web.
- 26: pruebas de integración, errores, consistencia y rendimiento; README final y evidencias.
- 27: entrega y demostración.

Al final de cada día, cada quien sube su rama y revisa el Pull Request del otro.

---

## 11. Lista de revisión antes de entregar

Es la lista del punto 11 de la guía. El proyecto está completo cuando se puede comprobar todo esto:

- [ ] La aplicación resuelve un problema delimitado y tiene usuarios y operaciones identificables.
- [ ] El uso de los tres modelos está justificado por necesidades distintas y concretas.
- [ ] Los modelos de datos son coherentes entre sí y con el dominio.
- [ ] Las tres bases se crean y cargan de forma reproducible (`docker compose down -v` y `up -d` desde cero).
- [ ] Cada base tiene consultas y pruebas que demuestran su función.
- [ ] El backend accede a las tres bases con componentes separados y contratos definidos.
- [ ] La interfaz consume el backend y no accede directo a las bases.
- [ ] Hay al menos un flujo integrado que demuestra la coordinación entre bases.
- [ ] Los errores y los problemas de consistencia se reconocen y se manejan.
- [ ] La documentación permite instalar, configurar y ejecutar la solución.
