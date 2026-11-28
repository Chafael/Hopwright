# Entregable 7. Aplicación e integración

La interfaz está en `frontend/`: SvelteKit 2 con Svelte 5, compilada como sitio estático, con Tailwind y Flowbite para los componentes y MapLibre para el mapa. Solo habla con la API mediante `frontend/src/lib/api.ts`; no conoce las bases ni sus credenciales. El usuario ve una sola aplicación aunque detrás trabajen tres bases.

## 1. Usuarios y pantallas

El menú lateral tiene seis pantallas, más la de inicio de sesión. Sin sesión se puede consultar todo; para cambiar datos hay que entrar como despachador o administrador. Si alguien intenta algo que su rol no permite, la API responde 403 y la pantalla muestra el mensaje.

| Pantalla | Para qué sirve | Usuario |
|---|---|---|
| Entrar | Iniciar sesión | los dos |
| Envíos | Lista con filtro por estado, alta de envío, y el detalle de cada uno: manifiesto, ruta planeada, asignación, salida, entrega, cancelación y bitácora | despachador |
| Planear ruta | Ruta entre dos ciudades por tiempo, distancia o costo, con restricciones de carga, y la animación paso a paso de Dijkstra sobre el mapa | despachador |
| Camión o tren | Compara ir todo por carretera contra combinar camión y tren, en tiempo y en costo | despachador |
| Mapa y cierres | La red completa, ciudades que se quedan sin camino si se cierra un punto y la ubicación de cada vehículo, que se puede mover | los dos |
| Incidentes | Lista de activos, de todos o de los pendientes de sincronizar; alta, cierre, evidencias y envíos afectados con su desvío | despachador |
| Sincronizar | Reconciliación de las copias entre bases, con el resumen de lo revisado y lo corregido | administrador |

En el menú se ve todo el tiempo el estado de las tres bases. La interfaz consulta `GET /health` cada 20 segundos y marca como "No responde" la que esté caída.

## 2. Flujos por base

Cada base tiene flujos propios en la interfaz:

- PostgreSQL: el ciclo del envío. Registrar el envío, asignarle un vehículo (la lista solo muestra los disponibles que aguantan el peso), darle salida, entregarlo o cancelarlo. Si dos personas intentan asignar el mismo camión, la segunda recibe el mensaje de conflicto de la API.
- MongoDB: el manifiesto, cuyo formulario cambia según el tipo de carga (la refrigerada pide temperaturas y tiempo máximo; la peligrosa, clase UN, número ONU, hoja de seguridad y teléfono), y los reportes de incidente, que cambian según el tipo (bloqueo, accidente, obra o derrumbe) y aceptan evidencias. La bitácora del envío también sale de aquí.
- Neo4j: todas las rutas. Planear ruta, camión o tren, ciudades aisladas, el mapa de la red y la ubicación de los vehículos.

## 3. Casos de uso integrados

Hay tres pantallas que muestran información de varias bases en una sola vista.

Ruta de un envío (detalle del envío). Junta las tres bases: origen, destino, peso y vehículos candidatos de PostgreSQL; las restricciones del manifiesto de MongoDB; la ruta y el vehículo más cercano de Neo4j. La pantalla muestra debajo de la ruta qué aportó cada base, con el campo `fuentes` de la respuesta. Es el flujo de la sección 8.1 de la guía; está explicado paso a paso en [arquitectura.md](arquitectura.md), sección 7.

Envíos afectados (detalle de un incidente). El incidente sale de MongoDB, los envíos en camino y su vehículo de PostgreSQL, y la ruta con y sin el punto bloqueado de Neo4j. La pantalla lista cada envío afectado con sus minutos extra y dibuja el desvío en el mapa.

Ubicación de vehículos (mapa y cierres). Mover un vehículo lee su tipo en PostgreSQL para validar que un tren solo quede en una estación, y escribe la ubicación en Neo4j.

## 4. Evidencia de que los cambios se reflejan según la estrategia de consistencia

La estrategia (fuente de verdad única, cola de eventos para lo que nace en PostgreSQL, bandera `sincronizado` para los incidentes y reconciliación de respaldo) está en [arquitectura.md](arquitectura.md), secciones 5 a 8. Que funciona lo muestran estas pruebas:

| Qué se comprueba | Dónde |
|---|---|
| Una ciudad dada de alta en PostgreSQL no está en Neo4j antes del procesador de eventos y sí está después, con el mismo nombre | catálogo, casos I03-V1 e I03-V2 |
| Un vehículo nuevo aparece en el grafo cuando se aplica `VEHICULO_GUARDADO` | catálogo, casos R03-V1 y R03-V2 |
| La asignación cambia los dos estados y deja el evento en la misma transacción | catálogo, caso R05-V1 |
| Un incidente queda con el mismo estado en MongoDB y en Neo4j, cambia la ruta mientras está activo y deja de cambiarla al cerrarse | catálogo, casos D04-V1, G01-L3 y G01-L4 |
| Al entregar un envío, la bitácora en MongoDB recibe los eventos en orden y el camión queda en el destino en Neo4j | catálogo, casos D03-N1 y R06-V1; prueba `tests/e2e/ruta-envio.test.ts` |
| Un incidente reportado con Neo4j apagado responde 202, queda pendiente y llega al grafo al reconciliar | `tests/consistencia/incidente-sin-neo4j.test.ts` |
| Un vehículo registrado con Neo4j apagado se guarda en PostgreSQL y se replica cuando Neo4j regresa | `tests/consistencia/vehiculo-sin-neo4j.test.ts` |
| Reconciliar dos veces seguidas no cambia nada la segunda vez | catálogo, caso I04-L1 |

En la interfaz, un incidente que no llegó a Neo4j aparece con la etiqueta "Por sincronizar", y el filtro de pendientes de la pantalla de incidentes los muestra juntos. Después de correr Sincronizar, la lista queda vacía.

## 5. Cómo correrla

Con las bases y el backend arriba (ver el README):

```bash
cd frontend
npm install
npm run dev
```

Se abre en `http://localhost:5173`. Si la API no está en `http://localhost:3000`, se cambia `VITE_API_URL` en `frontend/.env`. El README trae un guion de demostración de siete pasos que recorre los tres casos integrados.
