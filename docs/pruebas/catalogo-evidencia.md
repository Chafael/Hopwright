# Evidencia del catálogo de operaciones

Generado por `npm run catalogo` (tests/catalogo/evidencia.mts) el 27/11/2026, 6:00:22 p.m., commit `c2515d1`. Cada caso es una petición HTTP real a la API con las tres bases en Docker; los de tipo verificación revisan directo en la base que un cambio llegó a su réplica.

Resultado: 111 de 111 casos cumplen lo esperado.

Datos de la corrida: envío E-7018278, vehículo PRU-018278, ciudad 07908, incidente INC-0217. Todo se borró de las tres bases al terminar.

## OP-R01. Iniciar sesión

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R01-N1 | normal | `POST /auth/login` | 200, regresa un token JWT | 200 | 91.3 | sí |
| R01-N2 | normal | `POST /auth/login` | 200, regresa un token JWT | 200 | 87.5 | sí |
| R01-E1 | error | `POST /auth/login` | 401 | 401 | 81.8 | sí |
| R01-E2 | error | `POST /auth/login` | 401, mismo mensaje que R01-E1 | 401 | 3.8 | sí |
| R01-E3 | error | `POST /auth/login` | 400 | 400 | 2.5 | sí |
| R01-L1 | límite | `POST /ciudades` | 403 | 403 | 5.1 | sí |
| R01-L2 | límite | `POST /envios` | 401 | 401 | 3.2 | sí |

R01-N1. Despachador con credenciales correctas.

Cuerpo enviado:

```json
{"correo":"despacho@hopwright.local","password":"hopwright123"}
```

Respuesta:

```json
{
 "token": "eyJhbGciOiJIUzI1NiIsInR5…"
}
```

R01-N2. Administrador con credenciales correctas.

Cuerpo enviado:

```json
{"correo":"admin@hopwright.local","password":"hopwright123"}
```

Respuesta:

```json
{
 "token": "eyJhbGciOiJIUzI1NiIsInR5…"
}
```

R01-E1. Contraseña incorrecta.

Cuerpo enviado:

```json
{"correo":"despacho@hopwright.local","password":"otra"}
```

Respuesta:

```json
{
 "error": "No autorizado",
 "mensaje": "Correo o contraseña incorrectos",
 "statusCode": 401
}
```

R01-E2. Correo que no existe: mismo mensaje que la contraseña incorrecta.

Cuerpo enviado:

```json
{"correo":"nadie@hopwright.local","password":"hopwright123"}
```

Respuesta:

```json
{
 "error": "No autorizado",
 "mensaje": "Correo o contraseña incorrectos",
 "statusCode": 401
}
```

R01-E3. Falta la contraseña.

Cuerpo enviado:

```json
{"correo":"despacho@hopwright.local"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body must have required property 'password'",
 "statusCode": 400
}
```

R01-L1. Token válido de despachador en una operación solo de administrador.

Cuerpo enviado:

```json
{"idCiudad":"07908","nombre":"No se debe crear","estado":"Chiapas"}
```

Respuesta:

```json
{
 "error": "Prohibido",
 "mensaje": "No tienes permisos para esta operación",
 "statusCode": 403
}
```

R01-L2. Escritura sin token.

Cuerpo enviado:

```json
{"idEnvio":"E-7018278","idCliente":1,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":10,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "No autorizado",
 "mensaje": "Token inválido o ausente",
 "statusCode": 401
}
```

## OP-R02. Registrar cliente

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R02-N1 | normal | `POST /clientes` | 201 | 201 | 8.9 | sí |
| R02-L1 | límite | `POST /clientes` | 201, se guarda en mayúsculas | 201 | 4.5 | sí |
| R02-E1 | error | `POST /clientes` | 409 | 409 | 7.2 | sí |
| R02-E2 | error | `POST /clientes` | 400 | 400 | 1.6 | sí |

R02-N1. Cliente nuevo.

Cuerpo enviado:

```json
{"razonSocial":"Cliente de prueba 018278","rfc":"PRU018278AB1","telefono":"9610000000","correo":"prueba@hopwright.local"}
```

Respuesta:

```json
{
 "idCliente": 11,
 "razonSocial": "Cliente de prueba 018278",
 "rfc": "PRU018278AB1",
 "telefono": "9610000000",
 "correo": "prueba@hopwright.local"
}
```

R02-L1. RFC de 5 caracteres (el mínimo) escrito en minúsculas.

Cuerpo enviado:

```json
{"razonSocial":"Cliente corto 018278","rfc":"p8278"}
```

Respuesta:

```json
{
 "idCliente": 12,
 "razonSocial": "Cliente corto 018278",
 "rfc": "P8278",
 "telefono": null,
 "correo": null
}
```

R02-E1. RFC repetido (escrito en minúsculas).

Cuerpo enviado:

```json
{"razonSocial":"Otro","rfc":"pru018278ab1"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "Ya existe un cliente con ese RFC",
 "statusCode": 409
}
```

R02-E2. RFC de 4 caracteres.

Cuerpo enviado:

```json
{"razonSocial":"Otro","rfc":"ABCD"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/rfc must NOT have fewer than 5 characters",
 "statusCode": 400
}
```

## OP-R03. Registrar vehículo

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R03-N1 | normal | `POST /vehiculos` | 201 | 201 | 11.1 | sí |
| R03-V1 | verificación | `GET /vehiculos/PRU-018278/ubicacion` | 404 | 404 | 6.5 | sí |
| R03-V2 | verificación | `GET /vehiculos/PRU-018278/ubicacion` | 200, punto: null | 200 | 5.6 | sí |
| R03-L1 | límite | `POST /vehiculos` | 400 | 400 | 1.4 | sí |
| R03-E1 | error | `POST /vehiculos` | 409 | 409 | 3.6 | sí |
| R03-E2 | error | `POST /vehiculos` | 400 | 400 | 1.2 | sí |

R03-N1. Camión de 9,000 kg.

Cuerpo enviado:

```json
{"placa":"PRU-018278","tipo":"Camión","capacidadKg":9000,"estado":"Disponible"}
```

Respuesta:

```json
{
 "placa": "PRU-018278",
 "tipo": "Camión",
 "capacidadKg": 9000,
 "estado": "Disponible",
 "idConductor": null
}
```

