from estilo import *
fig, ax = lienzo(13, 15.5, 26, 31)
X0, W = 1.0, 24.0

# Usuarios
texto(ax, 13, 30.2, "Despachador y administrador, desde el navegador", 12.5, GRIS, style="italic")
flecha(ax, (13, 29.7), (13, 28.75))

# Interfaz
caja(ax, X0, 25.6, W, 3.1)
texto(ax, X0 + 0.6, 28.05, "Interfaz web", 15, AZUL, "bold", ha="left")
texto(ax, X0 + 0.6, 27.35, "SvelteKit 2 · Svelte 5 · Tailwind · Flowbite · MapLibre GL", 11, GRIS, ha="left")
pant = ["Envíos", "Rutas", "Camión o tren", "Red y cierres", "Incidentes", "Mantenimiento"]
for i, p in enumerate(pant):
    caja(ax, X0 + 0.6 + i * 3.85, 25.95, 3.55, 0.95, fc="white", ec=LILA2, lw=1.2, r=0.12)
    texto(ax, X0 + 0.6 + i * 3.85 + 1.775, 26.42, p, 11)
etiqueta(ax, 13, 24.95, "HTTP + JSON · token JWT en el encabezado Authorization", 11)
flecha(ax, (13, 25.6), (13, 24.3))

# API
caja(ax, X0, 20.6, W, 3.7)
texto(ax, X0 + 0.6, 23.65, "API REST · controladores", 15, AZUL, "bold", ha="left")
texto(ax, X0 + 0.6, 22.95, "Node.js · Fastify 5 · TypeScript", 11, GRIS, ha="left")
api = [("Validación", "JSON Schema en\ncada ruta"), ("Permisos", "JWT y rol\n(@fastify/jwt)"), ("Contrato", "Swagger / OpenAPI\nen /docs"), ("Errores", "misma forma siempre:\n400 a 409 y 503")]
for i, (t, d) in enumerate(api):
    x = X0 + 0.6 + i * 5.8
    caja(ax, x, 20.9, 5.5, 1.6, fc="white", ec=LILA2, lw=1.2, r=0.12)
    texto(ax, x + 0.3, 22.1, t, 11.5, TINTA, "bold", ha="left")
    texto(ax, x + 0.3, 21.45, d, 10, GRIS, ha="left")
flecha(ax, (13, 20.6), (13, 19.45))

# Servicios
caja(ax, X0, 14.4, 18.2, 5.05)
texto(ax, X0 + 0.6, 18.85, "Servicios · reglas de negocio y coordinación", 15, AZUL, "bold", ha="left")
serv = [("Envíos y flota", "estados, asignación,\nmanifiestos"), ("Rutas y red", "ruta, camión o tren,\nciudades aisladas"), ("Incidentes", "reportar, cerrar,\nenvíos afectados"),
        ("Flujo integrado", "ruta de un envío\ncon las tres bases"), ("Reconciliación", "compara réplicas\ncon su fuente"), ("Usuarios", "login y\ncontraseñas (bcrypt)")]
for i, (t, d) in enumerate(serv):
    c, f = i % 3, i // 3
    x = X0 + 0.6 + c * 5.8; y = 16.55 - f * 1.95
    caja(ax, x, y, 5.5, 1.7, fc="white", ec=LILA2, lw=1.2, r=0.12)
    texto(ax, x + 0.3, y + 1.22, t, 11.5, TINTA, "bold", ha="left")
    texto(ax, x + 0.3, y + 0.55, d, 10, GRIS, ha="left")

# Procesador de eventos
caja(ax, 20.0, 14.4, 5.0, 5.05, fc="#fff8e6", ec="#b7791f")
texto(ax, 22.5, 18.75, "Procesador de\neventos", 13, "#8a5a12", "bold")
texto(ax, 22.5, 16.55, "cada 5 s toma\nlos pendientes de\neventos_pendientes\ny los aplica en\nNeo4j y MongoDB", 10.2, "#5b4210")
texto(ax, 22.5, 14.95, "hasta 5 intentos", 9.5, "#8a5a12", style="italic")
flecha(ax, (11, 14.4), (11, 13.25))

# Repositorios
caja(ax, X0, 9.6, W, 3.65)
texto(ax, X0 + 0.6, 12.6, "Repositorios · un módulo por base, con el driver oficial", 15, AZUL, "bold", ha="left")
rep = [("pg", "repositories/relational", "driver pg · SQL con\nparámetros \\$1, \\$2 y\ntransacciones"),
       ("mg", "repositories/document", "driver mongodb ·\nfiltros como objetos,\nnunca texto armado"),
       ("n4", "repositories/graph", "neo4j-driver · Cypher\ncon \\$parámetros ·\nAPOC para Dijkstra")]
for i, (k, t, d) in enumerate(rep):
    fc, ec, _ = BASES[k]
    x = X0 + 0.6 + i * 7.8
    caja(ax, x, 9.9, 7.4, 2.15, fc=fc, ec=ec, lw=1.6, r=0.12)
    texto(ax, x + 0.35, 11.6, t, 11.5, ec, "bold", ha="left")
    texto(ax, x + 0.35, 10.75, d, 10, TINTA, ha="left")
# procesador baja a repositorios
flecha(ax, (22.5, 14.4), (22.5, 12.05), color="#b7791f", ls="--")

# Bases (dentro de Docker)
caja(ax, X0 - 0.3, 0.3, W + 0.6, 7.9, fc="white", ec=GRIS, lw=1.3, ls="--", r=0.25, z=1)
texto(ax, 13, 0.95, "Docker Compose · cada base se crea y se carga desde cero con sus scripts", 11, GRIS, style="italic")
bd = [("pg", "PostgreSQL 16", "Fuente de verdad de:\nusuarios, clientes,\nconductores, ciudades,\nvehículos, envíos,\nasignaciones", "Salida de cambios:\ntabla eventos_pendientes"),
      ("mg", "MongoDB 7", "Fuente de verdad de:\nmanifiestos,\nbitácora de envíos,\nreportes de incidente", "Validadores \\$jsonSchema\nen modo estricto"),
      ("n4", "Neo4j 5 + APOC", "Fuente de verdad de:\nred de carreteras y tren,\nubicación de vehículos", "Réplicas: ciudad, placa\ne incidente (mínimas)")]
for i, (k, t, d, n) in enumerate(bd):
    fc, ec, _ = BASES[k]
    x = X0 + 0.6 + i * 7.8
    caja(ax, x, 1.5, 7.4, 6.1, fc=fc, ec=ec, lw=2.0, r=0.2)
    texto(ax, x + 3.7, 6.9, t, 14, ec, "bold")
    texto(ax, x + 3.7, 4.75, d, 10.8, TINTA)
    texto(ax, x + 3.7, 2.3, n, 9.8, GRIS, style="italic")
    flecha(ax, (x + 3.7, 9.9), (x + 3.7, 7.6), color=ec)
lab = ["SQL", "operaciones", "Cypher"]
for i, l in enumerate(lab):
    etiqueta(ax, X0 + 0.6 + i * 7.8 + 3.7, 8.95, l, 10)

guardar(fig, "arquitectura.png")
