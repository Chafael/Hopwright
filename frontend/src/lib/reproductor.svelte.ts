// Estado compartido entre el mapa (que dibuja según el tiempo) y los controles (que lo mueven).
// El tiempo está en milisegundos de la animación a velocidad normal.
export const VELOCIDADES = [0.25, 0.5, 1, 2, 4] as const;

export class Reproductor {
  tiempo = $state(0);
  duracion = $state(0);
  velocidad = $state<number>(1);
  pausado = $state(false);
  // Momento en que se resuelve cada lugar, para avanzar o retroceder de uno en uno
  marcas = $state<number[]>([]);

  terminado = $derived(this.duracion > 0 && this.tiempo >= this.duracion);
  lugaresVistos = $derived(this.marcas.filter((t) => t <= this.tiempo).length);

  reiniciar() {
    this.tiempo = 0;
    this.pausado = false;
  }

  alternar() {
    if (this.terminado) this.reiniciar();
    else this.pausado = !this.pausado;
  }

  irA(t: number) {
    this.tiempo = Math.min(this.duracion, Math.max(0, t));
  }

  verFinal() {
    this.tiempo = this.duracion;
  }

  // Pausa y salta al siguiente o al anterior lugar resuelto
  pasoSiguiente() {
    this.pausado = true;
    const vistos = this.lugaresVistos;
    this.irA(vistos < this.marcas.length ? this.marcas[vistos] : this.duracion);
  }

  pasoAnterior() {
    this.pausado = true;
    const ultima = this.marcas.at(-1) ?? 0;
    // Desde la ruta ya marcada se regresa al último lugar de la búsqueda
    if (this.tiempo > ultima) return this.irA(ultima);
    const vistos = this.lugaresVistos;
    this.irA(vistos >= 2 ? this.marcas[vistos - 2] : 0);
  }
}
