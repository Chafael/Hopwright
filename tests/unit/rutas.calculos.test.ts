// Pruebas unitarias de los cálculos de rutas. No necesitan ninguna base de datos.
import { costoCamion, costoTren, elegirMejores, problemasDeTramo, velocidadKmH } from "../../backend/src/services/rutas.calculos.js";

describe("velocidad de un tramo (R15)", () => {
  it("calcula km/h a partir de distancia y minutos", () => {
    expect(velocidadKmH({ distanciaKm: 60, tiempoMin: 60 })).toBe(60);
    expect(velocidadKmH({ distanciaKm: 15, tiempoMin: 20 })).toBe(45);
  });
});

describe("validación de tramos (R4, R5, R15)", () => {
  it("acepta un tramo normal", () => {
    expect(problemasDeTramo({ distanciaKm: 33, tiempoMin: 40, costo: 180 })).toEqual([]);
  });

  it("rechaza distancia o tiempo en cero o negativos", () => {
    expect(problemasDeTramo({ distanciaKm: 0, tiempoMin: 10 })).toContain("distanciaKm debe ser mayor que 0");
    expect(problemasDeTramo({ distanciaKm: 10, tiempoMin: -5 })).toContain("tiempoMin debe ser mayor que 0");
  });

  it("rechaza costos negativos", () => {
    expect(problemasDeTramo({ distanciaKm: 10, tiempoMin: 10, costo: -1 })).toContain("el costo no puede ser negativo");
  });

  it("rechaza velocidades de más de 110 km/h (dato mal capturado)", () => {
    const problemas = problemasDeTramo({ distanciaKm: 100, tiempoMin: 30 }); // 200 km/h
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/200\.0 km\/h/);
  });

  it("acepta exactamente 110 km/h (caso límite)", () => {
    expect(problemasDeTramo({ distanciaKm: 110, tiempoMin: 60 })).toEqual([]);
  });
});

describe("costos de camión y tren", () => {
  it("camión: casetas más kilómetros por costo por km", () => {
    expect(costoCamion(100, 180, 25)).toBe(2680);
  });

  it("tren: costo por tonelada por las toneladas de la carga", () => {
    expect(costoTren(138, 20_000)).toBe(2760); // 20 toneladas
    expect(costoTren(138, 500)).toBe(69); // media tonelada
  });
});

describe("elegir la opción más barata y la más rápida", () => {
  const camion = { modo: "camion", minutos: 438, kilometros: 395, costo: 9875 };
  const tren = { modo: "camion-tren", minutos: 700, kilometros: 400, costo: 6000 };

  it("separa la más barata de la más rápida", () => {
    const { masBarata, masRapida } = elegirMejores([camion, tren]);
    expect(masBarata?.modo).toBe("camion-tren");
    expect(masRapida?.modo).toBe("camion");
  });

  it("ignora opciones que no existen", () => {
    const { masBarata, masRapida } = elegirMejores([camion, null]);
    expect(masBarata?.modo).toBe("camion");
    expect(masRapida?.modo).toBe("camion");
  });

  it("regresa null si no hay ninguna opción", () => {
    expect(elegirMejores([null, null])).toEqual({ masBarata: null, masRapida: null });
  });
});
