# Entregable 8. Pruebas, documentación y despliegue

Este documento junta cómo se instala y se corre Hopwright, qué pruebas tiene y qué resultados dieron. Cada resultado sale de un archivo de `docs/pruebas/` que genera un comando, así que cualquiera puede repetirlo en su equipo.

## 1. Instalación y ejecución

### 1.1 Requisitos

- Docker Desktop, para las tres bases.
- Node.js 22 o superior, para el backend y la interfaz.
- Git, para clonar el repositorio.

El proyecto se probó en Windows 11 con PowerShell y en Linux.

### 1.2 Pasos

```bash
git clone https://github.com/Chafael/Hopwright.git
cd Hopwright
cp .env.example .env          # en PowerShell: Copy-Item .env.example .env
docker compose up -d          # crea y carga las tres bases la primera vez
cd backend
npm install
npm run dev                   # API en http://localhost:3000, Swagger en /docs
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev                   # interfaz en http://localhost:5173
```

`GET http://localhost:3000/health` responde `"estado": "ok"` cuando las tres bases contestan. Para empezar desde cero se borran los volúmenes con `docker compose down -v` y se vuelve a correr `docker compose up -d`; lo que hace cada contenedor al cargar está en [implementacion.md](implementacion.md), sección 1.

### 1.3 Variables de entorno

Todas están en `.env.example`, con valores de ejemplo y sin credenciales reales. El `.env` está en `.gitignore`.

| Variable | Para qué |
|---|---|
| `PORT`, `HOST`, `NODE_ENV` | Dónde escucha la API |
| `CORS_ORIGIN` | Desde qué orígenes puede llamar la interfaz |
| `JWT_SECRET` | Secreto para firmar los tokens de sesión |
| `COSTO_KM_CAMION` | Costo por kilómetro del camión, para comparar contra el tren |
| `RUTAS_CANDIDATAS` | Cuántas rutas alternativas pide Neo4j antes de filtrar |
| `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD` | PostgreSQL |
| `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_USER`, `MONGO_PASSWORD` | MongoDB |
| `NEO4J_HOST`, `NEO4J_BOLT_PORT`, `NEO4J_USER`, `NEO4J_PASSWORD` | Neo4j |

Docker Compose y el backend leen el mismo archivo. Si falta una variable obligatoria, el backend no arranca y dice cuál falta.

### 1.4 Usuarios de prueba

- Despachador: `despacho@hopwright.local`, contraseña `hopwright123`.
- Administrador: `admin@hopwright.local`, contraseña `hopwright123`.

Son solo para la demostración; el hash bcrypt está en los datos de prueba de PostgreSQL.

## 2. Pruebas

### 2.1 Comandos

Desde `backend/`, con los contenedores arriba:

| Comando | Qué hace | Evidencia que genera |
|---|---|---|
| `npm run test:unit` | Pruebas unitarias, sin bases | |
| `npm run test:integration` | Integración contra las tres bases | |
| `npm run test:consistencia` | Apaga Neo4j a mitad de una escritura y comprueba la recuperación | |
| `npm run pruebas:reporte` | Todo lo anterior, junto | `docs/pruebas/pruebas-automatizadas.md` |
| `npm run bases:desde-cero` | Borra los volúmenes, construye las bases y corre sus consultas y pruebas | `docs/pruebas/implementacion-evidencia.md` |
| `npm run catalogo` | Los casos normal, límite y error del catálogo como peticiones HTTP reales | `docs/pruebas/catalogo-evidencia.md` |
| `npm run rendimiento` | Tiempos de los flujos principales con varios clientes a la vez | `docs/pruebas/rendimiento.md` |

### 2.2 Resultados

| Prueba | Resultado |
|---|---|
| Unitarias | 52 de 52 |
| Integración contra las tres bases | 84 de 84 |
| Extremo a extremo (flujo integrado) | 7 de 7 |
| Consistencia con Neo4j apagado | 2 de 2 |
| PostgreSQL: humo, integridad, cardinalidad y transacciones | 27 de 27 |
| MongoDB: humo, documentos válidos e inválidos e índices | 35 de 35 |
| Neo4j: integridad y cardinalidad | 14 de 14 sin fallas |
| Catálogo de operaciones (normal, límite y error) | 111 de 111 |
| Rendimiento | 12 escenarios, 2,400 peticiones, 0 errores |

Las pruebas de bases se corrieron después de construir las tres desde cero con `npm run bases:desde-cero`, dos veces seguidas y con el mismo resultado.

### 2.3 Cobertura de las pruebas obligatorias de la guía