R03-V1. Antes de aplicar VEHICULO_GUARDADO el grafo no conoce la placa.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El vehículo PRU-018278 no existe en la red",
 "statusCode": 404
}
```

R03-V2. Después del procesador la placa ya está en Neo4j, todavía sin ubicación.

Respuesta:

```json
{
 "placa": "PRU-018278",
 "punto": null,
 "fechaHora": null
}
```

R03-L1. Capacidad de 0 kg.

Cuerpo enviado:

```json
{"placa":"PRU-018278X","tipo":"Camión","capacidadKg":0,"estado":"Disponible"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/capacidadKg must be > 0",
 "statusCode": 400
}
```

R03-E1. Placa repetida.

Cuerpo enviado:

```json
{"placa":"CHP-1001","tipo":"Camión","capacidadKg":8000,"estado":"Disponible"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El vehículo CHP-1001 ya existe",
 "statusCode": 409
}
```

R03-E2. Tipo de vehículo que no existe.

Cuerpo enviado:

```json
{"placa":"PRU-018278X","tipo":"Avión","capacidadKg":1000,"estado":"Disponible"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/tipo must be equal to one of the allowed values",
 "statusCode": 400
}
```

## OP-R04. Registrar envío

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R04-N1 | normal | `POST /envios` | 201, estado Pendiente | 201 | 23.3 | sí |
| R04-L1 | límite | `POST /envios` | 400 | 400 | 1.2 | sí |
| R04-L2 | límite | `POST /envios` | 400 | 400 | 1.1 | sí |
| R04-E1 | error | `POST /envios` | 400 | 400 | 3.3 | sí |
| R04-E2 | error | `POST /envios` | 409 | 409 | 6.1 | sí |
| R04-E3 | error | `POST /envios` | 400 | 400 | 1.6 | sí |

R04-N1. Envío de 9,000 kg de Tuxtla a Comitán.

Cuerpo enviado:

```json
{"idEnvio":"E-7018278","idCliente":11,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":9000,"prioridad":"Urgente"}
```

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "idCliente": 11,
 "idCiudadOrigen": "07101",
 "idCiudadDestino": "07019",
 "pesoKg": 9000,
 "prioridad": "Urgente",
 "estado": "Pendiente",
 "fechaSalida": null,
 "creadoEn": "2026-11-28T00:00:21.324Z"
}
```

R04-L1. Origen igual al destino.

Cuerpo enviado:

```json
{"idEnvio":"E-6018278","idCliente":11,"idCiudadOrigen":"07101","idCiudadDestino":"07101","pesoKg":10,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "El origen y destino deben ser distintos",
 "statusCode": 400
}
```

R04-L2. Peso de 0 kg.

Cuerpo enviado:

```json
{"idEnvio":"E-6018278","idCliente":11,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":0,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/pesoKg must be > 0",
 "statusCode": 400
}
```

R04-E1. Cliente que no existe.

Cuerpo enviado:

```json
{"idEnvio":"E-6018278","idCliente":999999,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":10,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "El cliente indicado no existe",
 "statusCode": 400
}
```

R04-E2. Identificador repetido.

Cuerpo enviado:

```json
{"idEnvio":"E-7018278","idCliente":11,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":10,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El envío E-7018278 ya existe",
 "statusCode": 409
}
```

R04-E3. Identificador sin el formato E-número.

Cuerpo enviado:

```json
{"idEnvio":"ENVIO-1","idCliente":11,"idCiudadOrigen":"07101","idCiudadDestino":"07019","pesoKg":10,"prioridad":"Normal"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/idEnvio must match pattern \"^E-[0-9]+$\"",
 "statusCode": 400
}
```

## OP-R05. Asignar vehículo a un envío

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R05-E1 | error | `POST /envios/E-7018278/asignacion` | 409 | 409 | 4.8 | sí |
| R05-E2 | error | `POST /envios/E-7018278/asignacion` | 409 | 409 | 5.1 | sí |
| R05-E3 | error | `POST /envios/E-7018278/asignacion` | 404 | 404 | 4.8 | sí |
| R05-L1 | límite | `POST /envios/E-7018278/asignacion` | 201 | 201 | 15.2 | sí |
| R05-E4 | error | `POST /envios/E-7018278/asignacion` | 409 | 409 | 3.1 | sí |
| R05-V1 | verificación | `SELECT estado FROM envio / vehiculo / eventos_pendientes` | envío Asignado, vehículo En ruta, evento ASIGNACION_CREADA | coincide | 2.4 | sí |

R05-E1. Vehículo disponible pero de 8,000 kg para un envío de 9,000 kg.

Cuerpo enviado:

```json
{"placa":"CHP-1006"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El vehículo no tiene capacidad suficiente",
 "statusCode": 409
}
```

R05-E2. Vehículo en taller.

Cuerpo enviado:

```json
{"placa":"CHP-1004"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El vehículo no está disponible",
 "statusCode": 409
}
```

R05-E3. Vehículo que no existe.

Cuerpo enviado:

```json
{"placa":"XXX-0000"}
```

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El vehículo XXX-0000 no existe",
 "statusCode": 404
}
```

R05-L1. Capacidad exactamente igual al peso (9,000 kg).

Cuerpo enviado:

```json
{"placa":"PRU-018278"}
```

Respuesta:

```json
{
 "idAsignacion": 11,
 "idEnvio": "E-7018278",
 "placa": "PRU-018278",
 "fechaAsignacion": "2026-11-28T00:00:21.868Z",
 "fechaFin": null,
 "activa": true
}
```

R05-E4. Asignar otra vez el mismo envío.

Cuerpo enviado:

```json
{"placa":"CHP-1002"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "Solo se pueden asignar envíos pendientes",
 "statusCode": 409
}
```

R05-V1. La transacción cambió los dos estados y dejó el evento.

Respuesta:

```json
{
 "envio": "Asignado",
 "vehiculo": "En ruta",
 "eventos": [
  {
   "tipo": "ASIGNACION_CREADA",
   "estado": "pendiente"
  }
 ]
}
```

## OP-R06. Salida, entrega y cancelación de un envío

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R06-N1 | normal | `POST /envios/E-7018278/salida` | 200, estado En camino | 200 | 6.8 | sí |
| R06-N2 | normal | `POST /envios/E-7018278/entrega` | 200, estado Entregado | 200 | 7.9 | sí |
| R06-L1 | límite | `POST /envios/E-7018278/entrega` | 409 | 409 | 2.8 | sí |
| R06-E1 | error | `POST /envios/E-7018278/cancelacion` | 409 | 409 | 3.3 | sí |
| R06-E2 | error | `POST /envios/E-999999/salida` | 404 | 404 | 3.5 | sí |
| R06-V1 | verificación | `GET /vehiculos/PRU-018278/ubicacion` | 200, punto Comitán | 200 | 4.9 | sí |

R06-N1. Salida del envío.

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "idCliente": 11,
 "idCiudadOrigen": "07101",
 "idCiudadDestino": "07019",
 "pesoKg": 9000,
 "prioridad": "Urgente",
 "estado": "En camino",
 "fechaSalida": "2026-11-28T00:00:21.888Z",
 "creadoEn": "2026-11-28T00:00:21.324Z"
}
```

R06-N2. Entrega del envío.

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "idCliente": 11,
 "idCiudadOrigen": "07101",
 "idCiudadDestino": "07019",
 "pesoKg": 9000,
 "prioridad": "Urgente",
 "estado": "Entregado",
 "fechaSalida": "2026-11-28T00:00:21.888Z",
 "creadoEn": "2026-11-28T00:00:21.324Z"
}
```

R06-L1. Entregar dos veces.

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "Solo se puede entregar un envío en camino",
 "statusCode": 409
}
```

