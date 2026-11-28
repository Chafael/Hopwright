# Decisiones tecnológicas

Aquí está la matriz de comparación y la justificación del stack que pide el Entregable 3. La arquitectura y cómo se coordinan las bases están en [arquitectura.md](arquitectura.md).

## 1. Cómo se comparó

Para cada componente se tomaron dos o tres opciones que de verdad se podían usar en el proyecto y se calificaron del 1 al 5 con los mismos criterios. Cada criterio tiene un peso según cuánto importaba para Hopwright:

| Criterio | Peso | Qué se preguntó |
|---|---|---|
| Ajuste al problema | 30 % | ¿Resuelve bien lo que este componente tiene que hacer en Hopwright? |
| Reglas e integridad | 20 % | ¿Puede rechazar datos inválidos por sí mismo, sin depender solo del backend? |
| Experiencia del equipo | 15 % | ¿Lo vimos en clase o ya lo habíamos usado? |
| Ejecución local | 15 % | ¿Corre en Docker o con `npm` en Windows sin configuración rara? |
| Costo y licencia | 10 % | ¿Es gratis para un proyecto escolar y sin límites que estorben? |
| Ecosistema en Node.js | 10 % | ¿Tiene driver o librería oficial y mantenida para TypeScript? |

El total es la suma de cada calificación por su peso, sobre 5.

## 2. Bases de datos

### 2.1 Base relacional

Lo que necesita: transacciones para asignar un vehículo y cambiar dos estados a la vez, llaves foráneas, `CHECK` para los estados y una forma de bloquear filas para la cola de eventos.

| Criterio (peso) | PostgreSQL 16 | MySQL 8 | SQL Server 2022 |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 4 | 4 |
| Reglas e integridad (20 %) | 5 | 4 | 5 |
| Experiencia del equipo (15 %) | 5 | 4 | 3 |
| Ejecución local (15 %) | 5 | 5 | 3 |
| Costo y licencia (10 %) | 5 | 5 | 3 |
| Ecosistema en Node.js (10 %) | 5 | 4 | 4 |
| Total | 5.00 | 4.25 | 3.80 |

Se eligió PostgreSQL. Lo que lo decidió fue `FOR UPDATE SKIP LOCKED`, que usa el procesador de eventos para tomar eventos sin que dos procesos agarren el mismo, y el tipo `JSONB` para guardar el contenido de cada evento en la misma transacción. MySQL tiene `SKIP LOCKED` desde la versión 8, pero sus `CHECK` y su manejo de errores son menos claros. SQL Server corre en Docker, pero la imagen pesa más, la edición gratuita tiene límites y no lo usamos en clase.

### 2.2 Base documental

Lo que necesita: guardar manifiestos con campos distintos según el tipo de carga, una bitácora que crece con cada evento y reportes de incidente con evidencias que se van agregando, y que la base rechace un documento mal formado.

| Criterio (peso) | MongoDB 7 | PostgreSQL con JSONB | CouchDB 3 |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 3 | 4 |
| Reglas e integridad (20 %) | 5 | 3 | 2 |
| Experiencia del equipo (15 %) | 5 | 4 | 2 |
| Ejecución local (15 %) | 5 | 5 | 4 |
| Costo y licencia (10 %) | 5 | 5 | 5 |
| Ecosistema en Node.js (10 %) | 5 | 5 | 3 |
| Total | 5.00 | 3.85 | 3.30 |

Se eligió MongoDB. Su validador `$jsonSchema` con `oneOf` permite que cada tipo de carga traiga exactamente sus campos, y lo revisa la base misma (código 121 si no cumple). Los índices parciales también ayudaron: `pendientes_de_sincronizar` solo indexa los reportes con `sincronizado: false`, que es lo primero que busca la reconciliación. Guardar todo en JSONB dentro de PostgreSQL hubiera funcionado, pero validar la estructura con `CHECK` sobre JSON es incómodo y la guía pide que la base documental sea un motor distinto. CouchDB valida con funciones de JavaScript y no con un esquema declarativo, y no lo conocíamos.

### 2.3 Base de grafos

Lo que necesita: la red de 124 municipios, 9 intersecciones y 5 estaciones con 337 tramos; ruta más corta con pesos (tiempo, distancia o costo), rutas que esquiven puntos bloqueados, exploración por saltos y saber qué ciudades se quedan sin camino.

