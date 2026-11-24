import { describe, expect, it, vi } from "vitest";

vi.mock("../../backend/src/repositories/relational/envios.repository.js", () => ({
  buscarEnvio: vi.fn(async (id: string) => id === "E-1" ? { idEnvio: "E-1" } : null),
}));
vi.mock("../../backend/src/repositories/document/manifiestos.repository.js", () => ({
  buscarManifiesto: vi.fn(async () => null),
  crearManifiesto: vi.fn(async () => undefined),
}));

import { guardarManifiesto } from "../../backend/src/services/envios.service.js";

describe("validación de manifiestos", () => {
  it("acepta general válido", async () => {
    await expect(guardarManifiesto("E-1", { tipoCarga: "general", articulos: [{ descripcion: "Caja", cantidad: 1, pesoKg: 1 }], restriccionesRuta: { evitarTerraceria: false, tiempoMaxMin: null } })).resolves.toBeTruthy();
  });

  it("acepta refrigerada válida", async () => {
    await expect(guardarManifiesto("E-1", { tipoCarga: "refrigerada", articulos: [{ descripcion: "Vacuna", cantidad: 1, pesoKg: 1 }], tempMinC: 2, tempMaxC: 8, tiempoMaxMin: 120 })).resolves.toBeTruthy();
  });

  it("acepta peligrosa válida", async () => {
    await expect(guardarManifiesto("E-1", { tipoCarga: "peligrosa", articulos: [{ descripcion: "Químico", cantidad: 1, pesoKg: 1 }], claseUN: 3, numeroONU: "UN1993", hojaSeguridad: "hs", telefonoEmergencia: "555" })).resolves.toBeTruthy();
  });

  it("rechaza peligrosa sin claseUN", async () => {
    await expect(guardarManifiesto("E-1", { tipoCarga: "peligrosa", articulos: [{ descripcion: "Químico", cantidad: 1, pesoKg: 1 }], numeroONU: "UN1993", hojaSeguridad: "hs", telefonoEmergencia: "555" })).rejects.toBeTruthy();
  });
});
