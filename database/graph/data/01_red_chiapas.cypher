// Red de ejemplo de Chiapas: 22 ciudades, 9 intersecciones y 5 estaciones de tren.
//
// Las distancias (km) y los tiempos (minutos, para un camión de carga) son aproximados y sirven
// para demostrar el modelo, no son datos oficiales. Las claves de ciudad son las claves de
// municipio del INEGI (estado 07 = Chiapas) y deben coincidir con el catálogo de PostgreSQL.
//
// Cada tramo de doble sentido se guarda como dos aristas CARRETERA (regla R14). Cuando subir y
// bajar tarda distinto, el tramo trae minVuelta.
// El script usa MERGE, así que correrlo dos veces no duplica nada.

// ---------- Ciudades ----------
// idCiudad y nombre son réplica de PostgreSQL. latitud y longitud son del grafo: la ubicación en el
// mapa es geometría de la red, igual que en las intersecciones y estaciones.
UNWIND [
  {id: '07101', nombre: 'Tuxtla Gutiérrez', lat: 16.7521, lon: -93.1167},
  {id: '07027', nombre: 'Chiapa de Corzo', lat: 16.7072, lon: -93.0136},
  {id: '07078', nombre: 'San Cristóbal de las Casas', lat: 16.7370, lon: -92.6376},
  {id: '07019', nombre: 'Comitán de Domínguez', lat: 16.2511, lon: -92.1342},
  {id: '07094', nombre: 'Teopisca', lat: 16.5401, lon: -92.4737},
  {id: '07059', nombre: 'Ocosingo', lat: 16.9068, lon: -92.0936},
  {id: '07065', nombre: 'Palenque', lat: 17.5097, lon: -91.9822},
  {id: '07012', nombre: 'Berriozábal', lat: 16.7999, lon: -93.2735},
  {id: '07061', nombre: 'Ocozocoautla de Espinosa', lat: 16.7618, lon: -93.3753},
  {id: '07046', nombre: 'Jiquipilas', lat: 16.6667, lon: -93.6431},
  {id: '07017', nombre: 'Cintalapa', lat: 16.6974, lon: -93.7203},
  {id: '07009', nombre: 'Arriaga', lat: 16.2362, lon: -93.8984},
  {id: '07097', nombre: 'Tonalá', lat: 16.0889, lon: -93.7544},
  {id: '07069', nombre: 'Pijijiapan', lat: 15.6864, lon: -93.2112},
  {id: '07051', nombre: 'Mapastepec', lat: 15.4346, lon: -92.8994},
  {id: '07040', nombre: 'Huixtla', lat: 15.1385, lon: -92.4643},
  {id: '07089', nombre: 'Tapachula', lat: 14.9030, lon: -92.2575},
  {id: '07086', nombre: 'Suchiapa', lat: 16.6269, lon: -93.0972},
  {id: '07108', nombre: 'Villaflores', lat: 16.2333, lon: -93.2667},
  {id: '07099', nombre: 'La Trinitaria', lat: 16.1196, lon: -92.0517},
  {id: '07057', nombre: 'Motozintla', lat: 15.3667, lon: -92.2500},
  {id: '07068', nombre: 'Pichucalco', lat: 17.5114, lon: -93.1167}
] AS c
MERGE (n:Ciudad {idCiudad: c.id})
SET n.nombre = c.nombre, n.latitud = c.lat, n.longitud = c.lon;

// ---------- Intersecciones ----------
UNWIND [
  {id: 'INT-CHC', nombre: 'Caseta Chiapa de Corzo',      tipo: 'Caseta', lat: 16.7310, lon: -92.9790},
  {id: 'INT-OCO', nombre: 'Entronque Ocozocoautla',      tipo: 'Cruce',  lat: 16.7620, lon: -93.3550},
  {id: 'INT-CRU', nombre: 'Entronque Las Cruces',        tipo: 'Cruce',  lat: 16.5480, lon: -94.0410},
  {id: 'INT-TPN', nombre: 'Entronque Tapanatepec',       tipo: 'Cruce',  lat: 16.3710, lon: -94.1960},
  {id: 'INT-AMA', nombre: 'Entronque Amatenango',        tipo: 'Cruce',  lat: 16.5300, lon: -92.4300},
  {id: 'INT-OXC', nombre: 'Entronque Oxchuc',            tipo: 'Cruce',  lat: 16.7880, lon: -92.3450},
  {id: 'INT-ESC', nombre: 'Entronque Escuintla',         tipo: 'Cruce',  lat: 15.3250, lon: -92.6590},
  {id: 'INT-BOC', nombre: 'Entronque Bochil',            tipo: 'Cruce',  lat: 16.9960, lon: -92.8930},
  {id: 'INT-FCO', nombre: 'Glorieta Frontera Comalapa',  tipo: 'Glorieta', lat: 15.6600, lon: -92.1400}
] AS i
MERGE (n:Interseccion {idInterseccion: i.id})
SET n.nombre = i.nombre, n.tipo = i.tipo, n.latitud = i.lat, n.longitud = i.lon;