R06-E1. Cancelar un envío ya entregado.

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "Solo se pueden cancelar envíos pendientes o asignados",
 "statusCode": 409
}
```

R06-E2. Dar salida a un envío que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

R06-V1. Al aplicar ENVIO_ENTREGADO el camión quedó en Comitán (Neo4j).

Respuesta:

```json
{
 "placa": "PRU-018278",
 "punto": {
  "idPunto": "07019",
  "nombre": "Comitán de Domínguez",
  "tipo": "Ciudad"
 },
 "fechaHora": "2026-11-28T00:00:22.794Z"
}
```

## OP-R07. Consultar envíos

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| R07-N1 | normal | `GET /envios?estado=Pendiente` | 200 | 200 | 2.4 | sí |
| R07-N2 | normal | `GET /envios/E-7018278` | 200 | 200 | 2.2 | sí |
| R07-L1 | límite | `GET /envios?estado=Extraviado` | 200, lista vacía | 200 | 2 | sí |
| R07-E1 | error | `GET /envios/E-999999` | 404 | 404 | 2 | sí |
| R07-E2 | error | `GET /envios/X1` | 400 | 400 | 0.9 | sí |

R07-N1. Envíos pendientes.

Respuesta:

```json
[
 {
  "idEnvio": "E-106",
  "estado": "Pendiente",
  "pesoKg": 1500
 },
 {
  "idEnvio": "E-103",
  "estado": "Pendiente",
  "pesoKg": 3000
 },
 {
  "idEnvio": "E-101",
  "estado": "Pendiente",
  "pesoKg": 1200
 }
]
```

R07-N2. Detalle del envío de prueba.

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "idCliente": 11,
 "idCiudadOrigen": "07101",
 "idCiudadDestino": "07019",
 "pesoKg": 9000,
 "prioridad": "Urgente",
 "estado": "Entregado",
 "fechaSalida": "2026-11-28T00:00:21.888Z",
 "creadoEn": "2026-11-28T00:00:21.324Z"
}
```

R07-L1. Filtro por un estado que nadie tiene.

Respuesta:

```json
[]
```

R07-E1. Envío que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

R07-E2. Identificador con formato inválido.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "params/id must match pattern \"^E-[0-9]+$\"",
 "statusCode": 400
}
```

## OP-D01. Registrar manifiesto de carga

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D01-L1 | límite | `POST /envios/E-7018278/manifiesto` | 400 | 400 | 1.6 | sí |
| D01-E1 | error | `POST /envios/E-7018278/manifiesto` | 400 | 400 | 14.3 | sí |
| D01-E2 | error | `POST /envios/E-999999/manifiesto` | 404 | 404 | 3.7 | sí |
| D01-N1 | normal | `POST /envios/E-7018278/manifiesto` | 201 | 201 | 22.6 | sí |
| D01-E3 | error | `POST /envios/E-7018278/manifiesto` | 409 | 409 | 6 | sí |
| D01-V1 | verificación | `db.manifiestos.insertOne({ idEnvio, tipoCarga: 'peligrosa', articulos: [] })` | error 121 (Document failed validation) | coincide | 7 | sí |

D01-L1. Clase UN 10 (el rango es de 1 a 9).

Cuerpo enviado:

```json
{"tipoCarga":"peligrosa","articulos":[{"descripcion":"Solvente industrial","cantidad":40,"pesoKg":200},{"descripcion":"Pintura base aceite","cantidad":30,"pesoKg":100}],"claseUN":10,"numeroONU":"UN1263","hojaSeguridad":"https://docs.hopwright.local/hs-solvente.pdf","telefonoEmergencia":"9615550000"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/claseUN must be <= 9",
 "statusCode": 400
}
```

D01-E1. Carga peligrosa sin número ONU.

Cuerpo enviado:

```json
{"tipoCarga":"peligrosa","articulos":[{"descripcion":"Solvente industrial","cantidad":40,"pesoKg":200},{"descripcion":"Pintura base aceite","cantidad":30,"pesoKg":100}],"claseUN":3,"hojaSeguridad":"https://docs.hopwright.local/hs-solvente.pdf","telefonoEmergencia":"9615550000"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "La carga peligrosa requiere claseUN (1-9), numeroONU, hojaSeguridad y telefonoEmergencia",
 "statusCode": 400
}
```

D01-E2. Envío que no existe en PostgreSQL.

Cuerpo enviado:

```json
{"tipoCarga":"peligrosa","articulos":[{"descripcion":"Solvente industrial","cantidad":40,"pesoKg":200},{"descripcion":"Pintura base aceite","cantidad":30,"pesoKg":100}],"claseUN":3,"numeroONU":"UN1263","hojaSeguridad":"https://docs.hopwright.local/hs-solvente.pdf","telefonoEmergencia":"9615550000"}
```

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

D01-N1. Manifiesto de carga peligrosa clase 3.

Cuerpo enviado:

```json
{"tipoCarga":"peligrosa","articulos":[{"descripcion":"Solvente industrial","cantidad":40,"pesoKg":200},{"descripcion":"Pintura base aceite","cantidad":30,"pesoKg":100}],"claseUN":3,"numeroONU":"UN1263","hojaSeguridad":"https://docs.hopwright.local/hs-solvente.pdf","telefonoEmergencia":"9615550000"}
```

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "tipoCarga": "peligrosa",
 "articulos": [
  {
   "descripcion": "Solvente industrial",
   "cantidad": 40,
   "pesoKg": 200
  },
  {
   "descripcion": "Pintura base aceite",
   "cantidad": 30,
   "pesoKg": 100
  }
 ],
 "creadoEn": "2026-11-28T00:00:21.389Z",
 "claseUN": 3,
 "numeroONU": "UN1263",
 "hojaSeguridad": "https://docs.hopwright.local/hs-solvente.pdf",
 "telefonoEmergencia": "9615550000",
 "restriccionesRuta": {
  "evitarTerraceria": true,
  "tiempoMaxMin": null
 }
}
```

D01-E3. Segundo manifiesto para el mismo envío.

Cuerpo enviado:

```json
{"tipoCarga":"peligrosa","articulos":[{"descripcion":"Solvente industrial","cantidad":40,"pesoKg":200},{"descripcion":"Pintura base aceite","cantidad":30,"pesoKg":100}],"claseUN":3,"numeroONU":"UN1263","hojaSeguridad":"https://docs.hopwright.local/hs-solvente.pdf","telefonoEmergencia":"9615550000"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El envío E-7018278 ya tiene manifiesto",
 "statusCode": 409
}
```

D01-V1. El validador $jsonSchema de MongoDB rechaza un manifiesto inválido aunque no pase por la API.

Respuesta:

```json
{
 "code": 121,
 "mensaje": "Document failed validation"
}
```

