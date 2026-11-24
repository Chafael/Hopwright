-- Datos de prueba coherentes con la red de Neo4j y el plan de trabajo.

INSERT INTO ciudad (id_ciudad, nombre, estado) VALUES
  ('07101', 'Tuxtla Gutiérrez', 'Chiapas'),
  ('07078', 'San Cristóbal de las Casas', 'Chiapas'),
  ('07089', 'Tapachula', 'Chiapas'),
  ('07019', 'Comitán de Domínguez', 'Chiapas'),
  ('07065', 'Palenque', 'Chiapas'),
  ('07059', 'Ocosingo', 'Chiapas'),
  ('07097', 'Tonalá', 'Chiapas'),
  ('07108', 'Villaflores', 'Chiapas'),
  ('07017', 'Cintalapa', 'Chiapas'),
  ('07009', 'Arriaga', 'Chiapas');

INSERT INTO usuario (nombre, correo, password_hash, rol, activo) VALUES
  ('Despacho Central', 'despacho@hopwright.local', '$2b$10$U4/3E7ZtinkuCQ31YTrSpOIi34MO6F4M8jf.wqeAzbMD2EsTubwV6', 'despachador', TRUE),
  ('Administración Hopwright', 'admin@hopwright.local', '$2b$10$U4/3E7ZtinkuCQ31YTrSpOIi34MO6F4M8jf.wqeAzbMD2EsTubwV6', 'administrador', TRUE);

INSERT INTO cliente (razon_social, rfc, telefono, correo) VALUES
  ('Alimentos del Soconusco SA de CV', 'ASO120304AB1', '9621234567', 'contacto@soconusco.mx'),
  ('Farmacéutica Maya SA de CV', 'FMA090812CD2', '9612345678', 'logistica@farmaya.mx'),
  ('Químicos Chiapas SA de CV', 'QCH150101EF3', '9633456789', 'envios@quimchiapas.mx'),
  ('Comercial del Sureste SA de CV', 'CSU180715GH4', '9684567890', 'operaciones@sureste.mx');

INSERT INTO conductor (nombre, licencia, telefono, activo) VALUES
  ('Carlos Méndez', 'LIC-CH-0001', '9611111111', TRUE),
  ('Laura Pérez', 'LIC-CH-0002', '9612222222', TRUE),
  ('José Ramírez', 'LIC-CH-0003', '9613333333', TRUE),
  ('María López', 'LIC-CH-0004', '9614444444', TRUE);

INSERT INTO vehiculo (placa, tipo, capacidad_kg, estado, id_conductor) VALUES
  ('CHP-1001', 'Camión', 8000.00, 'En ruta', 1),
  ('CHP-1002', 'Tráiler', 25000.00, 'Disponible', 2),
  ('CHP-1003', 'Camión', 8000.00, 'Disponible', 3),
  ('CHP-1004', 'Tráiler', 25000.00, 'En taller', NULL),
  ('CHP-1005', 'Camión', 3500.00, 'En ruta', 4),
  ('CHP-1006', 'Camión', 8000.00, 'Disponible', NULL);

INSERT INTO envio (id_envio, id_cliente, id_ciudad_origen, id_ciudad_destino, peso_kg, prioridad, estado, fecha_salida, creado_en) VALUES
  ('E-101', 1, '07101', '07078', 1200.00, 'Normal', 'Pendiente', NULL, '2026-11-20T08:00:00-06:00'),
  ('E-102', 2, '07078', '07089', 900.00, 'Urgente', 'Asignado', NULL, '2026-11-20T08:10:00-06:00'),
  ('E-103', 3, '07101', '07019', 3000.00, 'Normal', 'Pendiente', NULL, '2026-11-20T08:20:00-06:00'),
  ('E-104', 4, '07089', '07101', 5000.00, 'Normal', 'En camino', '2026-11-20T09:00:00-06:00', '2026-11-20T08:30:00-06:00'),
  ('E-105', 1, '07065', '07101', 7000.00, 'Normal', 'Entregado', '2026-11-19T07:00:00-06:00', '2026-11-19T06:00:00-06:00'),
  ('E-106', 2, '07017', '07097', 1500.00, 'Urgente', 'Pendiente', NULL, '2026-11-20T09:10:00-06:00'),
  ('E-107', 3, '07059', '07065', 2200.00, 'Normal', 'Asignado', NULL, '2026-11-20T09:20:00-06:00'),
  ('E-108', 4, '07108', '07009', 1800.00, 'Normal', 'Cancelado', NULL, '2026-11-20T09:30:00-06:00');

INSERT INTO asignacion (id_envio, placa, fecha_asignacion, fecha_fin, activa) VALUES
  ('E-102', 'CHP-1001', '2026-11-20T08:15:00-06:00', NULL, TRUE),
  ('E-107', 'CHP-1005', '2026-11-20T09:25:00-06:00', NULL, TRUE),
  ('E-104', 'CHP-1003', '2026-11-20T08:40:00-06:00', '2026-11-20T09:00:00-06:00', FALSE),
  ('E-105', 'CHP-1002', '2026-11-19T06:30:00-06:00', '2026-11-19T18:00:00-06:00', FALSE);