// ---------- Estaciones de tren (línea de la costa) y la ciudad donde está cada una ----------
UNWIND [
  {id: 'EST-ARR', nombre: 'Estación Arriaga',    servicio: 'Carga general y contenedores', ciudad: '07009', cambio: 90, lat: 16.2330, lon: -93.9060},
  {id: 'EST-TON', nombre: 'Estación Tonalá',     servicio: 'Carga general',                ciudad: '07097', cambio: 90, lat: 16.0930, lon: -93.7580},
  {id: 'EST-PIJ', nombre: 'Estación Pijijiapan', servicio: 'Carga general',                ciudad: '07069', cambio: 90, lat: 15.6900, lon: -93.2160},
  {id: 'EST-HUI', nombre: 'Estación Huixtla',    servicio: 'Carga general',                ciudad: '07040', cambio: 90, lat: 15.1420, lon: -92.4690},
  {id: 'EST-TAP', nombre: 'Estación Tapachula',  servicio: 'Carga general y contenedores', ciudad: '07089', cambio: 60, lat: 14.9080, lon: -92.2630}
] AS e
MERGE (s:Estacion {idEstacion: e.id})
SET s.nombre = e.nombre, s.tipoServicio = e.servicio, s.latitud = e.lat, s.longitud = e.lon
WITH s, e
MATCH (c:Ciudad {idCiudad: e.ciudad})
MERGE (s)-[u:UBICADA_EN]->(c)
SET u.tiempoCambioMin = e.cambio;