## OP-D02. Consultar manifiesto

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D02-N1 | normal | `GET /envios/E-7018278/manifiesto` | 200 | 200 | 4.7 | sí |
| D02-L1 | límite | `GET /envios/E-105/manifiesto` | 404 | 404 | 4.5 | sí |
| D02-E1 | error | `GET /envios/E-999999/manifiesto` | 404 | 404 | 2 | sí |

D02-N1. Manifiesto recién guardado.

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "tipoCarga": "peligrosa",
 "articulos": [
  {
   "descripcion": "Solvente industrial",
   "cantidad": 40,
   "pesoKg": 200
  },
  {
   "descripcion": "Pintura base aceite",
   "cantidad": 30,
   "pesoKg": 100
  }
 ],
 "creadoEn": "2026-11-28T00:00:21.389Z",
 "claseUN": 3,
 "numeroONU": "UN1263",
 "hojaSeguridad": "https://docs.hopwright.local/hs-solvente.pdf",
 "telefonoEmergencia": "9615550000",
 "restriccionesRuta": {
  "evitarTerraceria": true,
  "tiempoMaxMin": null
 }
}
```

D02-L1. Envío que existe pero no tiene manifiesto (E-105).

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-105 no tiene manifiesto",
 "statusCode": 404
}
```

D02-E1. Envío que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

## OP-D03. Consultar bitácora de un envío

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D03-N1 | normal | `GET /envios/E-7018278/bitacora` | 200, ASIGNACION_CREADA, ENVIO_SALIO y ENVIO_ENTREGADO en orden | 200 | 3.7 | sí |
| D03-L1 | límite | `GET /envios/E-101/bitacora` | 200, eventos: [] | 200 | 3.3 | sí |
| D03-E1 | error | `GET /envios/E-999999/bitacora` | 404 | 404 | 1.8 | sí |

D03-N1. Bitácora del envío de prueba.

Respuesta:

```json
{
 "idEnvio": "E-7018278",
 "eventos": [
  {
   "tipo": "ASIGNACION_CREADA",
   "fecha": "2026-11-28T00:00:21.868Z"
  },
  {
   "tipo": "ENVIO_SALIO",
   "fecha": "2026-11-28T00:00:21.888Z"
  },
  {
   "tipo": "ENVIO_ENTREGADO",
   "fecha": "2026-11-28T00:00:22.764Z"
  }
 ]
}
```

D03-L1. Envío sin eventos todavía (E-101).

Respuesta:

```json
{
 "idEnvio": "E-101",
 "eventos": []
}
```

D03-E1. Envío que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

## OP-D04. Reportar incidente

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D04-N1 | normal | `POST /incidentes` | 201, sincronizado: true | 201 | 30.7 | sí |
| D04-V1 | verificación | `MATCH (i:Incidente {idIncidente: 'INC-0217'})-[:BLOQUEA]->(p)` | activo, gravedad Alta, punto INT-CHC | coincide | 31.6 | sí |
| D04-L1 | límite | `POST /incidentes` | 400 | 400 | 1.4 | sí |
| D04-E1 | error | `POST /incidentes` | 400 | 400 | 1.1 | sí |
| D04-E2 | error | `POST /incidentes` | 404 | 404 | 4.9 | sí |
| D04-E3 | error | `POST /incidentes` | 400 | 400 | 1.2 | sí |

D04-N1. Bloqueo de gravedad Alta en la caseta de Chiapa de Corzo.

Cuerpo enviado:

```json
{"tipo":"Bloqueo","idPunto":"INT-CHC","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba"}],"reportadoPor":"Evidencia del catálogo"}
```

Respuesta:

```json
{
 "incidente": {
  "idIncidente": "INC-0217",
  "tipo": "Bloqueo",
  "idPunto": "INT-CHC",
  "tipoPunto": "Interseccion",
  "gravedad": "Alta",
  "descripcion": "Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos",
  "fechaInicio": "2026-11-28T00:00:21.895Z",
  "detalle": {
   "causa": "Manifestación",
   "carrilesCerrados": 2,
   "pasoAlternado": false
  },
  "evidencias": [
   {
    "tipo": "Testimonio",
    "texto": "No dejan pasar a los de carga",
    "autor": "Conductor de prueba",
    "fecha": "2026-11-28T00:00:21.895Z"
   }
  ],
  "activo": true,
  "sincronizado": true,
  "reportadoPor": "Evidencia del catálogo",
  "creadoEn": "2026-11-28T00:00:21.895Z"
 }
}
```

D04-V1. La réplica en Neo4j tiene el mismo estado que el reporte.

Respuesta:

```json
[
 {
  "gravedad": "Alta",
  "activo": true,
  "punto": "INT-CHC"
 }
]
```

D04-L1. Punto que existe pero es una estación de tren.

Cuerpo enviado:

```json
{"tipo":"Bloqueo","idPunto":"EST-TAP","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba"}],"reportadoPor":"Evidencia del catálogo"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "idPunto debe ser la clave INEGI de una ciudad (5 dígitos) o el id de una intersección (INT-...)",
 "statusCode": 400
}
```

D04-E1. Detalle que no corresponde al tipo.

Cuerpo enviado:

```json
{"tipo":"Bloqueo","idPunto":"INT-CHC","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","detalle":{"volumenEstimadoM3":50,"requiereMaquinaria":true},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba"}],"reportadoPor":"Evidencia del catálogo"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "El reporte de tipo Bloqueo tiene datos incompletos o inválidos",
 "statusCode": 400,
 "detalles": [
  "El campo volumenEstimadoM3 no corresponde a un incidente de tipo Bloqueo",
  "El campo requiereMaquinaria no corresponde a un incidente de tipo Bloqueo",
  "Falta causa, obligatorio para un incidente de tipo Bloqueo",
  "Falta carrilesCerrados, obligatorio para un incidente de tipo Bloqueo"
 ]
}
```

D04-E2. Punto que no existe en la red.

Cuerpo enviado:

