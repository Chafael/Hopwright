# Entregable 6. Backend y API

El backend está en `backend/` y es una API REST hecha con Fastify 5 y TypeScript. Es la única pieza que habla con las bases: la interfaz web solo conoce la dirección de la API. La razón de usar REST y no GraphQL está en [decisiones-tecnologicas.md](decisiones-tecnologicas.md), sección 3.1.

## 1. Organización del código

```
backend/src/
  index.ts          arranca el servidor
  server.ts         registra plugins, rutas y el manejador de errores
  config/env.ts     lee el .env y falla si falta una variable obligatoria
  db/               una conexión por motor: postgres.ts, mongo.ts, neo4j.ts
  plugins/          auth.ts (JWT y roles) y swagger.ts (contrato OpenAPI)
  schemas/          esquemas JSON compartidos (errores, identificadores)
  controllers/      una archivo por recurso: rutas HTTP con su esquema
  services/         reglas de negocio y coordinación entre bases
  repositories/
    relational/     consultas SQL (PostgreSQL)
    document/       operaciones de MongoDB
    graph/          consultas Cypher (Neo4j)
  errores.ts        errores propios (400, 401, 403, 404, 409, 503)
```

Cada capa tiene una sola tarea. Un controlador recibe la petición ya validada, llama a un servicio y responde. Un servicio decide qué hacer y en qué orden, y nunca escribe una consulta. Un repositorio hace una consulta y regresa objetos del dominio. Así, cuando una operación necesita varias bases, la coordinación queda en un solo lugar: el servicio.

## 2. Conexión a las bases

Se usan los drivers oficiales de cada motor: `pg` para PostgreSQL, `mongodb` para MongoDB y `neo4j-driver` para Neo4j. Cada conexión se abre una vez al arrancar y se cierra cuando el servidor se detiene. `postgres.ts` ofrece además `enTransaccion`, que le pasa el mismo cliente a todos los repositorios que participan, para que una asignación o una entrega queden en un solo `BEGIN ... COMMIT`.

Las credenciales salen del `.env` de la raíz, el mismo que usa Docker Compose para crear las bases. El repositorio solo trae `.env.example`, con valores de ejemplo.

Todas las consultas son parametrizadas: `$1`, `$2` en SQL, `$origen`, `$placa` en Cypher y filtros como objetos en MongoDB. Ningún valor que llega en la petición se pega dentro del texto de una consulta.

## 3. Rutas

Son 36 rutas en 11 grupos. Las marcadas con candado piden sesión.

| Grupo | Rutas |
|---|---|
| Salud | `GET /health` |
| Autenticación | `POST /auth/login` |
| Clientes | `GET /clientes`, `GET /clientes/{id}`, `POST` 🔒, `PUT` 🔒, `DELETE` 🔒 |
| Conductores | `GET /conductores`, `GET /conductores/{id}`, `POST` 🔒, `PUT` 🔒, `DELETE` 🔒 |
| Ciudades | `GET /ciudades`, `POST /ciudades` 🔒 |
| Vehículos | `GET /vehiculos`, `GET /vehiculos/{placa}`, `POST` 🔒, `PATCH` 🔒, `GET` y `PATCH /vehiculos/{placa}/ubicacion` 🔒 |
| Envíos | `GET /envios`, `GET /envios/{id}`, `POST /envios` 🔒, `/asignacion` 🔒, `/salida` 🔒, `/entrega` 🔒, `/cancelacion` 🔒, `GET` y `POST /manifiesto` 🔒, `GET /bitacora`, `GET /datos-ruta`, `GET /ruta` |
| Red | `GET /red/puntos`, `GET /red/mapa`, `GET /red/ciudades-aisladas`, `POST` y `DELETE /red/intersecciones` 🔒, `POST /red/estaciones` 🔒, `POST`, `PATCH` y `DELETE /red/tramos` 🔒 |
| Rutas | `GET /rutas`, `GET /rutas/camion-tren`, `GET /rutas/exploracion` |
| Incidentes | `GET /incidentes`, `GET /incidentes/{id}`, `POST /incidentes` 🔒, `PATCH /incidentes/{id}/cerrar` 🔒, `POST /incidentes/{id}/evidencias` 🔒, `GET /incidentes/{id}/envios-afectados` |
| Administración | `POST /admin/reconciliar` 🔒 |

