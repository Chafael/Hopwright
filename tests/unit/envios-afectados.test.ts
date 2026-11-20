// Lógica de la consulta C5 con las bases simuladas (vi.mock).
// Red imaginaria: el envío E-1 va de Tuxtla a Arriaga pasando por INT-CRU; E-2 va a San Cristóbal y no pasa por ahí.
import { vi } from "vitest";

type Ruta = { puntos: { idPunto: string; nombre: string; tipo: string }[]; minutos: number; kilometros: number };
const datos = vi.hoisted(() => ({
  reporte: null as null | { idIncidente: string; tipo: string; gravedad: string; activo: boolean; idPunto: string },
  envios: null as null | { idEnvio: string; origen: string; destino: string; prioridad: string; placa: string | null }[],
  ubicaciones: [] as { placa: string; idPunto: string; tipo: string }[],
  llamadas: [] as { origen: string; destino: string; evitarPuntos?: string[] }[],
}));

const punto = (idPunto: string) => ({ idPunto, nombre: idPunto, tipo: "Ciudad" });

vi.mock("../../backend/src/repositories/document/incidentes.repository.js", () => ({ buscarReporte: async () => datos.reporte }));
vi.mock("../../backend/src/repositories/document/restricciones.repository.js", () => ({ evitaTerraceria: async () => false }));
vi.mock("../../backend/src/repositories/relational/envios-afectados.repository.js", () => ({ enviosEnCamino: async () => datos.envios }));
vi.mock("../../backend/src/repositories/graph/rutas.repository.js", () => ({
  buscarPunto: async (id: string) => punto(id),
  ubicacionesDeVehiculos: async () => datos.ubicaciones,
  rutaCarretera: async (p: { origen: string; destino: string; evitarPuntos?: string[] }): Promise<Ruta | null> => {
    datos.llamadas.push(p);
    if (p.destino === "07009") {
      if (p.evitarPuntos?.includes("INT-CRU")) return { puntos: [punto(p.origen), punto("07078"), punto("07009")], minutos: 652, kilometros: 600 };
      return { puntos: [punto(p.origen), punto("INT-CRU"), punto("07009")], minutos: 218, kilometros: 200 };
    }
    return { puntos: [punto(p.origen), punto(p.destino)], minutos: 72, kilometros: 60 };
  },
}));

const { enviosAfectados } = await import("../../backend/src/services/envios-afectados.service.js");

beforeEach(() => {
  datos.reporte = { idIncidente: "INC-0010", tipo: "Bloqueo", gravedad: "Alta", activo: true, idPunto: "INT-CRU" };
  datos.envios = [
    { idEnvio: "E-1", origen: "07101", destino: "07009", prioridad: "Normal", placa: "CHP-1004" },
    { idEnvio: "E-2", origen: "07101", destino: "07078", prioridad: "Urgente", placa: "CHP-1005" },
  ];
  datos.ubicaciones = [];
  datos.llamadas = [];
});

describe("enviosAfectados (C5)", () => {
  it("solo marca los envíos cuya ruta pasa por el punto y calcula los minutos extra", async () => {
    const r = await enviosAfectados("INC-0010");
    expect(r.revisados).toBe(2);
    expect(r.afectados).toHaveLength(1);
    expect(r.afectados[0]).toMatchObject({ idEnvio: "E-1", minutosExtra: 652 - 218 });
  });

  it("calcula desde donde está el vehículo, no desde el origen", async () => {
    datos.ubicaciones = [{ placa: "CHP-1004", idPunto: "07061", tipo: "Ciudad" }];
    const r = await enviosAfectados("INC-0010");
    expect(r.afectados[0].partida).toBe("07061");
    expect(datos.llamadas[0].origen).toBe("07061");
  });

  it("un incidente cerrado no afecta a nadie", async () => {
    datos.reporte!.activo = false;
    const r = await enviosAfectados("INC-0010");
    expect(r.afectados).toEqual([]);
    expect(datos.llamadas).toEqual([]);
  });

  it("avisa si las tablas de PostgreSQL todavía no existen", async () => {
    datos.envios = null;
    const r = await enviosAfectados("INC-0010");
    expect(r.avisos.join(" ")).toMatch(/todavía no existen/);
  });

  it("404 si el incidente no existe", async () => {
    datos.reporte = null;
    await expect(enviosAfectados("INC-9999")).rejects.toMatchObject({ statusCode: 404 });
  });
});
