# API - Envíos, flota, usuarios y autenticación

## Autenticación

- `POST /auth/login`: recibe `{correo,password}`, valida bcrypt y regresa `{token}` JWT. Errores: 400 datos inválidos, 404 credenciales inválidas.

## Ciudades

- `GET /ciudades`: lista ciudades.
- `POST /ciudades` (admin): crea ciudad con clave INEGI. Valida formato, unicidad; en transacción guarda `CIUDAD_GUARDADA` en outbox. 201/400/401/403/409.

## Clientes

- `GET /clientes`, `GET /clientes/{id}`.
- `POST /clientes`, `PUT /clientes/{id}`: validan razón social y RFC, RFC único. 201/200/400/404/409.

## Conductores

- `GET /conductores`, `GET /conductores/{id}`.
- `POST /conductores`, `PUT /conductores/{id}`: validan nombre/licencia, licencia única. 201/200/400/404/409.

## Vehículos

- `GET /vehiculos`, `GET /vehiculos/{placa}`.
- `POST /vehiculos` (admin): valida tipo/capacidad/estado/conductor; en transacción crea y encola `VEHICULO_GUARDADO`. 201/400/401/403/409.
- `PATCH /vehiculos/{placa}`: actualiza campos; encola `VEHICULO_GUARDADO`. 200/400/404.

## Envíos

- `GET /envios?estado=`: lista, filtro opcional por estado.
- `GET /envios/{id}`: detalle. 404 si no existe.
- `POST /envios`: valida peso>0, prioridad, origen!=destino, cliente/ciudades existentes. 201/400/409.
- `POST /envios/{id}/asignacion` body `{placa}`: transacción con `FOR UPDATE`, verifica envío pendiente, vehículo disponible, capacidad suficiente, sin asignación activa doble; crea asignación, cambia estados, encola `ASIGNACION_CREADA`. 201/404/409.
- `POST /envios/{id}/salida`: Asignado->En camino, guarda fecha_salida y encola `ENVIO_SALIO`. 200/404/409.
- `POST /envios/{id}/entrega`: En camino->Entregado, desactiva asignación, vehículo Disponible, encola `ENVIO_ENTREGADO`. 200/404/409.
- `GET/POST /envios/{id}/manifiesto`: valida existencia de envío; POST valida tipo y campos por tipo, índice único por idEnvio. 200/201/400/404/409.
- `GET /envios/{id}/bitacora`: regresa bitácora o estructura vacía.

## Servicio interno

- `obtenerDatosParaRuta(idEnvio)`: regresa `{idEnvio, origen, destino, pesoKg, candidatos, restricciones{evitarTerraceria,tiempoMaxMin}, avisos[]}`. Lee PostgreSQL y manifiesto MongoDB; si no hay manifiesto, defaults y aviso.