```json
{"tipo":"Bloqueo","idPunto":"INT-NOEXISTE","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba"}],"reportadoPor":"Evidencia del catálogo"}
```

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El punto INT-NOEXISTE no existe en la red",
 "statusCode": 404
}
```

D04-E3. Gravedad que no existe.

Cuerpo enviado:

```json
{"tipo":"Bloqueo","idPunto":"INT-CHC","gravedad":"Extrema","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba"}],"reportadoPor":"Evidencia del catálogo"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/gravedad must be equal to one of the allowed values",
 "statusCode": 400
}
```

## OP-D05. Agregar evidencia a un incidente

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D05-N1 | normal | `POST /incidentes/INC-0217/evidencias` | 201 | 201 | 4.5 | sí |
| D05-L1 | límite | `POST /incidentes/INC-0217/evidencias` | 201 | 201 | 3.1 | sí |
| D05-E1 | error | `POST /incidentes/INC-0217/evidencias` | 400 | 400 | 1.3 | sí |
| D05-E2 | error | `POST /incidentes/INC-9999/evidencias` | 404 | 404 | 2.7 | sí |

D05-N1. Foto con su URL.

Cuerpo enviado:

```json
{"tipo":"Foto","url":"https://evidencias.hopwright.local/prueba.jpg","autor":"Despacho Tuxtla"}
```

Respuesta:

```json
{"idIncidente":"INC-0217","tipo":"Bloqueo","idPunto":"INT-CHC","tipoPunto":"Interseccion","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","fechaInicio":"2026-11-28T00:00:21.895Z","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba","fecha":"2026-11-28T00:00:21.895Z"},{"tipo":"Foto","url":"https://evidencias.hopwright.local/prueba.jpg","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.650Z"}],"activo":true,"sincronizado":true,"reportadoPor":"Evidencia del catálogo","creadoEn":"2026-11-28T00:00:21.895 …
```

D05-L1. Testimonio de 2 caracteres (el mínimo).

Cuerpo enviado:

```json
{"tipo":"Testimonio","texto":"Ok","autor":"Despacho Tuxtla"}
```

Respuesta:

```json
{"idIncidente":"INC-0217","tipo":"Bloqueo","idPunto":"INT-CHC","tipoPunto":"Interseccion","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","fechaInicio":"2026-11-28T00:00:21.895Z","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba","fecha":"2026-11-28T00:00:21.895Z"},{"tipo":"Foto","url":"https://evidencias.hopwright.local/prueba.jpg","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.650Z"},{"tipo":"Testimonio","texto":"Ok","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.654Z"}],"activo":true …
```

D05-E1. Foto sin URL.

Cuerpo enviado:

```json
{"tipo":"Foto","autor":"Despacho Tuxtla"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "Una evidencia de tipo Foto necesita url",
 "statusCode": 400
}
```

D05-E2. Incidente que no existe.

Cuerpo enviado:

```json
{"tipo":"Testimonio","texto":"Prueba","autor":"Despacho"}
```

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El incidente INC-9999 no existe",
 "statusCode": 404
}
```

## OP-D06. Consultar incidentes

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D06-N1 | normal | `GET /incidentes?activo=true` | 200 | 200 | 6.2 | sí |
| D06-N2 | normal | `GET /incidentes/INC-0217` | 200, 3 evidencias (la del alta y las dos agregadas) | 200 | 3.2 | sí |
| D06-L1 | límite | `GET /incidentes?activo=true&gravedad=Baja&tipo=Derrumbe` | 200, lista vacía | 200 | 2.6 | sí |
| D06-E1 | error | `GET /incidentes/INC-9999` | 404 | 404 | 2.3 | sí |
| D06-E2 | error | `GET /incidentes/incidente1` | 400 | 400 | 1.4 | sí |

D06-N1. Solo los activos.

Respuesta:

```json
[
 {
  "idIncidente": "INC-0217",
  "tipo": "Bloqueo",
  "idPunto": "INT-CHC",
  "gravedad": "Alta",
  "activo": true
 },
 {
  "idIncidente": "INC-0001",
  "tipo": "Obra",
  "idPunto": "07094",
  "gravedad": "Media",
  "activo": true
 }
]
```

D06-N2. El reporte completo con sus evidencias.

Respuesta:

```json
{"idIncidente":"INC-0217","tipo":"Bloqueo","idPunto":"INT-CHC","tipoPunto":"Interseccion","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","fechaInicio":"2026-11-28T00:00:21.895Z","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba","fecha":"2026-11-28T00:00:21.895Z"},{"tipo":"Foto","url":"https://evidencias.hopwright.local/prueba.jpg","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.650Z"},{"tipo":"Testimonio","texto":"Ok","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.654Z"}],"activo":true …
```

D06-L1. Filtro sin resultados.

Respuesta:

```json
[]
```

D06-E1. Incidente que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El incidente INC-9999 no existe",
 "statusCode": 404
}
```

D06-E2. Identificador mal escrito.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "params/id must match pattern \"^INC-[0-9]{4,}$\"",
 "statusCode": 400
}
```

## OP-D07. Cerrar incidente

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| D07-N1 | normal | `PATCH /incidentes/INC-0217/cerrar` | 200, activo: false | 200 | 18.6 | sí |
| D07-E1 | error | `PATCH /incidentes/INC-0217/cerrar` | 409 | 409 | 2.9 | sí |

D07-N1. Cerrar el bloqueo.

Cuerpo enviado:

```json
{"motivoCierre":"Se retiraron los manifestantes"}
```

Respuesta:

```json
{"incidente":{"idIncidente":"INC-0217","tipo":"Bloqueo","idPunto":"INT-CHC","tipoPunto":"Interseccion","gravedad":"Alta","descripcion":"Manifestación que cierra la caseta de Chiapa de Corzo en los dos sentidos","fechaInicio":"2026-11-28T00:00:21.895Z","fechaFin":"2026-11-28T00:00:22.682Z","motivoCierre":"Se retiraron los manifestantes","detalle":{"causa":"Manifestación","carrilesCerrados":2,"pasoAlternado":false},"evidencias":[{"tipo":"Testimonio","texto":"No dejan pasar a los de carga","autor":"Conductor de prueba","fecha":"2026-11-28T00:00:21.895Z"},{"tipo":"Foto","url":"https://evidencias.hopwright.local/prueba.jpg","autor":"Despacho Tuxtla","fecha":"2026-11-28T00:00:22.650Z"},{"tipo":"Te …
```

D07-E1. Cerrar otra vez.

Cuerpo enviado:

```json
{"motivoCierre":"Otra vez"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "El incidente INC-0217 ya estaba cerrado",
 "statusCode": 409
}
```

## OP-G01. Ruta más corta (C1)

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G01-N1 | normal | `GET /rutas?origen=07101&destino=07078&criterio=tiempo` | 200, 73 min por la autopista, 230 de casetas | 200 | 79.7 | sí |
| G01-N2 | normal | `GET /rutas?origen=07101&destino=07078&criterio=costo` | 200, 0 de casetas por la libre, 140 min | 200 | 65.8 | sí |
| G01-L1 | límite | `GET /rutas?origen=07078&destino=07098&evitarTerraceria=true` | 200, 108 min y ningún tramo de terracería | 200 | 74.9 | sí |
| G01-L2 | límite | `GET /rutas?origen=07101&destino=07009&tiempoMaxMin=100` | 200, encontrada: false con el motivo | 200 | 407 | sí |
| G01-E1 | error | `GET /rutas?origen=07101&destino=07999` | 404 | 404 | 14.3 | sí |
| G01-E2 | error | `GET /rutas?origen=07101&destino=07101` | 400 | 400 | 1.1 | sí |
| G01-E3 | error | `GET /rutas?origen=tuxtla&destino=07078` | 400 | 400 | 0.9 | sí |
| G01-L3 | límite | `GET /rutas?origen=07101&destino=07078` | 200, rodea por Chiapa de Corzo y Acala, 176 min | 200 | 112.8 | sí |
| G01-L4 | límite | `GET /rutas?origen=07101&destino=07078` | 200, 73 min | 200 | 58.7 | sí |

