#!/bin/bash
# Lo ejecuta el contenedor de PostgreSQL la primera vez que se crea el volumen.
# Corre primero el esquema y después los datos de prueba. Si un script falla, se detiene.
set -e

for carpeta in schema data; do
  for archivo in /hopwright/relational/$carpeta/*.sql; do
    [ -e "$archivo" ] || continue
    echo "Ejecutando $archivo"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$archivo"
  done
done