// ---------- Tramos de carretera (dos aristas por tramo, una por sentido) ----------
// a, b: idCiudad o idInterseccion. km, min: distancia y tiempo de a hacia b.
// minVuelta: tiempo de b hacia a cuando es distinto. caseta: costo de caseta en pesos.
UNWIND [
  {a: '07101',   b: '07027',   km: 15,  min: 20,  caseta: 0,   via: 'Federal'},
  {a: '07027',   b: 'INT-CHC', km: 12,  min: 12,  caseta: 0,   via: 'Autopista'},
  {a: 'INT-CHC', b: '07078',   km: 33,  min: 40,  minVuelta: 32, caseta: 180, via: 'Autopista'},
  {a: '07027',   b: '07078',   km: 60,  min: 85,  minVuelta: 75, caseta: 0, via: 'Federal'},
  {a: '07101',   b: '07012',   km: 18,  min: 20,  caseta: 0,   via: 'Federal'},
  {a: '07012',   b: 'INT-OCO', km: 17,  min: 18,  caseta: 0,   via: 'Federal'},
  {a: 'INT-OCO', b: '07061',   km: 4,   min: 6,   caseta: 0,   via: 'Federal'},
  {a: 'INT-OCO', b: '07046',   km: 35,  min: 35,  caseta: 0,   via: 'Federal'},
  {a: '07046',   b: '07017',   km: 20,  min: 20,  caseta: 0,   via: 'Federal'},
  {a: '07017',   b: 'INT-CRU', km: 45,  min: 50,  caseta: 0,   via: 'Federal'},
  {a: 'INT-CRU', b: 'INT-TPN', km: 40,  min: 45,  caseta: 0,   via: 'Federal'},
  {a: 'INT-TPN', b: '07009',   km: 30,  min: 30,  caseta: 0,   via: 'Federal'},
  {a: '07046',   b: '07009',   km: 70,  min: 120, caseta: 0,   via: 'Terracería'},
  {a: '07009',   b: '07097',   km: 25,  min: 25,  caseta: 0,   via: 'Federal'},
  {a: '07097',   b: '07069',   km: 75,  min: 70,  caseta: 0,   via: 'Federal'},
  {a: '07069',   b: '07051',   km: 45,  min: 40,  caseta: 0,   via: 'Federal'},
  {a: '07051',   b: 'INT-ESC', km: 45,  min: 45,  caseta: 0,   via: 'Federal'},
  {a: 'INT-ESC', b: '07040',   km: 25,  min: 25,  caseta: 0,   via: 'Federal'},
  {a: '07040',   b: '07089',   km: 40,  min: 40,  caseta: 0,   via: 'Federal'},
  {a: '07101',   b: '07086',   km: 17,  min: 20,  caseta: 0,   via: 'Federal'},
  {a: '07086',   b: '07108',   km: 70,  min: 75,  caseta: 0,   via: 'Federal'},
  {a: '07078',   b: '07094',   km: 33,  min: 35,  caseta: 0,   via: 'Federal'},
  {a: '07094',   b: 'INT-AMA', km: 15,  min: 15,  caseta: 0,   via: 'Federal'},
  {a: 'INT-AMA', b: '07019',   km: 40,  min: 40,  caseta: 0,   via: 'Federal'},
  {a: '07078',   b: 'INT-OXC', km: 40,  min: 55,  caseta: 0,   via: 'Federal'},
  {a: 'INT-OXC', b: '07059',   km: 50,  min: 70,  caseta: 0,   via: 'Federal'},
  {a: '07059',   b: '07065',   km: 115, min: 150, caseta: 0,   via: 'Federal'},
  {a: '07019',   b: '07099',   km: 16,  min: 15,  caseta: 0,   via: 'Federal'},
  {a: '07099',   b: 'INT-FCO', km: 60,  min: 60,  caseta: 0,   via: 'Federal'},
  {a: 'INT-FCO', b: '07057',   km: 70,  min: 100, caseta: 0,   via: 'Federal'},
  {a: '07057',   b: '07040',   km: 75,  min: 110, caseta: 0,   via: 'Estatal'},
  {a: '07101',   b: 'INT-BOC', km: 70,  min: 90,  caseta: 0,   via: 'Federal'},
  {a: 'INT-BOC', b: '07068',   km: 110, min: 150, caseta: 0,   via: 'Federal'}
] AS t
MATCH (x) WHERE (x:Ciudad AND x.idCiudad = t.a) OR (x:Interseccion AND x.idInterseccion = t.a)
MATCH (y) WHERE (y:Ciudad AND y.idCiudad = t.b) OR (y:Interseccion AND y.idInterseccion = t.b)
MERGE (x)-[ida:CARRETERA {tipoVia: t.via}]->(y)
SET ida.distanciaKm = toFloat(t.km), ida.tiempoMin = t.min, ida.costoCaseta = toFloat(t.caseta), ida.abierto = true
MERGE (y)-[vuelta:CARRETERA {tipoVia: t.via}]->(x)
SET vuelta.distanciaKm = toFloat(t.km), vuelta.tiempoMin = coalesce(t.minVuelta, t.min),
    vuelta.costoCaseta = toFloat(t.caseta), vuelta.abierto = true;

// ---------- Vía férrea de la costa (dos aristas por tramo) ----------
// costoTon: pesos por tonelada transportada en ese tramo
UNWIND [
  {a: 'EST-ARR', b: 'EST-TON', km: 25, min: 40,  costoTon: 15},
  {a: 'EST-TON', b: 'EST-PIJ', km: 75, min: 110, costoTon: 45},
  {a: 'EST-PIJ', b: 'EST-HUI', km: 90, min: 130, costoTon: 54},
  {a: 'EST-HUI', b: 'EST-TAP', km: 40, min: 60,  costoTon: 24}
] AS t
MATCH (x:Estacion {idEstacion: t.a}), (y:Estacion {idEstacion: t.b})
MERGE (x)-[ida:VIA_FERREA]->(y)
SET ida.distanciaKm = toFloat(t.km), ida.tiempoMin = t.min, ida.costoPorTonelada = toFloat(t.costoTon)
MERGE (y)-[vuelta:VIA_FERREA]->(x)
SET vuelta.distanciaKm = toFloat(t.km), vuelta.tiempoMin = t.min, vuelta.costoPorTonelada = toFloat(t.costoTon);
