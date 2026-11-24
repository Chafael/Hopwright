-- Esquema relacional de Hopwright (fuente de verdad operativa).
-- Las tablas se crean en orden de dependencias para respetar las llaves foráneas.

CREATE TABLE usuario (
  id_usuario      BIGSERIAL PRIMARY KEY,
  nombre          TEXT NOT NULL,
  correo          TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  rol             TEXT NOT NULL CHECK (rol IN ('despachador', 'administrador')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cliente (
  id_cliente    BIGSERIAL PRIMARY KEY,
  razon_social  TEXT NOT NULL,
  rfc           TEXT NOT NULL UNIQUE,
  telefono      TEXT,
  correo        TEXT
);

CREATE TABLE conductor (
  id_conductor  BIGSERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  licencia      TEXT NOT NULL UNIQUE,
  telefono      TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ciudad (
  id_ciudad  TEXT PRIMARY KEY CHECK (id_ciudad ~ '^[0-9]{5}$'),
  nombre     TEXT NOT NULL,
  estado     TEXT NOT NULL
);

CREATE TABLE vehiculo (
  placa         TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('Camión', 'Tráiler', 'Tren')),
  capacidad_kg  NUMERIC(10,2) NOT NULL CHECK (capacidad_kg > 0),
  estado        TEXT NOT NULL CHECK (estado IN ('Disponible', 'En ruta', 'En taller')),
  id_conductor  BIGINT REFERENCES conductor(id_conductor)
);

CREATE TABLE envio (
  id_envio           TEXT PRIMARY KEY CHECK (id_envio ~ '^E-[0-9]+$'),
  id_cliente         BIGINT NOT NULL REFERENCES cliente(id_cliente),
  id_ciudad_origen   TEXT NOT NULL REFERENCES ciudad(id_ciudad),
  id_ciudad_destino  TEXT NOT NULL REFERENCES ciudad(id_ciudad),
  peso_kg            NUMERIC(10,2) NOT NULL CHECK (peso_kg > 0),
  prioridad          TEXT NOT NULL CHECK (prioridad IN ('Normal', 'Urgente')),
  estado             TEXT NOT NULL CHECK (estado IN ('Pendiente', 'Asignado', 'En camino', 'Entregado', 'Cancelado')),
  fecha_salida       TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id_ciudad_origen <> id_ciudad_destino)
);

CREATE TABLE asignacion (
  id_asignacion     BIGSERIAL PRIMARY KEY,
  id_envio          TEXT NOT NULL REFERENCES envio(id_envio),
  placa             TEXT NOT NULL REFERENCES vehiculo(placa),
  fecha_asignacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin         TIMESTAMPTZ,
  activa            BOOLEAN NOT NULL DEFAULT TRUE
);

-- Un vehículo y un envío solo pueden tener una asignación activa a la vez.
CREATE UNIQUE INDEX asignacion_vehiculo_activa_idx ON asignacion (placa) WHERE activa;
CREATE UNIQUE INDEX asignacion_envio_activa_idx ON asignacion (id_envio) WHERE activa;

CREATE TABLE eventos_pendientes (
  id            BIGSERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL,
  payload       JSONB NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicado', 'fallido')),
  intentos      INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error  TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aplicado_en   TIMESTAMPTZ
);

-- Índices para joins y filtros frecuentes.
CREATE INDEX envio_id_cliente_idx ON envio (id_cliente);
CREATE INDEX envio_origen_idx ON envio (id_ciudad_origen);
CREATE INDEX envio_destino_idx ON envio (id_ciudad_destino);
CREATE INDEX envio_estado_idx ON envio (estado);
CREATE INDEX vehiculo_estado_idx ON vehiculo (estado);
CREATE INDEX vehiculo_conductor_idx ON vehiculo (id_conductor);
CREATE INDEX asignacion_envio_idx ON asignacion (id_envio);
CREATE INDEX asignacion_placa_idx ON asignacion (placa);
CREATE INDEX eventos_pendientes_estado_idx ON eventos_pendientes (estado, creado_en);