G01-N1. Tuxtla a San Cristóbal por tiempo.

Respuesta:

```json
{
 "encontrada": true,
 "ruta": [
  "Tuxtla Gutiérrez",
  "Caseta Chiapa de Corzo",
  "San Cristóbal de las Casas"
 ],
 "minutos": 73,
 "kilometros": 64.5,
 "costoCasetas": 230,
 "avisos": []
}
```

G01-N2. Mismo viaje por costo.

Respuesta:

```json
{
 "encontrada": true,
 "ruta": [
  "Tuxtla Gutiérrez",
  "Caseta Chiapa de Corzo",
  "Ixtapa",
  "Zinacantán",
  "San Cristóbal de las Casas"
 ],
 "minutos": 140,
 "kilometros": 93.3,
 "costoCasetas": 0,
 "avisos": []
}
```

G01-L1. San Cristóbal a Totolapa sin terracería (la más rápida sí usa terracería).

Respuesta:

```json
{
 "encontrada": true,
 "ruta": [
  "San Cristóbal de las Casas",
  "Chiapilla",
  "Acala",
  "Totolapa"
 ],
 "minutos": 108,
 "kilometros": 64.3,
 "costoCasetas": 0,
 "avisos": []
}
```

G01-L2. Tiempo máximo que ninguna ruta cumple.

Respuesta:

```json
{
 "encontrada": false,
 "ruta": [],
 "minutos": 0,
 "kilometros": 0,
 "costoCasetas": 0,
 "avisos": [
  "No hay una ruta por carretera que cumpla las condiciones. Se pidió llegar en máximo 100 minutos. También se excluyen los tramos cerrados y los puntos con incidentes activos de gravedad Alta."
 ]
}
```

G01-E1. Ciudad que no existe en la red.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "La ciudad 07999 (destino) no existe en la red",
 "statusCode": 404
}
```

G01-E2. Origen igual al destino.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "El origen y el destino deben ser ciudades distintas",
 "statusCode": 400
}
```

G01-E3. Clave de ciudad con formato inválido.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "querystring/origen must match pattern \"^[0-9]{5}$\"",
 "statusCode": 400
}
```

G01-L3. Tuxtla a San Cristóbal con la caseta bloqueada por el incidente Alta.

Respuesta:

```json
{
 "encontrada": true,
 "ruta": [
  "Tuxtla Gutiérrez",
  "Chiapa de Corzo",
  "Emiliano Zapata",
  "Acala",
  "Chiapilla",
  "San Cristóbal de las Casas"
 ],
 "minutos": 176,
 "kilometros": 119.7,
 "costoCasetas": 0,
 "avisos": []
}
```

G01-L4. Con el incidente cerrado la ruta regresa a la autopista.

Respuesta:

```json
{
 "encontrada": true,
 "ruta": [
  "Tuxtla Gutiérrez",
  "Caseta Chiapa de Corzo",
  "San Cristóbal de las Casas"
 ],
 "minutos": 73,
 "kilometros": 64.5,
 "costoCasetas": 230,
 "avisos": []
}
```

## OP-G02. Exploración paso a paso de la ruta

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G02-N1 | normal | `GET /rutas/exploracion?origen=07101&destino=07078` | 200, coincide: true con Neo4j, 73 min | 200 | 68.6 | sí |
| G02-L1 | límite | `GET /rutas/exploracion?origen=07101&destino=07089&algoritmo=bidireccional` | 200, coincide: true | 200 | 67.5 | sí |
| G02-E1 | error | `GET /rutas/exploracion?origen=07101&destino=07078&algoritmo=a-estrella` | 400 | 400 | 0.9 | sí |

G02-N1. Dijkstra paso a paso de Tuxtla a San Cristóbal.

Respuesta:

```json
{
 "algoritmo": "dijkstra",
 "minutos": 73,
 "coincide": true,
 "neo4j": 73,
 "pasos": 79,
 "ruta": [
  "07101",
  "INT-CHC",
  "07078"
 ]
}
```

G02-L1. Búsqueda bidireccional de Tuxtla a Tapachula.

Respuesta:

```json
{
 "algoritmo": "bidireccional",
 "minutos": 353,
 "coincide": true,
 "neo4j": 353,
 "pasos": 345,
 "ruta": [
  "07101",
  "07061",
  "07009",
  "07097",
  "07069",
  "07071",
  "07040",
  "07089"
 ]
}
```

G02-E1. Algoritmo desconocido.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "querystring/algoritmo must be equal to one of the allowed values",
 "statusCode": 400
}
```

## OP-G03. Camión contra camión y tren (C2)

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G03-N1 | normal | `GET /rutas/camion-tren?origen=07101&destino=07089&pesoKg=20000` | 200, el tren sale más barato y el camión más rápido | 200 | 571.8 | sí |
| G03-L1 | límite | `GET /rutas/camion-tren?origen=07101&destino=07089&pesoKg=0` | 400 | 400 | 0.8 | sí |
| G03-E1 | error | `GET /rutas/camion-tren?origen=07101&destino=07999&pesoKg=1000` | 404 | 404 | 9.5 | sí |

G03-N1. 20 toneladas de Tuxtla a Tapachula.

Respuesta:

```json
{
 "soloCamion": {
  "minutos": 353,
  "costo": 10032.5
 },
 "camionTren": {
  "minutos": 612,
  "costo": 6557.5,
  "subida": "Estación Arriaga",
  "bajada": "Estación Tapachula"
 },
 "masBarata": "camion-tren",
 "masRapida": "camion"
}
```

G03-L1. Peso de 0 kg.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "querystring/pesoKg must be > 0",
 "statusCode": 400
}
```

G03-E1. Destino que no existe en la red.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "La ciudad 07999 (destino) no existe en la red",
 "statusCode": 404
}
```

## OP-G04. Ciudades aisladas (C4)

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G04-N1 | normal | `GET /red/ciudades-aisladas?punto=07089` | 200, 6 municipios del Soconusco sin camino a Tuxtla | 200 | 18.2 | sí |
| G04-L1 | límite | `GET /red/ciudades-aisladas?punto=INT-OXC` | 200, lista vacía | 200 | 17.7 | sí |
| G04-E1 | error | `GET /red/ciudades-aisladas?punto=INT-NOEXISTE` | 404 | 404 | 6.8 | sí |

G04-N1. Se cierra Tapachula.

Respuesta:

```json
{
 "puntoCerrado": "Tapachula",
 "aisladas": [
  "Cacahoatán",
  "Frontera Hidalgo",
  "Metapa",
  "Suchiate",
  "Tuxtla Chico",
  "Unión Juárez"
 ]
}
```

