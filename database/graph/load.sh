#!/bin/bash
# Lo ejecuta el contenedor neo4j-init cuando Neo4j ya está listo.
# Corre primero schema/ (restricciones e índices) y luego data/ (red de ejemplo), en orden alfabético.
# Los scripts usan MERGE y CREATE ... IF NOT EXISTS, así que correrlo dos veces no duplica datos.
set -e

for carpeta in schema data; do
  for archivo in /hopwright/graph/$carpeta/*.cypher; do
    [ -e "$archivo" ] || continue
    echo "Ejecutando $archivo"
    cypher-shell -a bolt://neo4j:7687 -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -f "$archivo"
  done
done

echo "Base de grafos lista"