El detalle de cada una, con sus casos normales, límite y de error, está en el [catálogo de operaciones](catalogo-operaciones.md).

## 4. Validación de entradas

La entrada se revisa en tres niveles:

1. Fastify valida cuerpo, parámetros y query con el JSON Schema que declara cada ruta: tipos, campos obligatorios, formatos (`E-<dígitos>`, clave INEGI de 5 dígitos, `INC-####`), rangos y valores permitidos. Lo que no cumple se rechaza con 400 antes de llegar al servicio, y `additionalProperties: false` impide mandar campos de más.
2. El servicio revisa las reglas de negocio que necesitan consultar datos: que el cliente y las ciudades existan, que el vehículo esté disponible y aguante el peso, que el envío esté en el estado correcto para la transición, que el detalle de un incidente corresponda a su tipo.
3. Cada base tiene su última barrera: `CHECK`, llaves foráneas e índices únicos en PostgreSQL, el validador `$jsonSchema` en MongoDB y las restricciones de unicidad en Neo4j.

## 5. Manejo de errores

Todos los errores salen con la misma forma, para que la interfaz los muestre igual:

```json
{ "error": "Conflicto", "mensaje": "El vehículo no está disponible", "statusCode": 409 }
```

| Situación | Código |
|---|---|
| Datos con formato o valores inválidos, o que no cumplen el esquema de MongoDB (código 121) | 400 |
| Sin token o con token inválido | 401 |
| Rol que no alcanza para la operación | 403 |
| Recurso que no existe | 404 |
| Duplicado (llave única 23505 en PostgreSQL u 11000 en MongoDB) o transición de estado no permitida | 409 |
| Escritura guardada en su fuente de verdad, pero la réplica en Neo4j no respondió | 202 con aviso |
| Una base no responde | 503 |

Un error inesperado responde 500 con un mensaje genérico y queda en el log; no se manda al cliente el detalle interno.

## 6. Autorización

`POST /auth/login` revisa el correo y la contraseña contra el hash bcrypt guardado en PostgreSQL y regresa un JWT con el id, el rol y el correo. Si el correo no existe o la contraseña está mal, el mensaje es el mismo, para no revelar qué correos están registrados.

Las consultas son públicas. Las escrituras pasan por `requiereRol`, que verifica el token y el rol:

- Despachador o administrador: envíos y su ciclo, manifiestos, clientes, conductores, incidentes y mover vehículos.
- Solo administrador: ciudades, vehículos, cambios a la red, borrar clientes y conductores, y la reconciliación.

## 7. Contrato de la API

El contrato es OpenAPI 3 y sale de los mismos esquemas que validan cada ruta, así que no se puede desfasar del código:

- Con el backend corriendo: Swagger en `http://localhost:3000/docs`, donde se puede iniciar sesión con el botón "Authorize" y probar cada ruta.
- Sin levantar nada: [api/openapi.json](api/openapi.json), que se regenera con `npm run openapi`.

Cada ruta trae sus ejemplos y la lista de códigos de respuesta posibles. [api/envios-flota-usuarios.md](api/envios-flota-usuarios.md) resume las rutas de envíos, flota y usuarios.

## 8. Coordinación entre bases

El backend no usa transacciones distribuidas. Cuando una operación toca más de una base, el dato oficial se escribe primero en su fuente de verdad y la copia se propaga después:

- Lo que nace en PostgreSQL deja un evento en `eventos_pendientes`, dentro de la misma transacción. Un procesador dentro del backend los aplica en MongoDB y Neo4j cada 5 segundos y los reintenta hasta 5 veces si fallan.
- Un incidente se guarda en MongoDB con `sincronizado: false`, se copia a Neo4j y se marca `true`. Si Neo4j no responde, la API contesta 202 y la copia queda pendiente.
- `POST /admin/reconciliar` compara cada réplica con su fuente y corrige lo que se haya quedado atrás.

El detalle, con diagramas, está en [arquitectura.md](arquitectura.md), secciones 5 a 8.