G04-L1. Se cierra un entronque con caminos alternos.

Respuesta:

```json
{
 "puntoCerrado": {
  "idPunto": "INT-OXC",
  "nombre": "Entronque Oxchuc",
  "tipo": "Interseccion"
 },
 "destino": {
  "idPunto": "07101",
  "nombre": "Tuxtla Gutiérrez",
  "tipo": "Ciudad"
 },
 "aisladas": []
}
```

G04-E1. Punto que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El punto INT-NOEXISTE no existe en la red de carreteras",
 "statusCode": 404
}
```

## OP-G05. Mapa de la red

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G05-N1 | normal | `GET /red/mapa` | 200, 138 puntos con coordenadas | 200 | 59.4 | sí |

G05-N1. Todo lo que dibuja el mapa.

Respuesta:

```json
{
 "puntos": 138,
 "tramos": 337,
 "incidentes": 1,
 "vehiculos": 7
}
```

## OP-G06. Ubicación de un vehículo

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| G06-N1 | normal | `PATCH /vehiculos/PRU-018278/ubicacion` | 200, actual: Tuxtla | 200 | 19.3 | sí |
| G06-N2 | normal | `GET /vehiculos/PRU-018278/ubicacion` | 200 | 200 | 6.3 | sí |
| G06-L1 | límite | `PATCH /vehiculos/PRU-018278/ubicacion` | 400 | 400 | 6.9 | sí |
| G06-E1 | error | `PATCH /vehiculos/XXX-0000/ubicacion` | 404 | 404 | 6.3 | sí |
| G06-E2 | error | `PATCH /vehiculos/PRU-018278/ubicacion` | 401 | 401 | 1.2 | sí |

G06-N1. Poner el camión de prueba en Tuxtla.

Cuerpo enviado:

```json
{"idPunto":"07101"}
```

Respuesta:

```json
{
 "placa": "PRU-018278",
 "anterior": null,
 "actual": {
  "idPunto": "07101",
  "nombre": "Tuxtla Gutiérrez",
  "tipo": "Ciudad"
 },
 "fechaHora": "2026-11-28T00:00:21.289Z",
 "avisos": []
}
```

G06-N2. Consultar dónde está.

Respuesta:

```json
{
 "placa": "PRU-018278",
 "punto": {
  "idPunto": "07101",
  "nombre": "Tuxtla Gutiérrez",
  "tipo": "Ciudad"
 },
 "fechaHora": "2026-11-28T00:00:21.289Z"
}
```

G06-L1. Un camión no puede quedar en una estación de tren (R11).

Cuerpo enviado:

```json
{"idPunto":"EST-TAP"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "Un vehículo de tipo Camión solo puede estar en una ciudad o intersección (R11)",
 "statusCode": 400
}
```

G06-E1. Vehículo que no existe.

Cuerpo enviado:

```json
{"idPunto":"07101"}
```

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El vehículo XXX-0000 no existe en la red",
 "statusCode": 404
}
```

G06-E2. Sin token.

Cuerpo enviado:

```json
{"idPunto":"07101"}
```

Respuesta:

```json
{
 "error": "No autorizado",
 "mensaje": "Token inválido o ausente",
 "statusCode": 401
}
```

## OP-I01. Flujo integrado: ruta de un envío

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| I01-N1 | normal | `GET /envios/E-103/ruta` | 200, evita terracería y sugiere un vehículo que aguanta 3,000 kg | 200 | 127.2 | sí |
| I01-N2 | normal | `GET /envios/E-7018278/ruta` | 200, candidatos incluye PRU-018278; el sugerido está a 0 min del origen | 200 | 73.9 | sí |
| I01-L1 | límite | `GET /envios/E-105/ruta` | 200 | 200 | 212.9 | sí |
| I01-E1 | error | `GET /envios/E-999999/ruta` | 404 | 404 | 2.1 | sí |
| I01-E2 | error | `GET /envios/E-103/ruta?criterio=barata` | 400 | 400 | 0.7 | sí |

I01-N1. E-103: carga peligrosa de Tuxtla a Comitán.

Respuesta:

```json
{"tipoCarga":"peligrosa","restricciones":{"evitarTerraceria":true,"tiempoMaxMin":null},"candidatos":["CHP-1006","PRU-018278","CHP-1002","TREN-01"],"encontrada":true,"ruta":["Tuxtla Gutiérrez","Caseta Chiapa de Corzo","San Cristóbal de las Casas","Teopisca","Amatenango del Valle","Entronque Amatenango","Comitán de Domínguez"],"minutos":173,"kilometros":152.3,"costoCasetas":230,"vehiculoSugerido":{"placa":"PRU-018278","minutosAlOrigen":0},"avisos":["La ruta pasa por Teopisca, donde hay un incidente activo de gravedad Media (INC-0001)"],"fuentes":{"postgresql":"origen, destino, peso, estado y vehículos candidatos","mongodb":"manifiesto (peligrosa)","neo4j":"ruta, incidentes en el camino y ubica …
```

I01-N2. El envío de prueba: el camión que acaba de llegar a Tuxtla es candidato y está en el origen.

Respuesta:

```json
{"tipoCarga":"peligrosa","restricciones":{"evitarTerraceria":true,"tiempoMaxMin":null},"candidatos":["PRU-018278","CHP-1002","TREN-01"],"encontrada":true,"ruta":["Tuxtla Gutiérrez","Caseta Chiapa de Corzo","San Cristóbal de las Casas","Teopisca","Amatenango del Valle","Entronque Amatenango","Comitán de Domínguez"],"minutos":173,"kilometros":152.3,"costoCasetas":230,"vehiculoSugerido":{"placa":"PRU-018278","minutosAlOrigen":0},"avisos":["La ruta pasa por Teopisca, donde hay un incidente activo de gravedad Media (INC-0001)"],"fuentes":{"postgresql":"origen, destino, peso, estado y vehículos candidatos","mongodb":"manifiesto (peligrosa)","neo4j":"ruta, incidentes en el camino y ubicación de los …
```

I01-L1. Envío ya entregado (E-105): se puede consultar con aviso.

Respuesta:

```json
{
 "tipoCarga": null,
 "restricciones": {
  "evitarTerraceria": false,
  "tiempoMaxMin": null
 },
 "candidatos": [
  "CHP-1006",
  "PRU-018278",
  "CHP-1002",
  "TREN-01"
 ],
 "encontrada": true,
 "ruta": [
  "Palenque",
  "Ocosingo",
  "Oxchuc",
  "Huixtán",
  "San Cristóbal de las Casas",
  "Caseta Chiapa de Corzo",
  "Tuxtla Gutiérrez"
 ],
 "minutos": 312,
 "kilometros": 277,
 "costoCasetas": 230,
 "vehiculoSugerido": {
  "placa": "CHP-1006",
  "minutosAlOrigen": 311
 },
 "avisos": [
  "El envío no tiene manifiesto",
  "El envío está entregado; la ruta es solo de consulta"
 ],
 "fuentes": {
  "postgresql": "origen, destino, peso, estado y vehículos candidatos",
  "mongodb": "sin manifiesto",
  "neo4j": "ruta, incidentes en el camino y ubicación de los vehículos"
 }
}
```

