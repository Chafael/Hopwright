-- Pruebas de humo, integridad, cardinalidad y transacciones de la base relacional.
--   docker exec -i hopwright-postgres psql -U hopwright -d hopwright < database/relational/tests/01_integridad.sql
--
-- Cada prueba de integridad intenta escribir algo inválido dentro de un bloque con EXCEPTION. PostgreSQL
-- deshace ese bloque y la prueba guarda qué error salió. Ninguna deja datos: todo se deshace o se borra.
-- Al final se imprime una tabla con cada prueba, el error esperado, el obtenido y si cumple.

\set ON_ERROR_STOP 1

-- ---------- Humo: las tablas existen y tienen los datos de prueba ----------
SELECT 'usuario' AS tabla, count(*) AS filas FROM usuario
UNION ALL SELECT 'cliente', count(*) FROM cliente
UNION ALL SELECT 'conductor', count(*) FROM conductor
UNION ALL SELECT 'ciudad', count(*) FROM ciudad
UNION ALL SELECT 'vehiculo', count(*) FROM vehiculo
UNION ALL SELECT 'envio', count(*) FROM envio
UNION ALL SELECT 'asignacion', count(*) FROM asignacion
UNION ALL SELECT 'eventos_pendientes', count(*) FROM eventos_pendientes;

CREATE TEMP TABLE resultado (
  orden     SERIAL,
  grupo     TEXT,
  prueba    TEXT,
  esperado  TEXT,
  obtenido  TEXT
);

-- Intenta una sentencia y guarda el código de error que dio (o "sin error")
CREATE FUNCTION pg_temp.intentar(grupo TEXT, prueba TEXT, esperado TEXT, sentencia TEXT) RETURNS VOID AS $$
DECLARE
  obtenido TEXT := 'sin error';
BEGIN
  BEGIN
    EXECUTE sentencia;
    -- Si no falló, se deshace igual para no dejar basura
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'deshacer';
  EXCEPTION
    WHEN raise_exception THEN NULL;
    WHEN OTHERS THEN obtenido := SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO resultado (grupo, prueba, esperado, obtenido) VALUES (grupo, prueba, esperado, obtenido);
END;
$$ LANGUAGE plpgsql;

-- Las llamadas no imprimen nada; el resultado sale en la tabla del final
\o /dev/null

-- ---------- Integridad: llaves, unicidad y CHECK ----------
SELECT pg_temp.intentar('integridad', 'Llave primaria: ciudad repetida', '23505',
  $q$INSERT INTO ciudad VALUES ('07101', 'Otra Tuxtla', 'Chiapas')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: clave INEGI de 4 dígitos', '23514',
  $q$INSERT INTO ciudad VALUES ('7101', 'Tuxtla', 'Chiapas')$q$);
SELECT pg_temp.intentar('integridad', 'UNIQUE: RFC repetido', '23505',
  $q$INSERT INTO cliente (razon_social, rfc) VALUES ('Copia', 'ASO120304AB1')$q$);
SELECT pg_temp.intentar('integridad', 'NOT NULL: cliente sin razón social', '23502',
  $q$INSERT INTO cliente (razon_social, rfc) VALUES (NULL, 'XXX000000XX0')$q$);
SELECT pg_temp.intentar('integridad', 'UNIQUE: licencia de conductor repetida', '23505',
  $q$INSERT INTO conductor (nombre, licencia) VALUES ('Copia', 'LIC-CH-0001')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: tipo de vehículo no permitido', '23514',
  $q$INSERT INTO vehiculo VALUES ('PRU-0001', 'Avión', 1000, 'Disponible', NULL)$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: capacidad de 0 kg', '23514',
  $q$INSERT INTO vehiculo VALUES ('PRU-0001', 'Camión', 0, 'Disponible', NULL)$q$);
SELECT pg_temp.intentar('integridad', 'Llave foránea: conductor que no existe', '23503',
  $q$INSERT INTO vehiculo VALUES ('PRU-0001', 'Camión', 1000, 'Disponible', 999999)$q$);
