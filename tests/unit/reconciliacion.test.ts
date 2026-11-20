// Lógica de la reconciliación con las bases simuladas (vi.mock): qué se copia, qué se borra y qué solo se avisa.
import { vi } from "vitest";

const grafo = vi.hoisted(() => ({
  incidentes: [] as { idIncidente: string; gravedad: string; activo: boolean; idPunto: string | null }[],
  ciudades: [] as { idCiudad: string; nombre: string; tramos: number }[],
  vehiculos: [] as { placa: string; ubicado: boolean }[],
  borradosVehiculos: [] as string[],
  ciudadesGuardadas: [] as { idCiudad: string; nombre: string }[],
}));
const fuentes = vi.hoisted(() => ({
  reportes: [] as { idIncidente: string; gravedad: string; activo: boolean; idPunto: string; sincronizado: boolean }[],
  ciudades: null as { idCiudad: string; nombre: string }[] | null,
  placas: null as string[] | null,
}));

vi.mock("../../backend/src/repositories/graph/incidentes.repository.js", () => ({
  listarIncidentesEnGrafo: async () => grafo.incidentes,
  guardarIncidenteEnGrafo: async (i: { idPunto: string }) => i.idPunto !== "INT-NOEXISTE",
  borrarIncidentesDelGrafo: async (ids: string[]) => ids.length,
}));
vi.mock("../../backend/src/repositories/document/incidentes.repository.js", () => ({
  listarParaReconciliar: async () => fuentes.reportes,
  marcarSincronizado: async () => undefined,
}));
vi.mock("../../backend/src/repositories/graph/reconciliacion.repository.js", () => ({
  ciudadesEnGrafo: async () => grafo.ciudades,
  guardarCiudades: async (c: { idCiudad: string; nombre: string }[]) => void grafo.ciudadesGuardadas.push(...c),
  vehiculosEnGrafo: async () => grafo.vehiculos,
  guardarVehiculos: async () => undefined,
  borrarVehiculos: async (p: string[]) => void grafo.borradosVehiculos.push(...p),
}));
vi.mock("../../backend/src/repositories/relational/reconciliacion.repository.js", () => ({
  ciudadesEnPostgres: async () => fuentes.ciudades,
  placasEnPostgres: async () => fuentes.placas,
}));

const { reconciliar } = await import("../../backend/src/services/reconciliacion.service.js");

beforeEach(() => {
  grafo.incidentes = [];
  grafo.ciudades = [];
  grafo.vehiculos = [];
  grafo.borradosVehiculos = [];
  grafo.ciudadesGuardadas = [];
  fuentes.reportes = [];
  fuentes.ciudades = null;
  fuentes.placas = null;
});

describe("reconciliar incidentes", () => {
  it("copia los que faltan o no coinciden y borra los que no están en MongoDB", async () => {
    fuentes.reportes = [
      { idIncidente: "INC-0001", gravedad: "Media", activo: true, idPunto: "07094", sincronizado: true },
      { idIncidente: "INC-0002", gravedad: "Alta", activo: false, idPunto: "INT-FCO", sincronizado: true },
      { idIncidente: "INC-0003", gravedad: "Alta", activo: true, idPunto: "INT-CRU", sincronizado: false },
    ];
    grafo.incidentes = [
      { idIncidente: "INC-0001", gravedad: "Media", activo: true, idPunto: "07094" }, // igual
      { idIncidente: "INC-0002", gravedad: "Alta", activo: true, idPunto: "INT-FCO" }, // no se cerró en el grafo
      { idIncidente: "INC-0099", gravedad: "Alta", activo: true, idPunto: "07101" }, // huérfano
    ];
    const r = await reconciliar();
    expect(r.incidentes.copiados).toEqual(["INC-0002", "INC-0003"]);
    expect(r.incidentes.borradosDelGrafo).toEqual(["INC-0099"]);
  });

  it("reporta los que apuntan a un punto que ya no existe", async () => {
    fuentes.reportes = [{ idIncidente: "INC-0005", gravedad: "Baja", activo: true, idPunto: "INT-NOEXISTE", sincronizado: false }];
    const r = await reconciliar();
    expect(r.incidentes.conPuntoInexistente).toEqual(["INC-0005"]);
    expect(r.incidentes.copiados).toEqual([]);
  });
});

describe("reconciliar ciudades y vehículos", () => {
  it("salta las tablas que no existen con un aviso", async () => {
    const r = await reconciliar();
    expect(r.ciudades).toBeNull();
    expect(r.vehiculos).toBeNull();
    expect(r.avisos).toHaveLength(2);
  });

  it("copia ciudades nuevas o renombradas y no borra las que solo están en el grafo", async () => {
    fuentes.ciudades = [
      { idCiudad: "07101", nombre: "Tuxtla Gutiérrez" },
      { idCiudad: "07027", nombre: "Chiapa de Corzo" },
      { idCiudad: "07999", nombre: "Ciudad Nueva" },
    ];
    grafo.ciudades = [
      { idCiudad: "07101", nombre: "Tuxtla Gutiérrez", tramos: 6 },
      { idCiudad: "07027", nombre: "Chiapa", tramos: 4 },
      { idCiudad: "07089", nombre: "Tapachula", tramos: 4 },
    ];
    const r = await reconciliar();
    expect(r.ciudades?.copiadas).toEqual(["07027", "07999"]);
    expect(r.ciudades?.soloEnGrafo).toEqual(["07089"]);
    expect(r.ciudades?.sinTramos).toEqual(["07999"]);
  });

  it("borra vehículos que ya no están en PostgreSQL", async () => {
    fuentes.placas = ["CHP-1001", "CHP-1007"];
    grafo.vehiculos = [
      { placa: "CHP-1001", ubicado: true },
      { placa: "CHP-0001", ubicado: true },
    ];
    const r = await reconciliar();
    expect(r.vehiculos?.copiados).toEqual(["CHP-1007"]);
    expect(r.vehiculos?.borradosDelGrafo).toEqual(["CHP-0001"]);
    expect(r.vehiculos?.sinUbicacion).toEqual(["CHP-1007"]);
  });

  it("no borra la flota si PostgreSQL no tiene vehículos", async () => {
    fuentes.placas = [];
    grafo.vehiculos = [{ placa: "CHP-1001", ubicado: true }];
    const r = await reconciliar();
    expect(grafo.borradosVehiculos).toEqual([]);
    expect(r.avisos).toEqual(expect.arrayContaining([expect.stringMatching(/por seguridad/)]));
  });
});
