-- Consultas representativas de la base relacional.
-- Se pueden correr completas con psql (las variables de abajo tienen un valor por defecto):
--   docker exec -i hopwright-postgres psql -U hopwright -d hopwright < database/relational/queries/consultas.sql
-- o pegar una por una en cualquier cliente, cambiando :peso_kg y :'placa' por un valor.

\set peso_kg 3000
\set placa 'CHP-1001'

-- 1. Envíos pendientes con su cliente y sus ciudades (pantalla de Envíos).
--    Usa envio_estado_idx y las llaves primarias de cliente y ciudad.
SELECT e.id_envio,
       c.razon_social AS cliente,
       co.nombre      AS ciudad_origen,
       cd.nombre      AS ciudad_destino,
       e.peso_kg,
       e.prioridad,
       e.estado
FROM envio e
JOIN cliente c  ON c.id_cliente = e.id_cliente
JOIN ciudad co  ON co.id_ciudad = e.id_ciudad_origen
JOIN ciudad cd  ON cd.id_ciudad = e.id_ciudad_destino
WHERE e.estado = 'Pendiente'
ORDER BY e.prioridad DESC, e.creado_en;

-- 2. Vehículos disponibles que aguantan un peso, del más chico al más grande.
--    Es la lista de candidatos del flujo integrado (GET /envios/{id}/ruta).
SELECT placa, tipo, capacidad_kg, estado
FROM vehiculo
WHERE estado = 'Disponible'
  AND capacidad_kg >= :peso_kg
ORDER BY capacidad_kg, placa;

-- 3. Historial de asignaciones de un vehículo.
SELECT a.id_asignacion,
       a.id_envio,
       a.fecha_asignacion,
       a.fecha_fin,
       a.activa,
       e.estado AS estado_envio
FROM asignacion a
JOIN envio e ON e.id_envio = a.id_envio
WHERE a.placa = :'placa'
ORDER BY a.fecha_asignacion DESC;

-- 4. Envíos en camino con su vehículo y su conductor (los revisa C5 contra un incidente).
--    LEFT JOIN porque un vehículo puede no tener conductor asignado.
SELECT e.id_envio,
       e.fecha_salida,
       a.placa,
       v.tipo,
       v.capacidad_kg,
       coalesce(cd.nombre, 'sin conductor') AS conductor
FROM envio e
JOIN asignacion a     ON a.id_envio = e.id_envio AND a.activa
JOIN vehiculo v       ON v.placa = a.placa
LEFT JOIN conductor cd ON cd.id_conductor = v.id_conductor
WHERE e.estado = 'En camino'
ORDER BY e.fecha_salida DESC;

-- 5. Cuántos envíos y kilos mueve cada cliente, por estado.
SELECT c.razon_social,
       count(*) FILTER (WHERE e.estado IN ('Pendiente', 'Asignado')) AS por_salir,
       count(*) FILTER (WHERE e.estado = 'En camino')                AS en_camino,
       count(*) FILTER (WHERE e.estado = 'Entregado')                AS entregados,
       count(*) FILTER (WHERE e.estado = 'Cancelado')                AS cancelados,
       sum(e.peso_kg) FILTER (WHERE e.estado <> 'Cancelado')         AS kg_movidos
FROM cliente c
LEFT JOIN envio e ON e.id_cliente = c.id_cliente
GROUP BY c.id_cliente, c.razon_social
ORDER BY kg_movidos DESC NULLS LAST;

-- 6. Estado de la flota: cuántos vehículos hay de cada tipo en cada estado y su capacidad total.
SELECT tipo,
       estado,
       count(*)          AS vehiculos,
       sum(capacidad_kg) AS capacidad_total_kg
FROM vehiculo
GROUP BY tipo, estado
ORDER BY tipo, estado;

-- 7. Ciudades que más envíos generan o reciben.
SELECT ci.id_ciudad,
       ci.nombre,
       count(*) FILTER (WHERE e.id_ciudad_origen = ci.id_ciudad)  AS salen,
       count(*) FILTER (WHERE e.id_ciudad_destino = ci.id_ciudad) AS llegan
FROM ciudad ci
JOIN envio e ON ci.id_ciudad IN (e.id_ciudad_origen, e.id_ciudad_destino)
GROUP BY ci.id_ciudad, ci.nombre
ORDER BY count(*) DESC, ci.nombre
LIMIT 10;

-- 8. Cuánto tardaron los envíos entregados, de la salida al cierre de su asignación.
SELECT e.id_envio,
       e.fecha_salida,
       a.fecha_fin                                  AS entregado_en,
       round(extract(epoch FROM a.fecha_fin - e.fecha_salida) / 3600, 1) AS horas
FROM envio e
JOIN asignacion a ON a.id_envio = e.id_envio AND NOT a.activa
WHERE e.estado = 'Entregado' AND e.fecha_salida IS NOT NULL
ORDER BY horas DESC;

-- 9. Vigilancia de la cola de eventos: cuántos hay por tipo y estado, y el último error de los fallidos.
--    Usa eventos_pendientes_estado_idx.
SELECT tipo,
       estado,
       count(*)                     AS eventos,
       max(intentos)                AS max_intentos,
       max(ultimo_error)            AS ultimo_error
FROM eventos_pendientes
GROUP BY tipo, estado
ORDER BY tipo, estado;

-- 10. Conductores activos que no manejan ningún vehículo (disponibles para asignar).
SELECT cd.id_conductor, cd.nombre, cd.licencia
FROM conductor cd
WHERE cd.activo
  AND NOT EXISTS (SELECT 1 FROM vehiculo v WHERE v.id_conductor = cd.id_conductor)
ORDER BY cd.nombre;

-- 11. Plan de ejecución de la consulta 1, para ver que usa el índice por estado.
--     Con tan pocos datos PostgreSQL puede preferir leer la tabla completa; con más envíos cambia al índice.
EXPLAIN SELECT id_envio FROM envio WHERE estado = 'Pendiente';