| Criterio (peso) | Neo4j 5 con APOC | SQL recursivo en PostgreSQL | ArangoDB 3 |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 2 | 4 |
| Reglas e integridad (20 %) | 4 | 4 | 3 |
| Experiencia del equipo (15 %) | 5 | 3 | 2 |
| Ejecución local (15 %) | 5 | 5 | 4 |
| Costo y licencia (10 %) | 4 | 5 | 4 |
| Ecosistema en Node.js (10 %) | 5 | 5 | 3 |
| Total | 4.70 | 3.60 | 3.40 |

Se eligió Neo4j con APOC. `apoc.algo.dijkstra` resuelve la ruta más corta con cualquier propiedad como peso, y `apoc.path.subgraphNodes` da las ciudades alcanzables para saber cuáles quedan aisladas. Con un `WITH RECURSIVE` en PostgreSQL se puede recorrer la red, pero calcular la ruta de menor peso obliga a explorar todos los caminos y se vuelve lento y difícil de leer. ArangoDB tiene rutas más cortas, pero AQL no lo vimos en clase. Neo4j le pierde un punto en integridad porque la edición Community no permite restricciones de existencia de propiedades; esas reglas las revisa el backend (R3 a R6 en el modelado).

## 3. Backend

| Criterio (peso) | Fastify 5 | Express 5 | NestJS 11 |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 4 | 4 |
| Reglas e integridad (20 %) | 5 | 2 | 4 |
| Experiencia del equipo (15 %) | 4 | 5 | 2 |
| Ejecución local (15 %) | 5 | 5 | 5 |
| Costo y licencia (10 %) | 5 | 5 | 5 |
| Ecosistema en Node.js (10 %) | 5 | 5 | 5 |
| Total | 4.85 | 4.10 | 4.05 |

Se eligió Fastify con TypeScript. Cada ruta declara su JSON Schema, así que Fastify rechaza con 400 lo que no cumple antes de llegar al servicio, y el mismo esquema genera la documentación de Swagger en `/docs`. Con Express eso requiere juntar varias librerías por fuera. NestJS da una estructura más rígida (módulos, decoradores, inyección de dependencias) que para un equipo de dos personas era más ceremonia que ayuda; la separación en controladores, servicios y repositorios se logró igual con carpetas.

Node.js tiene driver oficial para las tres bases (`pg`, `mongodb`, `neo4j-driver`), y eso pesó tanto como el framework: un solo lenguaje en el backend y en el frontend.

### 3.1 REST o GraphQL

Se eligió una API REST. Las operaciones de Hopwright son acciones con nombre propio (asignar, dar salida, entregar, reportar un incidente, reconciliar) que cambian estados y tienen reglas, y cada una tiene sus códigos de respuesta: 409 si el vehículo ya está ocupado, 202 si la réplica en Neo4j no se pudo escribir. En REST eso queda en el método, la ruta y el código HTTP, y el mismo JSON Schema que valida la entrada genera el contrato en OpenAPI.

GraphQL convenía si la interfaz necesitara pedir combinaciones muy distintas de campos de las tres bases en una sola consulta. Aquí no pasa: las consultas que cruzan bases (la ruta de un envío, los envíos afectados) las arma el servicio en el backend, porque decidir qué base consultar y qué hacer si falla es lógica de negocio y no le toca al cliente. Con GraphQL además todo responde 200 y los errores van dentro del cuerpo, lo que haría menos claros los casos de error del catálogo.

El contrato se publica de dos formas: Swagger en `http://localhost:3000/docs` con el backend corriendo, y el archivo [api/openapi.json](api/openapi.json), que se regenera con `npm run openapi` y se puede abrir en cualquier visor de OpenAPI sin levantar nada.

### 3.2 Consultas parametrizadas y credenciales

Ninguna consulta se arma pegando valores que vienen del usuario. En PostgreSQL todo va con `$1`, `$2` de `pg`; en Neo4j, con parámetros `$origen`, `$placa` del driver; en MongoDB, los filtros son objetos, no texto. En las consultas de Cypher sí se interpolan dos cosas, siempre desde el código y nunca desde la petición: el nombre de la propiedad que se usa como peso, que sale de un mapa fijo (`tiempo`, `distancia` o `costo`), y fragmentos de proyección con nombres de variables fijos.

