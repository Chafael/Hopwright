// Reportes de ejemplo. Coinciden con la réplica que carga database/graph/data/03_incidentes.cypher:
// INC-0001 (obra en Teopisca, Media, activo) e INC-0002 (derrumbe en la Glorieta Frontera Comalapa,
// Alta, ya cerrado). Si se cambia uno, hay que cambiar el otro.

module.exports = {
  coleccion: "reportes_incidente",
  documentos: [
    {
      idIncidente: "INC-0001",
      tipo: "Obra",
      idPunto: "07094",
      tipoPunto: "Ciudad",
      gravedad: "Media",
      descripcion: "Repavimentación en la entrada de Teopisca. Se circula por un solo carril con paso alternado.",
      fechaInicio: new Date("2026-11-16T07:00:00-06:00"),
      detalle: {
        dependencia: "Obras Públicas del Estado de Chiapas",
        fechaFinEstimada: new Date("2026-12-05T18:00:00-06:00"),
        horario: "7:00 a 18:00",
      },
      evidencias: [
        {
          tipo: "Foto",
          url: "https://evidencias.hopwright.local/INC-0001/entrada-teopisca.jpg",
          autor: "Despacho Tuxtla",
          fecha: new Date("2026-11-16T09:15:00-06:00"),
        },
        {
          tipo: "Testimonio",
          texto: "El banderero dice que la espera es de unos 15 minutos en hora pico.",
          autor: "Conductor de CHP-1005",
          fecha: new Date("2026-11-17T08:40:00-06:00"),
        },
      ],
      activo: true,
      sincronizado: true,
      reportadoPor: "Despacho Tuxtla",
      creadoEn: new Date("2026-11-16T09:20:00-06:00"),
    },
    {
      idIncidente: "INC-0002",
      tipo: "Derrumbe",
      idPunto: "INT-FCO",
      tipoPunto: "Interseccion",
      gravedad: "Alta",
      descripcion: "Derrumbe por lluvias cerca de la glorieta de Frontera Comalapa; la carretera quedó cerrada en los dos sentidos.",
      fechaInicio: new Date("2026-11-10T05:30:00-06:00"),
      fechaFin: new Date("2026-11-12T16:00:00-06:00"),
      motivoCierre: "Protección Civil retiró el material y abrió los dos carriles.",
      detalle: {
        volumenEstimadoM3: 350,
        requiereMaquinaria: true,
      },
      evidencias: [
        {
          tipo: "Foto",
          url: "https://evidencias.hopwright.local/INC-0002/derrumbe.jpg",
          autor: "Conductor de CHP-1006",
          fecha: new Date("2026-11-10T06:10:00-06:00"),
        },
      ],
      activo: false,
      sincronizado: true,
      reportadoPor: "Despacho Comitán",
      creadoEn: new Date("2026-11-10T06:15:00-06:00"),
      actualizadoEn: new Date("2026-11-12T16:05:00-06:00"),
    },
  ],
};
