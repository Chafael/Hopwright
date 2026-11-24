# Fuentes de la red de Chiapas

- `cabeceras.json`: las 124 cabeceras municipales de Chiapas con su clave, nombre del municipio, nombre de la localidad, coordenadas y población. Salen del Catálogo Único de Claves de Áreas Geoestadísticas Estatales, Municipales y Localidades del INEGI (corte de octubre de 2020), tomado de la versión que publica [developarts/AGEEML](https://github.com/developarts/AGEEML). Se usó la localidad con clave 0001 de cada municipio, que es la cabecera. La excepción es Francisco León, cuya cabecera es Rivera el Viejo Carmen (0042), porque se reubicó después de la erupción del Chichonal en 1982.
- `pares-osrm.json`: los puntos de la red (cabeceras e intersecciones) y los pares que se consultan: cada punto con sus 8 vecinos más cercanos a menos de 150 km en línea recta, más los tramos de la red anterior.
- `osrm-rutas.json`: lo que respondió OSRM para cada par (distancia, tiempo, trazo y los tramos de la ruta). Se genera con `node database/graph/scripts/consultar-osrm.mjs`.
- `guatemala.geojson`: frontera de Guatemala de [Natural Earth](https://www.naturalearthdata.com/) (1:10 m). Sirve para descartar rutas que OSRM haga pasar por Guatemala.

Los datos de rutas son de OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL) calculados con el servidor público de OSRM.
