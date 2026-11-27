import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
plt.rcParams["font.family"] = "Liberation Sans"
AZUL = "#1f1d8a"; LILA = "#f2f1fa"; LILA2 = "#c9c8e3"; TINTA = "#16161d"; GRIS = "#5f6470"
BASES = {
    "pg": ("#e4ecf6", "#2f5d8a", "PostgreSQL"),
    "mg": ("#e5f3e9", "#2e7d4f", "MongoDB"),
    "n4": ("#f4e9f7", "#7b2d8e", "Neo4j"),
}

def caja(ax, x, y, w, h, fc=LILA, ec=AZUL, lw=1.8, r=0.18, z=2, ls="-"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=fc, ec=ec, lw=lw, zorder=z, linestyle=ls))

def texto(ax, x, y, t, size=12, color=TINTA, weight="normal", ha="center", va="center", z=5, style="normal"):
    ax.text(x, y, t, fontsize=size, color=color, fontweight=weight, ha=ha, va=va, zorder=z, linespacing=1.35, fontstyle=style)

def flecha(ax, a, b, color=AZUL, lw=1.8, estilo="-|>", rad=0.0, ls="-", z=3, ms=16):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle=estilo, mutation_scale=ms, color=color, lw=lw, connectionstyle=f"arc3,rad={rad}", linestyle=ls, zorder=z, shrinkA=0, shrinkB=0))

def etiqueta(ax, x, y, t, size=10.5, color=GRIS, ha="center"):
    ax.text(x, y, t, fontsize=size, color=color, ha=ha, va="center", zorder=6, bbox=dict(fc="white", ec="none", pad=1.5), linespacing=1.3)

def lienzo(w, h, xmax, ymax):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, xmax); ax.set_ylim(0, ymax); ax.axis("off")
    return fig, ax

def guardar(fig, nombre):
    # Las imágenes se guardan en docs/img/arquitectura/, una carpeta arriba de este script
    import os
    nombre = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", nombre)
    fig.savefig(nombre, dpi=220, bbox_inches="tight", facecolor="white", pad_inches=0.15)
