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

Si ya tienes PostgreSQL o MongoDB instalados en tu computadora, ocupan los puertos 5432 y 27017. Por eso el `.env.example` usa el puerto 5433 para el PostgreSQL de Docker. Si MongoDB también choca, cambia `MONGO_PORT` en tu `.env` (por ejemplo a 27018) y vuelve a correr `docker compose up -d`.

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
