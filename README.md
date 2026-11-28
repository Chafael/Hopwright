# Hopwright

Aplicación para empresas de paquetería del sureste de México. Asigna vehículos a envíos sin conflictos y calcula la ruta más conveniente para cada envío por carretera y tren, esquivando bloqueos y respetando los requisitos de la carga.

Proyecto final de Bases de Datos en la Nube, Universidad Politécnica de Chiapas. Usa tres bases de datos coordinadas por una sola API:

- PostgreSQL: envíos, vehículos, asignaciones y catálogos (datos transaccionales).
- MongoDB: manifiestos de carga, reportes de incidente y bitácora de seguimiento (documentos con estructura variable).
- Neo4j: red de carreteras y vías de tren con pesos (rutas y recorridos).

La documentación de cada entregable está en `docs/` (ver [Documentación](#documentación)).

## Requisitos

- Docker Desktop (para las tres bases)
- Node.js 22 o superior

## Cómo levantar el proyecto

1. Copia el archivo de variables y cambia las contraseñas:

   ```bash
   cp .env.example .env
   ```

   En Windows (PowerShell): `Copy-Item .env.example .env`

2. Levanta las tres bases. La primera vez se crean los esquemas y se cargan los datos de prueba:

   ```bash
   docker compose up -d
   ```

   El contenedor `hopwright-neo4j-init` corre los scripts del grafo y termina solo. Para ver que todo cargó bien: `docker compose logs neo4j-init`.

3. Instala y arranca el backend:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. Abre la documentación de la API en http://localhost:3000/docs y prueba `GET /health`. Si las tres bases están arriba, responde `"estado": "ok"`.

Para empezar desde cero (borra todos los datos): `docker compose down -v` y luego `docker compose up -d`. Con `npm run bases:desde-cero` (desde `backend/`) se hace lo mismo y además se corren las pruebas de cada base; el detalle de los scripts está en `docs/implementacion.md`.

### Usuarios de prueba

Las consultas no piden sesión; todo lo que cambia datos pide un token. Se obtiene con `POST /auth/login` (en la interfaz, con "Iniciar sesión") y en Swagger se pega en el botón "Authorize".

- Despachador: `despacho@hopwright.local`, contraseña `hopwright123`. Puede registrar envíos y su manifiesto, asignarlos, marcar salida, entrega o cancelación, dar de alta clientes y conductores, reportar y cerrar incidentes y mover vehículos en el mapa.
- Administrador: `admin@hopwright.local`, contraseña `hopwright123`. Puede hacer lo mismo que el despachador y además dar de alta ciudades y vehículos, cambiar la red (intersecciones, estaciones y tramos), borrar clientes y conductores y sincronizar las bases.

Son contraseñas solo para la demostración; el hash está en `database/relational/data/01_datos.sql`.

## Interfaz web

La interfaz está en `frontend/` (SvelteKit en modo estático, Tailwind, Flowbite y MapLibre con el mapa Positron de OpenFreeMap). Solo habla con la API, nunca con las bases. Con el backend corriendo en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Se abre en http://localhost:5173. Si la API no está en `http://localhost:3000`, copia `frontend/.env.example` como `frontend/.env` y cambia `VITE_API_URL`.

Pantallas:

- Entrar: inicio de sesión como despachador o administrador. Sin sesión se puede consultar todo, pero no cambiar datos.
- Envíos: lista con filtro por estado, alta de envío, y el detalle de cada uno con su manifiesto, la ruta planeada (flujo integrado de las tres bases), la asignación de vehículo, la salida, la entrega, la cancelación y la bitácora.
- Planear ruta: ruta entre dos ciudades por tiempo, distancia o costo (C1), con la animación paso a paso de Dijkstra.
- Camión o tren: compara ir todo por carretera contra combinar camión y tren (C2).
- Mapa y cierres: ciudades que se quedan sin camino si se cierra un punto (C4) y ubicación de los vehículos.
- Incidentes: alta, cierre, evidencias y envíos afectados con su desvío (C5).
- Sincronizar: reconciliación de las copias entre bases (solo administrador).

El mapa necesita internet para el fondo; sin conexión cae a un fondo liso y la red se sigue viendo.

Para que los tramos sigan el trazo real de la carretera y no se dibujen rectos, con el backend corriendo:

```bash
cd frontend
npm run geometria
```

Pide a OSRM (el ruteador público de OpenStreetMap) el camino de cada tramo, una petición por segundo, y lo guarda en `frontend/static/geometria-tramos.json`. Se corre una vez y el archivo se sube al repositorio; solo hay que repetirlo si se agregan tramos.

## Pruebas

Desde `backend/`:

```bash
npm run test:unit         # no necesitan bases de datos
npm run test:integration  # necesitan los contenedores arriba (docker compose up -d)
npm test                  # unitarias e integración
npm run test:consistencia # apaga y enciende Neo4j; tarda alrededor de un minuto
npm run rendimiento       # mide los flujos principales y escribe docs/pruebas/rendimiento.md
npm run catalogo          # corre los casos del catálogo y escribe docs/pruebas/catalogo-evidencia.md
npm run bases             # corre las consultas y pruebas de database/ en cada contenedor (docs/pruebas/implementacion-evidencia.md)
```

La prueba de rendimiento manda 200 peticiones por escenario con 10 clientes a la vez. Se puede cambiar con `PETICIONES=500 CONCURRENCIA=20 npm run rendimiento` (en PowerShell: `$env:PETICIONES=500; npm run rendimiento`). Lo que crea durante la prueba se borra al terminar.

Las pruebas de integración usan los datos de ejemplo. Si los modificaste a mano, regresa al estado inicial con `docker compose down -v`, `docker compose up -d` y `docker compose up neo4j-init`.

Los scripts de MongoDB y PostgreSQL solo corren la primera vez que se crea su volumen. Si agregas una colección, un validador o datos nuevos, hay que borrar el volumen de esa base para que se vuelvan a cargar. Para MongoDB:

```bash
docker compose rm -sf mongo
docker volume rm hopwright_mongo_data
docker compose up -d mongo
```

## Documentación

| Entregable | Documento |
|---|---|
| 1. Propuesta | [docs/propuesta.md](docs/propuesta.md) |
| 2. Modelado de datos | [docs/modelado.md](docs/modelado.md) y el detalle por base en [docs/modelos/](docs/modelos/) |
| 3. Arquitectura y selección tecnológica | [docs/arquitectura.md](docs/arquitectura.md) y [docs/decisiones-tecnologicas.md](docs/decisiones-tecnologicas.md) |
| 4. Implementación de las tres bases | [docs/implementacion.md](docs/implementacion.md) y los scripts de [database/](database/) |
| 5. Catálogo de operaciones | [docs/catalogo-operaciones.md](docs/catalogo-operaciones.md) |
| 6. Backend y API | `backend/`, el contrato en Swagger (`http://localhost:3000/docs`) y [docs/api/](docs/api/) |
| 7. Aplicación e integración | `frontend/` y el flujo integrado en [docs/arquitectura.md](docs/arquitectura.md#7-flujo-integrado-planear-la-ruta-de-un-envío) |
| 8. Pruebas y despliegue | este README y las evidencias de [docs/pruebas/](docs/pruebas/) |

## Evidencias de pruebas

Cada archivo de `docs/pruebas/` lo genera un comando, así que se puede volver a producir en otra máquina:

- [implementacion-evidencia.md](docs/pruebas/implementacion-evidencia.md) (`npm run bases:desde-cero`): las tres bases construidas desde cero y la salida de sus consultas y pruebas de humo, integridad, cardinalidad y transacciones.
- [catalogo-evidencia.md](docs/pruebas/catalogo-evidencia.md) (`npm run catalogo`): 111 casos normales, límite y de error del catálogo como peticiones HTTP reales, con lo esperado y lo obtenido.
- [rendimiento.md](docs/pruebas/rendimiento.md) (`npm run rendimiento`): tiempos de los flujos principales con el equipo, la concurrencia y el volumen de datos con que se midió.

Cómo se cubren las pruebas obligatorias de integración de la guía (sección 9):

| Tipo | Dónde se verifica |
|---|---|
| Conectividad | `GET /health` y `tests/integration/salud.test.ts`; credenciales solo en `.env` |
| Funcional | `tests/integration/` (rutas, envíos, incidentes, ubicación) y la evidencia del catálogo |
| Integridad | `database/*/tests/`, `tests/integration/relacional.restricciones.test.ts` y `grafo-integridad.test.ts` |
| Integración | `tests/e2e/ruta-envio.test.ts`: alta, manifiesto, ruta, asignación, salida y entrega pasando por las tres bases |
| Consistencia | `tests/consistencia/`: apagan Neo4j a mitad de una escritura y comprueban que la cola de eventos y la reconciliación lo corrigen |
| Errores | casos de error del catálogo (400, 401, 403, 404, 409), 503 cuando una base no responde y 202 cuando la réplica falla |
| Rendimiento | `docs/pruebas/rendimiento.md` |

Las pruebas unitarias (`tests/unit/`) cubren las reglas que no necesitan base: cálculo y exploración de rutas, validación de manifiestos, reglas de incidentes y de ubicación, envíos afectados y reconciliación.

## Demostración

Un recorrido que toca las tres bases en unos minutos, con los datos de prueba recién cargados:

1. Entrar como `despacho@hopwright.local`.
2. Envíos, E-103: el manifiesto es de carga peligrosa (MongoDB) y la ruta planeada evita terracería y sugiere un vehículo que aguanta los 3,000 kg (PostgreSQL y Neo4j).
3. Asignar ese vehículo y dar salida al envío; la bitácora muestra los eventos.
4. Incidentes: reportar un bloqueo de gravedad Alta en la Caseta Chiapa de Corzo y abrir "Envíos afectados": aparece E-103 con su desvío.
5. Planear ruta de Tuxtla a San Cristóbal: ahora rodea la caseta. Cerrar el incidente y la ruta regresa a la autopista.
6. Entregar el envío: en Mapa y cierres el camión aparece en Comitán.
7. Entrar como administrador y correr Sincronizar: no hay nada que corregir.

## Estructura

```
docs/                 propuesta, modelos, arquitectura, contrato de API y pruebas
database/
  relational/         schema/ y data/ (.sql), queries/; init.sh los carga
  document/           validators/ y data/ (.js), queries/; init/ los carga
  graph/              schema/ y data/ (.cypher), queries/, tests/; load.sh los carga
backend/src/
  controllers/        rutas HTTP y sus esquemas (de aquí sale Swagger)
  services/           reglas de negocio y coordinación entre bases
  repositories/       una carpeta por base: relational/, document/, graph/
  db/                 conexiones a los tres motores
frontend/             interfaz web
tests/                unit/, integration/, e2e/
```

La interfaz solo habla con la API. Nunca se conecta directo a una base.