Las credenciales viven solo en `.env`, que está en `.gitignore`. El repositorio trae `.env.example` con valores de ejemplo y el backend se niega a arrancar si falta una variable obligatoria, con un mensaje que dice cuál. El mismo `.env` lo leen Docker Compose (para crear las bases) y el backend (para conectarse), así que no hay dos lugares donde cambiar una contraseña.

## 4. Frontend

| Criterio (peso) | SvelteKit 2 con Svelte 5 | React 19 con Vite | Vue 3 con Vite |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 5 | 5 |
| Reglas e integridad (20 %) | 4 | 4 | 4 |
| Experiencia del equipo (15 %) | 4 | 4 | 3 |
| Ejecución local (15 %) | 5 | 5 | 5 |
| Costo y licencia (10 %) | 5 | 5 | 5 |
| Ecosistema en Node.js (10 %) | 4 | 5 | 4 |
| Total | 4.55 | 4.65 | 4.40 |

React salió apenas arriba por su ecosistema, y aun así se eligió SvelteKit. La diferencia es de una décima y viene de un solo criterio. Pesaron más dos cosas que la matriz no captura bien: Svelte 5 maneja el estado con runas (`$state`, `$derived`) sin librerías extra, lo que simplificó la animación de la exploración de rutas y el reproductor de la línea de tiempo, y el código que resulta es más corto. El sitio se compila como estático (`adapter-static`), así que se puede servir desde cualquier lado sin un servidor de Node.

Para la interfaz se usaron Tailwind CSS 4 con Flowbite Svelte (formularios, tablas, avisos) e iconos de Lucide.

### 4.1 Mapa

| Criterio (peso) | MapLibre GL 5 | Leaflet 1.9 | Google Maps JS |
|---|---|---|---|
| Ajuste al problema (30 %) | 5 | 4 | 4 |
| Reglas e integridad (20 %) | 3 | 3 | 3 |
| Experiencia del equipo (15 %) | 3 | 4 | 3 |
| Ejecución local (15 %) | 5 | 5 | 3 |
| Costo y licencia (10 %) | 5 | 5 | 2 |
| Ecosistema en Node.js (10 %) | 5 | 4 | 4 |
| Total | 4.30 | 4.05 | 3.30 |

Se eligió MapLibre GL con el estilo positron de OpenFreeMap. Dibuja con WebGL, así que los 337 tramos, las rutas animadas y los vehículos se mueven sin trabarse, y las capas se controlan con expresiones (color por tipo de vía, grosor por ruta elegida). Es libre y no pide llave de API. Leaflet es más sencillo pero dibuja con SVG o canvas y se vuelve lento con muchas líneas animadas. Google Maps pide tarjeta para la llave y cobra después de cierto uso.

## 5. Infraestructura y pruebas

Docker Compose levanta PostgreSQL 16, MongoDB 7 y Neo4j 5 con APOC. La primera vez que se crea cada volumen corre los scripts de esquema y datos de prueba, así que cualquiera que clone el repositorio tiene las tres bases listas con `docker compose up -d`. La alternativa era instalar las tres bases en cada computadora, con versiones y puertos distintos; en Windows además Neo4j y APOC dan problemas de configuración.

Las pruebas usan Vitest: unitarias (reglas y Dijkstra sobre la red de ejemplo), de integración contra las tres bases en Docker, de consistencia (apagando Neo4j a propósito) y una prueba de rendimiento con la red completa. Se eligió sobre Jest porque entiende TypeScript y módulos ES sin configuración.

## 6. Resumen del stack

| Capa | Elegido | Razón principal |
|---|---|---|
| Base relacional | PostgreSQL 16 | Transacciones, restricciones y `SKIP LOCKED` para la cola de eventos |
| Base documental | MongoDB 7 | Validador `$jsonSchema` con `oneOf` para cada tipo de carga |
| Base de grafos | Neo4j 5 con APOC | Dijkstra con pesos y recorridos sobre la red real de Chiapas |
| Backend | Fastify 5 con TypeScript | Validación por esquema y Swagger con el mismo contrato |
| Frontend | SvelteKit 2 con Svelte 5 | Estado reactivo sin librerías extra y sitio estático |
| Mapa | MapLibre GL 5 | WebGL, libre y sin llave de API |
| Infraestructura | Docker Compose | Las tres bases con sus datos en un solo comando |
| Pruebas | Vitest | TypeScript y módulos ES sin configuración |
