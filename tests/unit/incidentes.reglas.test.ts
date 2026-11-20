import { formatearIdIncidente, normalizarDetalle, problemasDelDetalle, tipoDePunto } from "../../backend/src/services/incidentes.reglas.js";

describe("tipoDePunto", () => {
  it("reconoce ciudades e intersecciones", () => {
    expect(tipoDePunto("07094")).toBe("Ciudad");
    expect(tipoDePunto("INT-CRU")).toBe("Interseccion");
  });

  it("no acepta estaciones ni ids mal formados", () => {
    expect(tipoDePunto("EST-TAP")).toBeNull();
    expect(tipoDePunto("7094")).toBeNull();
    expect(tipoDePunto("int-cru")).toBeNull();
  });
});

describe("problemasDelDetalle", () => {
  it("acepta un bloqueo completo", () => {
    expect(problemasDelDetalle("Bloqueo", { causa: "Retén", carrilesCerrados: 2, pasoAlternado: true })).toEqual([]);
  });

  it("pide los campos obligatorios de cada tipo", () => {
    expect(problemasDelDetalle("Obra", { dependencia: "Obras Públicas" })).toEqual([expect.stringMatching(/fechaFinEstimada/)]);
    expect(problemasDelDetalle("Derrumbe", {})).toHaveLength(2);
    expect(problemasDelDetalle("Accidente", { vehiculosInvolucrados: 2 })).toEqual([expect.stringMatching(/hayLesionados/)]);
  });

  it("rechaza campos de otro tipo y valores fuera de rango", () => {
    const problemas = problemasDelDetalle("Bloqueo", { causa: "Lluvia", carrilesCerrados: 0, volumenEstimadoM3: 5 });
    expect(problemas).toHaveLength(3);
  });

  it("revisa el tipo de cada valor", () => {
    expect(problemasDelDetalle("Accidente", { vehiculosInvolucrados: "dos", hayLesionados: "no" })).toHaveLength(2);
    expect(problemasDelDetalle("Obra", { dependencia: "SCT", fechaFinEstimada: "mañana" })).toHaveLength(1);
  });
});

describe("normalizarDetalle", () => {
  it("convierte las fechas de texto en Date", () => {
    const detalle = normalizarDetalle("Obra", { dependencia: "SCT", fechaFinEstimada: "2026-12-05T18:00:00-06:00" });
    expect(detalle.fechaFinEstimada).toBeInstanceOf(Date);
  });
});

describe("formatearIdIncidente", () => {
  it("rellena con ceros a cuatro dígitos", () => {
    expect(formatearIdIncidente(3)).toBe("INC-0003");
    expect(formatearIdIncidente(12345)).toBe("INC-12345");
  });
});
