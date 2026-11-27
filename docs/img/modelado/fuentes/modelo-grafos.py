import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch, PathPatch
from matplotlib.path import Path
import numpy as np
plt.rcParams["font.family"]="Liberation Sans"
AZ="#1f1d8a"; FILL="#f2f1fa"; INK="#16161d"
R=1.08
P={"Vehiculo":(0,3.2),"Estacion":(0,8.2),"Ciudad":(6,6.4),"Interseccion":(6,0),"Incidente":(12,3.2)}
fig,ax=plt.subplots(figsize=(12,9)); ax.set_xlim(-2.6,14); ax.set_ylim(-2.6,10.8); ax.set_aspect("equal"); ax.axis("off")
for n,(x,y) in P.items():
    ax.add_patch(Circle((x,y),R,fc=FILL,ec=AZ,lw=2.2,zorder=3))
    ax.text(x,y,n,ha="center",va="center",fontsize=13,color=INK,zorder=4)
def etiqueta(x,y,t):
    ax.text(x,y,t,ha="center",va="center",fontsize=11.5,color=INK,bbox=dict(fc="white",ec="none",pad=2),zorder=5)
def flecha(a,b,label,both=False,lpos=0.5,off=(0,0)):
    (x1,y1),(x2,y2)=P[a],P[b]; d=np.array([x2-x1,y2-y1]); u=d/np.linalg.norm(d)
    s=np.array([x1,y1])+u*R; e=np.array([x2,y2])-u*R
    ax.add_patch(FancyArrowPatch(s,e,arrowstyle="<|-|>" if both else "-|>",mutation_scale=18,color=AZ,lw=1.8,zorder=2))
    m=s+(e-s)*lpos; etiqueta(m[0]+off[0],m[1]+off[1],label)
def bucle(n,ang,label):
    x,y=P[n]; c=np.array([x,y]); a=np.radians(ang)
    a1,a2=a-np.radians(28),a+np.radians(28)
    s=c+R*np.array([np.cos(a1),np.sin(a1)]); e=c+R*np.array([np.cos(a2),np.sin(a2)])
    k=3.4*R
    c1=c+k*np.array([np.cos(a1-0.25),np.sin(a1-0.25)]); c2=c+k*np.array([np.cos(a2+0.25),np.sin(a2+0.25)])
    ax.add_patch(FancyArrowPatch(path=Path([s,c1,c2,e],[Path.MOVETO,Path.CURVE4,Path.CURVE4,Path.CURVE4]),arrowstyle="-|>",mutation_scale=16,color=AZ,lw=1.8,zorder=2))
    t=c+(R+1.8)*np.array([np.cos(a),np.sin(a)]); etiqueta(t[0],t[1],label)
flecha("Vehiculo","Estacion","SE_ENCUENTRA_EN")
flecha("Vehiculo","Ciudad","SE_ENCUENTRA_EN")
flecha("Vehiculo","Interseccion","SE_ENCUENTRA_EN")
flecha("Estacion","Ciudad","UBICADA_EN")
flecha("Incidente","Ciudad","BLOQUEA")
flecha("Incidente","Interseccion","BLOQUEA")
flecha("Ciudad","Interseccion","CARRETERA",both=True)
bucle("Ciudad",90,"CARRETERA")
bucle("Interseccion",-90,"CARRETERA")
bucle("Estacion",150,"VIA_FERREA")
fig.savefig("d3.png",dpi=200,bbox_inches="tight",facecolor="white")
