module.exports = {
  coleccion: "bitacora_envio",
  documentos: [
    {
      idEnvio: "E-104",
      eventos: [
        { tipo: "ASIGNACION_CREADA", fecha: new Date("2026-11-20T08:40:00-06:00"), detalle: { idEnvio: "E-104", placa: "CHP-1003" } },
        { tipo: "ENVIO_SALIO", fecha: new Date("2026-11-20T09:00:00-06:00"), detalle: { idEnvio: "E-104", fecha: "2026-11-20T09:00:00-06:00" } },
      ],
    },
    {
      idEnvio: "E-105",
      eventos: [
        { tipo: "ASIGNACION_CREADA", fecha: new Date("2026-11-19T06:30:00-06:00"), detalle: { idEnvio: "E-105", placa: "CHP-1002" } },
        { tipo: "ENVIO_SALIO", fecha: new Date("2026-11-19T07:00:00-06:00"), detalle: { idEnvio: "E-105", fecha: "2026-11-19T07:00:00-06:00" } },
        { tipo: "ENVIO_ENTREGADO", fecha: new Date("2026-11-19T18:00:00-06:00"), detalle: { idEnvio: "E-105", fecha: "2026-11-19T18:00:00-06:00" } },
      ],
    },
  ],
};
