# Hopwright

Aplicación para empresas de paquetería del sureste de México. Asigna vehículos a envíos sin conflictos y calcula la ruta más conveniente para cada envío por carretera y tren, esquivando bloqueos y respetando los requisitos de la carga.

Proyecto final de Bases de Datos en la Nube, Universidad Politécnica de Chiapas. Usa tres bases de datos coordinadas por una sola API:

- PostgreSQL: envíos, vehículos, asignaciones y catálogos (datos transaccionales).
- MongoDB: manifiestos de carga, reportes de incidente y bitácora de seguimiento (documentos con estructura variable).
- Neo4j: red de carreteras y vías de tren con pesos (rutas y recorridos).

La propuesta completa, la matriz de responsabilidades y la fuente de verdad de cada dato están en `docs/`.

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

Para empezar desde cero (borra todos los datos): `docker compose down -v` y luego `docker compose up -d`.

## Interfaz web

La interfaz está en `frontend/` (SvelteKit en modo estático, Tailwind, Flowbite y MapLibre con el mapa Positron de OpenFreeMap). Solo habla con la API, nunca con las bases. Con el backend corriendo en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Se abre en http://localhost:5173. Si la API no está en `http://localhost:3000`, copia `frontend/.env.example` como `frontend/.env` y cambia `VITE_API_URL`.

Pantallas: rutas (C1), camión o tren (C2), red y cierres (C4 y ubicación de vehículos), incidentes (alta, cierre, evidencias y envíos afectados, C5) y mantenimiento (reconciliación). El mapa necesita internet para el fondo; sin conexión cae a un fondo liso y la red se sigue viendo.

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
```

La prueba de rendimiento manda 200 peticiones por escenario con 10 clientes a la vez. Se puede cambiar con `PETICIONES=500 CONCURRENCIA=20 npm run rendimiento` (en PowerShell: `$env:PETICIONES=500; npm run rendimiento`). Lo que crea durante la prueba se borra al terminar.

Las pruebas de integración usan los datos de ejemplo. Si los modificaste a mano, regresa al estado inicial con `docker compose down -v`, `docker compose up -d` y `docker compose up neo4j-init`.

Los scripts de MongoDB y PostgreSQL solo corren la primera vez que se crea su volumen. Si agregas una colección, un validador o datos nuevos, hay que borrar el volumen de esa base para que se vuelvan a cargar. Para MongoDB:

```bash
docker compose rm -sf mongo
docker volume rm hopwright_mongo_data
docker compose up -d mongo
```

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
