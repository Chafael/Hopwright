from estilo import *
fig, ax = lienzo(14, 13.6, 28, 27.2)
OK = "#2e7d4f"; MAL = "#b42318"; AMB = ("#fff8e6", "#b7791f")

def nodo(x, y, w, h, titulo, cuerpo, k=None, fc=None, ec=None):
    if k: fc, ec = BASES[k][0], BASES[k][1]
    fc = fc or "white"; ec = ec or AZUL
    caja(ax, x, y, w, h, fc=fc, ec=ec, lw=1.8, r=0.15)
    texto(ax, x + w / 2, y + h - 0.45, titulo, 11.5, ec, "bold")
    texto(ax, x + w / 2, y + (h - 0.7) / 2, cuerpo, 10, TINTA)

def panel(y0, h, titulo, sub):
    caja(ax, 0.2, y0, 27.6, h, fc="#fbfbfd", ec=LILA2, lw=1.3, r=0.25, z=0)
    texto(ax, 0.7, y0 + h - 0.55, titulo, 14, AZUL, "bold", ha="left")
    texto(ax, 0.7, y0 + h - 1.15, sub, 10.5, GRIS, ha="left", style="italic")

# A. outbox
panel(17.6, 9.4, "A. Cambios que nacen en PostgreSQL", "ciudad nueva, vehículo nuevo, asignación, salida, entrega o cancelación de un envío")
nodo(0.8, 21.0, 5.2, 3.2, "Servicio", "registra el cambio\nque pidió la API", fc=LILA)
caja(ax, 7.0, 20.3, 6.6, 4.6, fc=BASES["pg"][0], ec=BASES["pg"][1], lw=2, r=0.15)
texto(ax, 10.3, 24.4, "Una sola transacción", 11.5, BASES["pg"][1], "bold")
caja(ax, 7.5, 22.35, 5.6, 1.4, fc="white", ec=BASES["pg"][1], lw=1.2, r=0.1)
texto(ax, 10.3, 23.05, "1. el cambio\n(envio, vehiculo, ciudad...)", 9.8)
caja(ax, 7.5, 20.7, 5.6, 1.4, fc="white", ec=BASES["pg"][1], lw=1.2, r=0.1)
texto(ax, 10.3, 21.4, "2. su evento en\neventos_pendientes", 9.8)
nodo(14.6, 21.0, 5.0, 3.2, "Procesador", "cada 5 s toma hasta 20\npendientes (FOR UPDATE\nSKIP LOCKED)", fc=AMB[0], ec=AMB[1])
nodo(21.0, 22.75, 6.3, 2.15, "Neo4j", "MERGE de ciudad o placa;\nal entregar, mueve el camión", k="n4")
nodo(21.0, 20.15, 6.3, 2.15, "MongoDB", "agrega el evento a\nbitacora_envio (sin repetir)", k="mg")
flecha(ax, (6.0, 22.6), (7.0, 22.6))
flecha(ax, (13.6, 22.6), (14.6, 22.6))
flecha(ax, (19.6, 23.1), (21.0, 23.8), color=BASES["n4"][1])
flecha(ax, (19.6, 22.1), (21.0, 21.2), color=BASES["mg"][1])
# resultados
caja(ax, 7.0, 18.0, 9.4, 1.65, fc="#eaf6ee", ec=OK, lw=1.4, r=0.12)
texto(ax, 11.7, 18.82, "Si se aplicó: estado = aplicado y su fecha", 10.3, OK, "bold")
caja(ax, 16.9, 18.0, 10.4, 1.65, fc="#fdeceb", ec=MAL, lw=1.4, r=0.12)
texto(ax, 22.1, 18.82, "Si falló: intentos + 1 y sigue pendiente;\nal quinto intento queda como fallido", 10.0, MAL)
flecha(ax, (17.1, 21.0), (12.5, 19.65), color=OK, rad=-0.15)
flecha(ax, (17.1, 21.0), (20.5, 19.65), color=MAL, rad=0.15)
texto(ax, 0.8, 18.8, "Si la transacción\nfalla, no queda ni\nel cambio ni el evento.", 9.8, GRIS, ha="left", style="italic")

# B. incidentes
panel(9.7, 7.3, "B. Cambios que nacen en MongoDB", "reportar o cerrar un incidente")
nodo(0.8, 11.9, 5.2, 3.0, "POST /incidentes", "o PATCH /incidentes/\n{id}/cerrar", fc=LILA)
nodo(7.0, 11.9, 6.0, 3.0, "MongoDB", "1. guarda el reporte\ncon sincronizado: false", k="mg")
nodo(14.4, 11.9, 6.0, 3.0, "Neo4j", "2. MERGE del Incidente\ny su arista BLOQUEA", k="n4")
flecha(ax, (6.0, 13.4), (7.0, 13.4))
flecha(ax, (13.0, 13.4), (14.4, 13.4))
caja(ax, 21.7, 13.55, 5.6, 2.0, fc="#eaf6ee", ec=OK, lw=1.4, r=0.12)
texto(ax, 24.5, 14.55, "Respondió: marca\nsincronizado: true\ny contesta 201", 10.0, OK)
caja(ax, 21.7, 10.65, 5.6, 2.55, fc="#fdeceb", ec=MAL, lw=1.4, r=0.12)
texto(ax, 24.5, 11.92, "No respondió: el reporte\nya está guardado; contesta\n202 con un aviso y queda\nsincronizado: false", 9.6, MAL)
flecha(ax, (20.4, 14.0), (21.7, 14.5), color=OK)
flecha(ax, (20.4, 12.8), (21.7, 12.2), color=MAL)
texto(ax, 0.8, 10.6, "La API nunca responde \"todo bien\" si una de las dos bases falló.", 10.3, GRIS, ha="left", style="italic")

# C. reconciliacion
panel(0.2, 9.0, "C. Red de seguridad: reconciliación", "POST /admin/reconciliar · solo administrador · se puede correr las veces que sea")
nodo(0.8, 4.35, 8.2, 2.6, "PostgreSQL", "ciudades y vehículos (la fuente)", k="pg")
nodo(0.8, 0.8, 8.2, 3.0, "MongoDB", "incidentes activos y los que\nquedaron con sincronizado: false", k="mg")
nodo(19.3, 1.9, 8.0, 3.9, "Neo4j", "copia lo que falta,\ncorrige lo distinto,\nborra lo que sobra", k="n4")
flecha(ax, (9.0, 5.65), (19.3, 4.6), color=BASES["pg"][1])
flecha(ax, (9.0, 2.3), (19.3, 3.1), color=BASES["mg"][1])
etiqueta(ax, 14.15, 3.85, "MERGE: correrla dos veces\nno cambia nada la segunda", 10)
guardar(fig, "sincronizacion.png")
