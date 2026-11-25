# API - Envíos, flota, usuarios y autenticación

Las rutas protegidas esperan el encabezado `Authorization: Bearer <token>`. El token se obtiene en `POST /auth/login`. Un token ausente o inválido responde 401; un token válido con rol insuficiente responde 403. Los `GET` quedan abiertos.

## Autenticación

- `POST /auth/login`: recibe `{correo,password}`, valida bcrypt y regresa `{token}` JWT. Errores: 400 datos inválidos, 401 credenciales inválidas. El mensaje es el mismo si el correo no existe o la contraseña es incorrecta.

## Usuarios de prueba

- `despacho@hopwright.local`, rol `despachador`, contraseña `hopwright123`.
- `admin@hopwright.local`, rol `administrador`, contraseña `hopwright123`.

## Ciudades

- `GET /ciudades`: lista ciudades.
- `POST /ciudades` (admin): crea ciudad con clave INEGI. Valida formato, unicidad; en transacción guarda `CIUDAD_GUARDADA` en outbox. 201/400/401/403/409.

## Clientes

- `GET /clientes`, `GET /clientes/{id}`.
- `POST /clientes`, `PUT /clientes/{id}` (despachador o admin): validan razón social y RFC, RFC único. 201/200/400/401/403/404/409.
- `DELETE /clientes/{id}` (admin): 204 si borra, 404 si no existe, 409 "Tiene envíos asociados" si hay llaves foráneas. 401/403 si el token no alcanza.

## Conductores

- `GET /conductores`, `GET /conductores/{id}`.
- `POST /conductores`, `PUT /conductores/{id}` (despachador o admin): validan nombre/licencia, licencia única. 201/200/400/401/403/404/409.
- `DELETE /conductores/{id}` (admin): 204 si borra, 404 si no existe, 409 "Tiene vehículos asociados" si hay llaves foráneas. 401/403 si el token no alcanza.

## Vehículos

- `GET /vehiculos`, `GET /vehiculos/{placa}`.
- `POST /vehiculos` (admin): valida tipo/capacidad/estado/conductor; en transacción crea y encola `VEHICULO_GUARDADO`. 201/400/401/403/409.
- `PATCH /vehiculos/{placa}` (admin): actualiza campos; encola `VEHICULO_GUARDADO`. 200/400/401/403/404/409.

## Envíos

- `GET /envios?estado=`: lista, filtro opcional por estado.
- `GET /envios/{id}`: detalle. El id debe cumplir `^E-[0-9]+$`. 404 si no existe.
- `POST /envios` (despachador o admin): valida id con formato `E-[0-9]+`, peso>0, prioridad, origen!=destino, cliente/ciudades existentes. 201/400/401/403/404/409.
- `POST /envios/{id}/asignacion` body `{placa}` (despachador o admin): transacción con `FOR UPDATE` primero del envío y después del vehículo; verifica envío pendiente, vehículo disponible, capacidad suficiente, sin asignación activa doble; crea asignación, cambia estados, encola `ASIGNACION_CREADA`. 201/400/401/403/404/409.
- `POST /envios/{id}/salida` (despachador o admin): Asignado->En camino, guarda fecha_salida y encola `ENVIO_SALIO`. 200/400/401/403/404/409.
- `POST /envios/{id}/entrega` (despachador o admin): En camino->Entregado, desactiva asignación, vehículo Disponible, encola `ENVIO_ENTREGADO`. 200/400/401/403/404/409.
- `POST /envios/{id}/cancelacion` (despachador o admin): solo Pendiente o Asignado; desactiva la asignación, devuelve el vehículo a Disponible, pone el envío Cancelado y encola `ENVIO_CANCELADO`. 200/400/401/403/404/409.
- `GET/POST /envios/{id}/manifiesto`: valida existencia de envío; POST (despachador o admin) describe `tipoCarga` (general, refrigerada, peligrosa), `articulos` y `restriccionesRuta`, con ejemplos de los tres tipos en Swagger. La validación completa por tipo la hace el `$jsonSchema` de MongoDB; si rechaza el documento responde 400 con mensaje claro. 200/201/400/401/403/404/409.
- `GET /envios/{id}/bitacora`: regresa bitácora o estructura vacía.
- `GET /envios/{id}/datos-ruta`: datos del contrato entre las dos partes.

## Servicio interno

- `obtenerDatosParaRuta(idEnvio)`: regresa `{idEnvio, origen, destino, pesoKg, candidatos, restricciones{evitarTerraceria,tiempoMaxMin}, avisos[]}`. Lee PostgreSQL y manifiesto MongoDB; si no hay manifiesto, defaults y aviso.