SELECT pg_temp.intentar('integridad', 'Llave foránea: cliente que no existe', '23503',
  $q$INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ('E-900001', 999999, '07101', '07078', 10, 'Normal', 'Pendiente')$q$);
SELECT pg_temp.intentar('integridad', 'Llave foránea: ciudad que no existe', '23503',
  $q$INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ('E-900001', 1, '07101', '07999', 10, 'Normal', 'Pendiente')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: origen igual al destino', '23514',
  $q$INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ('E-900001', 1, '07101', '07101', 10, 'Normal', 'Pendiente')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: peso de 0 kg', '23514',
  $q$INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ('E-900001', 1, '07101', '07078', 0, 'Normal', 'Pendiente')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: identificador de envío sin formato E-número', '23514',
  $q$INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado)
     VALUES ('ENVIO-1', 1, '07101', '07078', 10, 'Normal', 'Pendiente')$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: estado de envío no permitido', '23514',
  $q$UPDATE envio SET estado = 'Perdido' WHERE id_envio = 'E-101'$q$);
SELECT pg_temp.intentar('integridad', 'Llave foránea: borrar un cliente que tiene envíos', '23503',
  $q$DELETE FROM cliente WHERE id_cliente = 1$q$);
SELECT pg_temp.intentar('integridad', 'CHECK: tipo de evento no permitido', '23514',
  $q$INSERT INTO eventos_pendientes (tipo, payload) VALUES ('ENVIO_PERDIDO', '{}')$q$);

-- ---------- Cardinalidad: índices únicos parciales de asignacion ----------
-- E-102 ya tiene una asignación activa con CHP-1001
SELECT pg_temp.intentar('cardinalidad', 'Un envío no puede tener dos asignaciones activas', '23505',
  $q$INSERT INTO asignacion (id_envio, placa) VALUES ('E-102', 'CHP-1006')$q$);
SELECT pg_temp.intentar('cardinalidad', 'Un vehículo no puede tener dos asignaciones activas', '23505',
  $q$INSERT INTO asignacion (id_envio, placa) VALUES ('E-101', 'CHP-1001')$q$);
SELECT pg_temp.intentar('cardinalidad', 'Un envío sí puede tener varias asignaciones cerradas', 'sin error',
  $q$INSERT INTO asignacion (id_envio, placa, fecha_fin, activa) VALUES ('E-105', 'CHP-1006', NOW(), FALSE)$q$);

\o

-- ---------- Transacciones ----------
-- Asignar en una sola transacción: crear la asignación, cambiar los dos estados y dejar el evento.
-- El cuarto paso falla a propósito (tipo de evento inválido): los tres anteriores se deshacen con él.
DO $$
DECLARE
  estado_envio TEXT;
  estado_vehiculo TEXT;
  asignaciones INT;
  error TEXT := 'sin error';
BEGIN
  BEGIN
    INSERT INTO asignacion (id_envio, placa) VALUES ('E-101', 'CHP-1006');
    UPDATE envio SET estado = 'Asignado' WHERE id_envio = 'E-101';
    UPDATE vehiculo SET estado = 'En ruta' WHERE placa = 'CHP-1006';
    INSERT INTO eventos_pendientes (tipo, payload) VALUES ('ASIGNACION_INVALIDA', '{"idEnvio": "E-101"}');
  EXCEPTION WHEN OTHERS THEN
    error := SQLSTATE;
  END;
  SELECT estado INTO estado_envio FROM envio WHERE id_envio = 'E-101';
  SELECT estado INTO estado_vehiculo FROM vehiculo WHERE placa = 'CHP-1006';
  SELECT count(*) INTO asignaciones FROM asignacion WHERE id_envio = 'E-101' AND placa = 'CHP-1006';
  INSERT INTO resultado (grupo, prueba, esperado, obtenido) VALUES (
    'transacción',
    'Si falla el evento, la asignación y los cambios de estado se deshacen',
    '23514; E-101 Pendiente, CHP-1006 Disponible, 0 asignaciones',
    format('%s; E-101 %s, CHP-1006 %s, %s asignaciones', error, estado_envio, estado_vehiculo, asignaciones)
  );
