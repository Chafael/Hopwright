import { motivoParaNoMover } from "../../backend/src/services/ubicacion.reglas.js";

describe("motivoParaNoMover (R11)", () => {
  it("un tren puede pasar de una estación a otra", () => {
    expect(motivoParaNoMover({ tipoVehiculo: "Tren", tipoPuntoActual: "Estacion", tipoPuntoNuevo: "Estacion" })).toBeNull();
  });

  it("un tren no puede quedar en una ciudad", () => {
    expect(motivoParaNoMover({ tipoVehiculo: "Tren", tipoPuntoActual: "Estacion", tipoPuntoNuevo: "Ciudad" })).toMatch(/R11/);
  });

  it("un camión puede ir a una ciudad o a una intersección, pero no a una estación", () => {
    expect(motivoParaNoMover({ tipoVehiculo: "Camión", tipoPuntoActual: "Ciudad", tipoPuntoNuevo: "Interseccion" })).toBeNull();
    expect(motivoParaNoMover({ tipoVehiculo: "Tráiler", tipoPuntoActual: "Ciudad", tipoPuntoNuevo: "Ciudad" })).toBeNull();
    expect(motivoParaNoMover({ tipoVehiculo: "Camión", tipoPuntoActual: "Ciudad", tipoPuntoNuevo: "Estacion" })).toMatch(/R11/);
  });

  it("sin tipo de PostgreSQL usa la ubicación actual", () => {
    expect(motivoParaNoMover({ tipoVehiculo: null, tipoPuntoActual: "Estacion", tipoPuntoNuevo: "Ciudad" })).toMatch(/R11/);
    expect(motivoParaNoMover({ tipoVehiculo: null, tipoPuntoActual: "Ciudad", tipoPuntoNuevo: "Estacion" })).toMatch(/R11/);
    expect(motivoParaNoMover({ tipoVehiculo: null, tipoPuntoActual: "Interseccion", tipoPuntoNuevo: "Ciudad" })).toBeNull();
  });

  it("sin tipo ni ubicación previa deja moverlo", () => {
    expect(motivoParaNoMover({ tipoVehiculo: null, tipoPuntoActual: null, tipoPuntoNuevo: "Estacion" })).toBeNull();
  });
});
