# API - Envíos, flota, usuarios y autenticación

## Autenticación

- `POST /auth/login`: recibe `{correo,password}`, valida bcrypt y regresa `{token}` JWT. Errores: 400 datos inválidos, 401 correo o contraseña incorrectos con el mismo mensaje en ambos casos.

Las consultas (`GET`) no piden token. Las operaciones que cambian datos lo piden en el encabezado `Authorization: Bearer <token>`; sin token responden 401 y con un rol que no alcanza, 403. Los usuarios de prueba están en el README.

- Despachador o administrador: alta de envíos, asignación, salida, entrega, manifiesto, y alta y cambio de clientes y conductores.
- Solo administrador: alta de ciudades y de vehículos, `PATCH /vehiculos/{placa}` y borrado de clientes y conductores.

## Ciudades

- `GET /ciudades`: lista ciudades.
- `POST /ciudades` (admin): crea ciudad con clave INEGI. Valida formato, unicidad; en transacción guarda `CIUDAD_GUARDADA` en outbox. 201/400/401/403/409.

## Clientes

- `GET /clientes`, `GET /clientes/{id}`.
- `POST /clientes`, `PUT /clientes/{id}` (despachador o admin): validan razón social y RFC, RFC único. 201/200/400/401/403/404/409.
- `DELETE /clientes/{id}` (admin): 204 si borra, 404 si no existe, 409 "Tiene envíos asociados" si hay llaves foráneas.

## Conductores

- `GET /conductores`, `GET /conductores/{id}`.
- `POST /conductores`, `PUT /conductores/{id}` (despachador o admin): validan nombre/licencia, licencia única. 201/200/400/401/403/404/409.
- `DELETE /conductores/{id}` (admin): 204 si borra, 404 si no existe, 409 "Tiene vehículos asociados" si hay llaves foráneas.

## Vehículos

- `GET /vehiculos`, `GET /vehiculos/{placa}`.
- `POST /vehiculos` (admin): valida tipo/capacidad/estado/conductor; en transacción crea y encola `VEHICULO_GUARDADO`. 201/400/401/403/409.
- `PATCH /vehiculos/{placa}` (admin): actualiza campos; encola `VEHICULO_GUARDADO`. 200/400/401/403/404.

## Envíos

- `GET /envios?estado=`: lista, filtro opcional por estado.
- `GET /envios/{id}`: detalle. 400 si el id no tiene el formato `E-<dígitos>`, 404 si no existe.
- `POST /envios` (despachador o admin): valida formato del id (`E-<dígitos>`), peso>0, prioridad, origen!=destino, cliente/ciudades existentes. 201/400/401/403/409.
- `POST /envios/{id}/asignacion` body `{placa}` (despachador o admin): transacción que bloquea con `FOR UPDATE` el envío y el vehículo, verifica envío pendiente, vehículo disponible, capacidad suficiente, sin asignación activa doble; crea asignación, cambia estados, encola `ASIGNACION_CREADA`. Si llegan dos asignaciones del mismo envío a la vez, la segunda espera y responde 409 "Solo se pueden asignar envíos pendientes". 201/401/403/404/409.
- `POST /envios/{id}/salida` (despachador o admin): Asignado->En camino, guarda fecha_salida y encola `ENVIO_SALIO`. 200/401/403/404/409.
- `POST /envios/{id}/entrega` (despachador o admin): En camino->Entregado, desactiva asignación, vehículo Disponible, encola `ENVIO_ENTREGADO`. 200/401/403/404/409.
- `POST /envios/{id}/cancelacion` (despachador o admin): solo desde Pendiente o Asignado, cierra la asignación, libera el vehículo y encola `ENVIO_CANCELADO`. 200/401/403/404/409.
- `GET/POST /envios/{id}/manifiesto`: valida existencia de envío; POST (despachador o admin) valida tipo y campos por tipo, índice único por idEnvio. En Swagger viene un ejemplo por tipo de carga. 200/201/400/401/403/404/409.
- `GET /envios/{id}/bitacora`: regresa bitácora o estructura vacía. Los eventos se guardan ordenados por fecha aunque alguno se aplique tarde.

## Servicio interno

- `obtenerDatosParaRuta(idEnvio)`: regresa `{idEnvio, origen, destino, pesoKg, candidatos, restricciones{evitarTerraceria,tiempoMaxMin}, avisos[]}`. Lee PostgreSQL y manifiesto MongoDB; si no hay manifiesto, defaults y aviso.
