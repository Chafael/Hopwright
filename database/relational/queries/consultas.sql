-- Consultas representativas del módulo relacional.

-- Envíos pendientes con cliente y ciudades.
SELECT e.id_envio,
       c.razon_social AS cliente,
       co.nombre AS ciudad_origen,
       cd.nombre AS ciudad_destino,
       e.peso_kg,
       e.prioridad,
       e.estado
FROM envio e
JOIN cliente c ON c.id_cliente = e.id_cliente
JOIN ciudad co ON co.id_ciudad = e.id_ciudad_origen
JOIN ciudad cd ON cd.id_ciudad = e.id_ciudad_destino
WHERE e.estado = 'Pendiente'
ORDER BY e.creado_en;

-- Vehículos disponibles con capacidad suficiente para un peso dado.
-- Reemplaza :peso_kg por el valor deseado.
SELECT placa, tipo, capacidad_kg, estado
FROM vehiculo
WHERE estado = 'Disponible'
  AND capacidad_kg >= :peso_kg
ORDER BY capacidad_kg;

-- Historial de asignaciones de un vehículo.
-- Reemplaza :placa por la placa deseada.
SELECT a.id_asignacion,
       a.id_envio,
       a.placa,
       a.fecha_asignacion,
       a.fecha_fin,
       a.activa,
       e.estado AS estado_envio
FROM asignacion a
JOIN envio e ON e.id_envio = a.id_envio
WHERE a.placa = :placa
ORDER BY a.fecha_asignacion DESC;

-- Envíos en camino con su vehículo.
SELECT e.id_envio,
       e.estado,
       e.fecha_salida,
       a.placa,
       v.tipo,
       v.capacidad_kg
FROM envio e
JOIN asignacion a ON a.id_envio = e.id_envio AND a.activa
JOIN vehiculo v ON v.placa = a.placa
WHERE e.estado = 'En camino'
ORDER BY e.fecha_salida DESC;
