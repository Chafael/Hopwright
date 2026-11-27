from estilo import *
fig, ax = lienzo(14, 10.2, 28, 20.4)
cols = [("Interfaz web", 2.2, None), ("API", 6.6, None), ("Servicio\nenvios-ruta", 11.6, None), ("PostgreSQL", 16.6, "pg"), ("MongoDB", 21.0, "mg"), ("Neo4j", 25.4, "n4")]
X = {n.split("\n")[0]: x for n, x, _ in cols}
top, bot = 18.6, 0.7
for n, x, k in cols:
    fc, ec = (BASES[k][0], BASES[k][1]) if k else (LILA, AZUL)
    caja(ax, x - 1.85, top, 3.7, 1.35, fc=fc, ec=ec, lw=2)
    texto(ax, x, top + 0.67, n, 12.5, ec, "bold")
    ax.plot([x, x], [bot, top], color=LILA2 if not k else ec, lw=1.4, ls=(0, (4, 4)), zorder=1, alpha=0.9)

# bandas por base
def banda(y, n, k, rotulo):
    fc, ec, _ = BASES[k]
    y0, y1 = y - (n - 1) * 1.15 - 0.55, y + 0.95
    caja(ax, 0.3, y0, 27.4, y1 - y0, fc=fc, ec="none", lw=0, r=0.15, z=0)
    texto(ax, 0.6, (y0 + y1) / 2, rotulo, 11, ec, "bold", ha="left")

def msg(y, a, b, t, k=None, ret=False, num=None):
    xa, xb = X[a], X[b]
    color = BASES[k][1] if k else AZUL
    flecha(ax, (xa, y), (xb, y), color=color, ls="--" if ret else "-", lw=1.8)
    xm = (xa + xb) / 2
    etiqueta(ax, xm + (0.35 if num is not None and abs(xb - xa) < 6 else 0), y + 0.42, t, 10.8, TINTA if not ret else GRIS)
    if num is not None:
        ax.add_patch(plt.Circle((xa, y), 0.32, color=color, zorder=6))
        texto(ax, xa, y, str(num), 9.5, "white", "bold", z=7)

y = 17.6
msg(y, "Interfaz web", "API", "GET /envios/E-103/ruta", num=1); y -= 1.25
msg(y, "API", "Servicio", "valida y llama planearRutaDeEnvio()", num=2); y -= 1.45
banda(y, 2, "pg", "1. Datos del envío\n    y la flota")
msg(y, "Servicio", "PostgreSQL", "envío y vehículos Disponibles que aguantan el peso", "pg", num=3); y -= 1.15
msg(y, "PostgreSQL", "Servicio", "Tuxtla a Comitán · 3,000 kg · placas candidatas", "pg", ret=True); y -= 1.75
banda(y, 2, "mg", "2. Condiciones\n    de la carga")
msg(y, "Servicio", "MongoDB", "manifiesto del envío", "mg", num=4); y -= 1.15
msg(y, "MongoDB", "Servicio", "carga peligrosa: no usar terracería", "mg", ret=True); y -= 1.75
banda(y, 4, "n4", "3. Ruta y vehículo")
msg(y, "Servicio", "Neo4j", "ruta sin terracería que esquive incidentes Alta", "n4", num=5); y -= 1.15
msg(y, "Neo4j", "Servicio", "puntos, tramos, minutos, km y casetas", "n4", ret=True); y -= 1.15
msg(y, "Servicio", "Neo4j", "dónde está cada candidato y cuánto tarda al origen", "n4", num=6); y -= 1.15
msg(y, "Neo4j", "Servicio", "vehículo que llega antes", "n4", ret=True); y -= 1.6
msg(y, "Servicio", "API", "ruta + vehículo sugerido + avisos + fuentes", ret=True, num=7); y -= 1.25
msg(y, "API", "Interfaz web", "200: una sola respuesta", ret=True); y -= 0.9

caja(ax, 0.35, 0.35, 8.6, 2.0, fc="#fff8e6", ec="#b7791f", lw=1.4, r=0.15)
texto(ax, 0.65, 1.35, "Si algo falta, no truena: sin manifiesto calcula sin\nrestricciones y lo avisa; si ninguna ruta cumple,\nresponde encontrada: false con el motivo.", 10.2, "#5b4210", ha="left")
guardar(fig, "flujo-integrado.png")