| Tipo (sección 9 de la guía) | Qué se verifica | Evidencia |
|---|---|---|
| Conectividad | El backend se conecta a los tres motores con credenciales del `.env` | `GET /health`, `tests/integration/salud.test.ts` |
| Funcional | Cada operación produce el resultado esperado | `tests/integration/`, catálogo (111 casos) |
| Integridad | Las reglas de cada modelo se cumplen | `database/relational/tests/`, `database/document/tests/`, `database/graph/tests/`, `relacional.restricciones.test.ts`, `grafo-integridad.test.ts` |
| Integración | Una operación coordina dos o más bases | `tests/e2e/ruta-envio.test.ts`; catálogo OP-I01 a OP-I04 |
| Consistencia | Las copias no quedan contradictorias sin detectarse | `tests/consistencia/` y los casos de verificación del catálogo |
| Errores | Fallos de conexión, datos inválidos y escrituras parciales | Casos de error del catálogo (400, 401, 403, 404, 409); 503 sin base; 202 cuando la réplica falla |
| Rendimiento | Los flujos prioritarios responden en tiempos razonables | `docs/pruebas/rendimiento.md` |

Las pruebas unitarias cubren lo que no necesita base: el cálculo y la exploración de rutas sobre la red de ejemplo, la validación de manifiestos, las reglas de incidentes y de ubicación, los envíos afectados y la reconciliación. La concurrencia se prueba en `tests/integration/asignaciones.concurrentes.test.ts`: dos asignaciones del mismo envío al mismo tiempo, de las que una gana y la otra recibe 409.

### 2.4 Rendimiento

Cada escenario mandó 200 peticiones con 10 clientes a la vez, después de 10 de calentamiento. Equipo: AMD Ryzen 5 7535HS (12 hilos), 15 GB de memoria, Windows 11, Node.js 24, con las tres bases en Docker en el mismo equipo. Tiempos en milisegundos.

| Escenario | Bases | Peticiones/s | p50 | p95 | Errores |
|---|---|---:|---:|---:|---:|
| `GET /health` | las tres (ping) | 365.6 | 22.3 | 90.4 | 0 |
| `GET /rutas` (C1, por tiempo) | Neo4j | 122.5 | 78.1 | 105.1 | 0 |
| `GET /rutas` (C1, con restricciones) | Neo4j | 131.6 | 74.9 | 90.6 | 0 |
| `GET /rutas/camion-tren` (C2) | Neo4j | 17.7 | 552.2 | 628.9 | 0 |
| `GET /red/ciudades-aisladas` (C4) | Neo4j | 265.5 | 35.9 | 49.6 | 0 |
| `GET /incidentes?activo=true` | MongoDB | 772.2 | 12.4 | 16.3 | 0 |
| `POST /incidentes` | MongoDB y Neo4j | 163.1 | 47.5 | 141.2 | 0 |
| `GET /incidentes/{id}/envios-afectados` (C5) | las tres | 142.8 | 66.1 | 92.1 | 0 |
| `GET /envios` | PostgreSQL | 1186.5 | 8.1 | 13.2 | 0 |
| `GET /envios/{id}/manifiesto` | MongoDB | 959.7 | 10.0 | 13.6 | 0 |
| `GET /envios/{id}/ruta` (flujo integrado) | las tres | 68.7 | 138.6 | 176.5 | 0 |
| `PATCH /vehiculos/{placa}/ubicacion` | PostgreSQL y Neo4j | 167.6 | 56.5 | 83.1 | 0 |

Lo más lento es camión o tren (C2), porque calcula dos rutas completas y la combinación con cada par de estaciones; aun así responde en poco más de medio segundo. El flujo integrado, que consulta las tres bases, queda por debajo de 200 ms en el 95 % de las peticiones. Son los datos de prueba, no un volumen de producción: sirven para comparar los flujos entre sí y para detectar si un cambio los vuelve más lentos.

## 3. Documentación

| Entregable | Documento |
|---|---|
| 1. Propuesta | `docs/propuesta.md` |
| 2. Modelado de datos | `docs/modelado.md` y `docs/modelos/` |
| 3. Arquitectura y selección tecnológica | `docs/arquitectura.md` y `docs/decisiones-tecnologicas.md` |
| 4. Implementación de las tres bases | `docs/implementacion.md` y `database/` |
| 5. Catálogo de operaciones | `docs/catalogo-operaciones.md` |
| 6. Backend y API | `docs/backend-api.md` y `docs/api/openapi.json` |
| 7. Aplicación e integración | `docs/aplicacion.md` |
| 8. Pruebas, documentación y despliegue | este documento, el README y `docs/pruebas/` |

## 4. Demostración

Un recorrido que toca las tres bases en unos minutos, con los datos de prueba recién cargados:

1. Entrar como despachador.
2. Envíos, E-103: el manifiesto es de carga peligrosa (MongoDB) y la ruta planeada evita terracería y sugiere un vehículo que aguanta los 3,000 kg (PostgreSQL y Neo4j).
3. Asignar ese vehículo y dar salida al envío; la bitácora muestra los eventos.
4. Incidentes: reportar un bloqueo de gravedad Alta en la Caseta Chiapa de Corzo y abrir "Envíos afectados": aparece E-103 con su desvío.
5. Planear ruta de Tuxtla a San Cristóbal: ahora rodea la caseta. Al cerrar el incidente, la ruta regresa a la autopista.
6. Entregar el envío: en Mapa y cierres el camión aparece en Comitán.
7. Entrar como administrador y correr Sincronizar: no hay nada que corregir.
