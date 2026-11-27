from estilo import *
filas = [
 ("Usuario", {"pg": ("F", "")}, "no se copia"),
 ("Cliente", {"pg": ("F", "")}, "no se copia"),
 ("Conductor", {"pg": ("F", "")}, "no se copia"),
 ("Ciudad", {"pg": ("F", ""), "n4": ("R", "idCiudad, nombre")}, "evento\nCIUDAD_GUARDADA"),
 ("Vehículo (datos)", {"pg": ("F", ""), "n4": ("R", "placa")}, "evento\nVEHICULO_GUARDADO"),
 ("Envío y asignación", {"pg": ("F", "")}, "no se copia"),
 ("Manifiesto", {"mg": ("F", "")}, "no se copia; idEnvio\nse revisa en PostgreSQL"),
 ("Bitácora de envío", {"mg": ("F", "")}, "la escriben los eventos\nque nacen en PostgreSQL"),
 ("Reporte de incidente", {"mg": ("F", ""), "n4": ("R", "id, gravedad,\nactivo y BLOQUEA")}, "en la misma operación;\nsincronizado + reconciliar"),
 ("Red: puntos y tramos", {"n4": ("F", "")}, "no se copia"),
 ("Ubicación del vehículo", {"n4": ("F", "")}, "no se copia"),
]
n = len(filas); fh = 1.15
H = 2.4 + n * fh + 1.4
fig, ax = lienzo(14, H * 0.5, 28, H)
cx = {"pg": 8.9, "mg": 13.5, "n4": 18.5}
xs = 21.5
top = H - 0.6
# encabezados
texto(ax, 0.6, top - 0.6, "Dato", 12.5, AZUL, "bold", ha="left")
for k, x in cx.items():
    fc, ec, nom = BASES[k]
    caja(ax, x - 2.2, top - 1.15, 4.4, 1.1, fc=fc, ec=ec, lw=2, r=0.15)
    texto(ax, x, top - 0.6, nom, 12.5, ec, "bold")
texto(ax, xs, top - 0.6, "Cómo se mantiene", 12.5, AZUL, "bold", ha="left")
y = top - 1.6
for i, (dato, cel, sync) in enumerate(filas):
    yc = y - fh / 2
    if i % 2 == 0:
        ax.add_patch(plt.Rectangle((0.3, y - fh), 27.4, fh, fc="#f7f7fb", ec="none", zorder=0))
    texto(ax, 0.6, yc, dato, 11.5, TINTA, ha="left")
    for k, x in cx.items():
        fc, ec, _ = BASES[k]
        if k in cel:
            tipo, campos = cel[k]
            if tipo == "F":
                caja(ax, x - 1.6, yc - 0.33, 3.2, 0.66, fc=ec, ec=ec, lw=1.5, r=0.3)
                texto(ax, x, yc, "Fuente", 10.5, "white", "bold")
            else:
                hh = 0.66 if "\n" not in campos else 0.95
                caja(ax, x - 2.35, yc - hh / 2, 4.7, hh, fc="white", ec=ec, lw=1.5, r=0.3, ls=(0, (3, 2)))
                texto(ax, x, yc, "Réplica: " + campos, 9.2, ec)
        else:
            texto(ax, x, yc, "·", 14, LILA2)
    texto(ax, xs, yc, sync, 9.8, GRIS, ha="left")
    y -= fh
# leyenda
ly = y - 0.75
caja(ax, 0.6, ly - 0.3, 2.4, 0.6, fc=AZUL, ec=AZUL, r=0.28)
texto(ax, 1.8, ly, "Fuente", 9.8, "white", "bold")
texto(ax, 3.3, ly, "se modifica oficialmente aquí", 10, GRIS, ha="left")
caja(ax, 10.2, ly - 0.3, 2.4, 0.6, fc="white", ec=AZUL, r=0.28, ls=(0, (3, 2)))
texto(ax, 11.4, ly, "Réplica", 9.8, AZUL)
texto(ax, 12.9, ly, "copia mínima, solo los campos que necesita esa base", 10, GRIS, ha="left")
guardar(fig, "propiedad-datos.png")