END $$;

-- La misma transacción sin el error: los cuatro cambios se ven juntos. Después se deshace a propósito
-- para no alterar los datos de prueba.
DO $$
DECLARE
  dentro TEXT;
  despues TEXT;
BEGIN
  BEGIN
    INSERT INTO asignacion (id_envio, placa) VALUES ('E-101', 'CHP-1006');
    UPDATE envio SET estado = 'Asignado' WHERE id_envio = 'E-101';
    UPDATE vehiculo SET estado = 'En ruta' WHERE placa = 'CHP-1006';
    INSERT INTO eventos_pendientes (tipo, payload) VALUES ('ASIGNACION_CREADA', '{"idEnvio": "E-101", "placa": "CHP-1006"}');
    SELECT format('E-101 %s, CHP-1006 %s, %s evento',
                  (SELECT estado FROM envio WHERE id_envio = 'E-101'),
                  (SELECT estado FROM vehiculo WHERE placa = 'CHP-1006'),
                  (SELECT count(*) FROM eventos_pendientes WHERE payload->>'idEnvio' = 'E-101' AND tipo = 'ASIGNACION_CREADA'))
      INTO dentro;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'deshacer';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  SELECT format('E-101 %s, CHP-1006 %s', (SELECT estado FROM envio WHERE id_envio = 'E-101'), (SELECT estado FROM vehiculo WHERE placa = 'CHP-1006'))
    INTO despues;
  INSERT INTO resultado (grupo, prueba, esperado, obtenido) VALUES (
    'transacción',
    'Los cuatro cambios de una asignación se aplican juntos',
    'E-101 Asignado, CHP-1006 En ruta, 1 evento',
    dentro
  ), (
    'transacción',
    'Al deshacerla, todo regresa como estaba',
    'E-101 Pendiente, CHP-1006 Disponible',
    despues
  );
END $$;

-- ---------- Cardinalidad sobre los datos cargados: cada consulta cuenta lo que no debería existir ----------
INSERT INTO resultado (grupo, prueba, esperado, obtenido)
SELECT 'datos', 'Envíos Asignado o En camino sin asignación activa', '0', count(*)::text
FROM envio e
WHERE e.estado IN ('Asignado', 'En camino')
  AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.id_envio = e.id_envio AND a.activa)
UNION ALL
SELECT 'datos', 'Envíos Pendiente, Entregado o Cancelado con asignación activa', '0', count(*)::text
FROM envio e
JOIN asignacion a ON a.id_envio = e.id_envio AND a.activa
WHERE e.estado IN ('Pendiente', 'Entregado', 'Cancelado')
UNION ALL
SELECT 'datos', 'Vehículos con asignación activa que no están En ruta', '0', count(*)::text
FROM vehiculo v
JOIN asignacion a ON a.placa = v.placa AND a.activa
WHERE v.estado <> 'En ruta'
UNION ALL
SELECT 'datos', 'Asignaciones activas con un vehículo que no aguanta el peso', '0', count(*)::text
FROM asignacion a
JOIN envio e ON e.id_envio = a.id_envio
JOIN vehiculo v ON v.placa = a.placa
WHERE a.activa AND v.capacidad_kg < e.peso_kg
UNION ALL
SELECT 'datos', 'Asignaciones cerradas sin fecha de fin', '0', count(*)::text
FROM asignacion
WHERE NOT activa AND fecha_fin IS NULL;

-- ---------- Resultado ----------
SELECT grupo,
       prueba,
       esperado,
       obtenido,
       CASE WHEN obtenido = esperado OR obtenido LIKE esperado || ' %' THEN 'sí' ELSE 'NO' END AS cumple
FROM resultado
ORDER BY orden;

SELECT count(*) FILTER (WHERE obtenido = esperado OR obtenido LIKE esperado || ' %') AS cumplen,
       count(*) AS pruebas
FROM resultado;