I01-E1. Envío que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El envío E-999999 no existe",
 "statusCode": 404
}
```

I01-E2. Criterio inválido.

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "querystring/criterio must be equal to one of the allowed values",
 "statusCode": 400
}
```

## OP-I02. Envíos afectados por un incidente (C5)

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| I02-N1 | normal | `GET /incidentes/INC-0217/envios-afectados` | 200, E-7018278 aparece con su desvío y los minutos extra | 200 | 562.1 | sí |
| I02-L1 | límite | `GET /incidentes/INC-0002/envios-afectados` | 200, afectados vacío con aviso | 200 | 6.1 | sí |
| I02-E1 | error | `GET /incidentes/INC-9999/envios-afectados` | 404 | 404 | 2.5 | sí |

I02-N1. El bloqueo nuevo contra los envíos en camino.

Respuesta:

```json
{
 "incidente": "INC-0217",
 "revisados": 2,
 "afectados": [
  {
   "idEnvio": "E-7018278",
   "placa": "PRU-018278",
   "partida": "07101",
   "destino": "07019",
   "sinIncidente": 173,
   "desvio": 228,
   "minutosExtra": 55
  }
 ],
 "avisos": []
}
```

I02-L1. Incidente cerrado (INC-0002).

Respuesta:

```json
{
 "revisados": 0,
 "afectados": [],
 "avisos": [
  "El incidente ya está cerrado; no afecta a ningún envío"
 ]
}
```

I02-E1. Incidente que no existe.

Respuesta:

```json
{
 "error": "No encontrado",
 "mensaje": "El incidente INC-9999 no existe",
 "statusCode": 404
}
```

## OP-I03. Alta de ciudad replicada al grafo

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| I03-N1 | normal | `POST /ciudades` | 201 | 201 | 22.2 | sí |
| I03-V1 | verificación | `MATCH (c:Ciudad {idCiudad: '07908'})` | 0 nodos y 1 evento pendiente | coincide | 43.4 | sí |
| I03-V2 | verificación | `MATCH (c:Ciudad {idCiudad: '07908'})` | 1 nodo y evento aplicado | coincide | 5.1 | sí |
| I03-L1 | límite | `POST /ciudades` | 400 | 400 | 1.4 | sí |
| I03-E1 | error | `POST /ciudades` | 409 | 409 | 3.4 | sí |

I03-N1. Ciudad nueva.

Cuerpo enviado:

```json
{"idCiudad":"07908","nombre":"Ciudad de prueba 018278","estado":"Chiapas"}
```

Respuesta:

```json
{
 "idCiudad": "07908",
 "nombre": "Ciudad de prueba 018278",
 "estado": "Chiapas"
}
```

I03-V1. Antes de aplicar el evento la ciudad todavía no está en Neo4j.

Respuesta:

```json
{
 "nodosEnNeo4j": 0,
 "eventos": [
  {
   "tipo": "CIUDAD_GUARDADA",
   "estado": "pendiente"
  }
 ]
}
```

I03-V2. Después del procesador de eventos la ciudad está en Neo4j con el mismo nombre.

Respuesta:

```json
{
 "nodosEnNeo4j": [
  {
   "nombre": "Ciudad de prueba 018278"
  }
 ],
 "eventos": [
  {
   "tipo": "CIUDAD_GUARDADA",
   "estado": "aplicado"
  }
 ]
}
```

I03-L1. Clave INEGI de 4 dígitos.

Cuerpo enviado:

```json
{"idCiudad":"7101","nombre":"Tuxtla","estado":"Chiapas"}
```

Respuesta:

```json
{
 "error": "Datos inválidos",
 "mensaje": "body/idCiudad must match pattern \"^[0-9]{5}$\"",
 "statusCode": 400
}
```

I03-E1. Ciudad que ya existe.

Cuerpo enviado:

```json
{"idCiudad":"07101","nombre":"Tuxtla Gutiérrez","estado":"Chiapas"}
```

Respuesta:

```json
{
 "error": "Conflicto",
 "mensaje": "La ciudad 07101 ya existe",
 "statusCode": 409
}
```

## OP-I04. Reconciliación de réplicas

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| I04-E1 | error | `POST /admin/reconciliar` | 401 | 401 | 1.2 | sí |
| I04-E2 | error | `POST /admin/reconciliar` | 403 | 403 | 1.1 | sí |
| I04-N1 | normal | `POST /admin/reconciliar` | 200 | 200 | 18.3 | sí |
| I04-L1 | límite | `POST /admin/reconciliar` | 200, no copia ni borra nada (idempotente) | 200 | 16 | sí |

I04-E1. Sin token.

Respuesta:

```json
{
 "error": "No autorizado",
 "mensaje": "Token inválido o ausente",
 "statusCode": 401
}
```

I04-E2. Con token de despachador.

Respuesta:

```json
{
 "error": "Prohibido",
 "mensaje": "No tienes permisos para esta operación",
 "statusCode": 403
}
```

I04-N1. Reconciliar como administrador.

Respuesta:

```json
{
 "incidentes": {
  "revisados": 3,
  "copiados": [],
  "borradosDelGrafo": []
 },
 "ciudades": {
  "revisadas": 125,
  "copiadas": []
 },
 "vehiculos": {
  "revisados": 8,
  "copiados": [],
  "borradosDelGrafo": []
 },
 "avisos": [
  "Estas ciudades no tienen tramos de carretera y no se puede llegar a ellas: 07908"
 ]
}
```

I04-L1. Reconciliar otra vez enseguida.

Respuesta:

```json
{
 "incidentes": {
  "revisados": 3,
  "copiados": [],
  "borradosDelGrafo": []
 },
 "ciudades": {
  "revisadas": 125,
  "copiadas": []
 },
 "vehiculos": {
  "revisados": 8,
  "copiados": [],
  "borradosDelGrafo": []
 },
 "avisos": [
  "Estas ciudades no tienen tramos de carretera y no se puede llegar a ellas: 07908"
 ]
}
```

## OP-I05. Estado de las tres bases

| Caso | Tipo | Solicitud | Esperado | Obtenido | ms | Cumple |
|---|---|---|---|---|---|---|
| I05-N1 | normal | `GET /health` | 200, estado ok en postgres, mongo y neo4j | 200 | 134.3 | sí |

I05-N1. Las tres bases responden.

Respuesta:

```json
{
 "estado": "ok",
 "bases": {
  "postgres": {
   "estado": "ok",
   "ms": 13
  },
  "mongo": {
   "estado": "ok",
   "ms": 46
  },
  "neo4j": {
   "estado": "ok",
   "ms": 72
  }
 }
}
```
