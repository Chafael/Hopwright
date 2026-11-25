// Flujo integrado sin bases: se simulan las dos mitades (PostgreSQL+MongoDB y Neo4j)
// para revisar que las restricciones del manifiesto llegan al cálculo de la ruta y que los avisos se juntan.
import { vi } from "vitest";

const datosParaRuta = vi.fn();
const rutaConRestricciones = vi.fn();
vi.mock("../../backend/src/services/envios.service.js", () => ({ obtenerDatosParaRuta: datosParaRuta }));
vi.mock("../../backend/src/services/rutas.service.js", () => ({ calcularRutaConRestricciones: rutaConRestricciones }));

const { planearRutaDeEnvio } = await import("../../backend/src/services/envios-ruta.service.js");

const datos = (cambios: Record<string, unknown> = {}) => ({
  idEnvio: "E-103", estado: "Pendiente", tipoCarga: "peligrosa", origen: "07101", destino: "07019", pesoKg: 3000,
  candidatos: ["CHP-1002", "CHP-1006"], restricciones: { evitarTerraceria: true, tiempoMaxMin: null }, avisos: [], ...cambios,
});
const calculo = (cambios: Record<string, unknown> = {}) => ({
  encontrada: true, ruta: [], tramos: [], minutos: 200, kilometros: 160, costoCasetas: 0,
  vehiculoSugerido: { placa: "CHP-1006", minutosAlOrigen: 0 }, avisos: [], ...cambios,
});

beforeEach(() => {
  datosParaRuta.mockReset();
  rutaConRestricciones.mockReset();
});

describe("planearRutaDeEnvio", () => {
  it("pasa las restricciones del manifiesto y los candidatos al cálculo en el grafo", async () => {
    datosParaRuta.mockResolvedValue(datos());
    rutaConRestricciones.mockResolvedValue(calculo());
    const r = await planearRutaDeEnvio("E-103", "distancia");
    expect(rutaConRestricciones).toHaveBeenCalledWith({
      origen: "07101", destino: "07019", criterio: "distancia", evitarTerraceria: true, tiempoMaxMin: null, candidatos: ["CHP-1002", "CHP-1006"],
    });
    expect(r.vehiculoSugerido).toEqual({ placa: "CHP-1006", minutosAlOrigen: 0 });
    expect(r.fuentes.mongodb).toBe("manifiesto (peligrosa)");
  });

  it("junta los avisos de las dos partes y avisa si nadie aguanta el peso", async () => {
    datosParaRuta.mockResolvedValue(datos({ candidatos: [], avisos: ["El envío no tiene manifiesto"], tipoCarga: null }));
    rutaConRestricciones.mockResolvedValue(calculo({ vehiculoSugerido: null, avisos: ["La ruta pasa por Ocosingo"] }));
    const r = await planearRutaDeEnvio("E-103");
    expect(r.criterio).toBe("tiempo");
    expect(r.avisos).toEqual([
      "El envío no tiene manifiesto",
      "No hay vehículos disponibles que aguanten el peso de la carga",
      "La ruta pasa por Ocosingo",
    ]);
    expect(r.fuentes.mongodb).toBe("sin manifiesto");
  });

  it("un envío cancelado se puede consultar pero lo avisa", async () => {
    datosParaRuta.mockResolvedValue(datos({ estado: "Cancelado" }));
    rutaConRestricciones.mockResolvedValue(calculo());
    const r = await planearRutaDeEnvio("E-108");
    expect(r.avisos[0]).toMatch(/cancelado/);
  });

  it("si el envío no existe, el error de PostgreSQL sube sin consultar el grafo", async () => {
    datosParaRuta.mockRejectedValue(new Error("El envío E-1 no existe"));
    await expect(planearRutaDeEnvio("E-1")).rejects.toThrow("no existe");
    expect(rutaConRestricciones).not.toHaveBeenCalled();
  });
});
