// Cliente de la API de Hopwright. La interfaz nunca habla con las bases de datos: todo pasa por aquí.
// Cada función regresa el JSON tal como lo manda el backend; si la respuesta es un error,
// lanza ErrorApi con el mensaje que armó el backend ({ error, mensaje, statusCode, detalles }).

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public detalles?: unknown,
  ) {
    super(mensaje);
  }
}

// El token de la sesión (lo guarda $lib/sesion.svelte al iniciar sesión) viaja en cada petición
function token(): string | null {
  try {
    return localStorage.getItem("hopwright.token");
  } catch {
    return null;
  }
}

type Respuesta<T> = { status: number; datos: T };

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta<T>> {
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras["content-type"] = "application/json";
  const t = token();
  if (t) cabeceras.authorization = `Bearer ${t}`;

  let res: Response;
  try {
    res = await fetch(BASE + ruta, { method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  } catch {
    throw new ErrorApi(0, `No hay conexión con la API en ${BASE}. Revisa que el backend esté corriendo (npm run dev en backend/).`);
  }

  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!res.ok && !(res.status === 503 && ruta === "/health")) {
    // Token vencido o inválido: se avisa para cerrar la sesión y pedir que entre de nuevo
    if (res.status === 401 && t) window.dispatchEvent(new CustomEvent("hopwright:sesion-vencida"));
    const mensaje =
      res.status === 401 && ruta !== "/auth/login" ? "Necesitas iniciar sesión para hacer esto." : res.status === 403 ? "Tu usuario no tiene permiso para hacer esto." : (datos?.mensaje ?? `La API respondió ${res.status}`);
    throw new ErrorApi(res.status, mensaje, datos?.detalles);
  }
  return { status: res.status, datos: datos as T };
}

const get = async <T>(ruta: string) => (await pedir<T>("GET", ruta)).datos;

function consulta(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------- Tipos ----------

export type TipoPunto = "Ciudad" | "Interseccion" | "Estacion";
export type Punto = { idPunto: string; nombre: string; tipo: TipoPunto };
export type PuntoMapa = Punto & { latitud: number | null; longitud: number | null };
export type TramoMapa = {
  desde: string;
  hasta: string;
  tipo: "CARRETERA" | "VIA_FERREA";
  tipoVia: string | null;
  abierto: boolean;
  distanciaKm: number;
  tiempoMin: number;
  costoCaseta: number;
};
export type Mapa = {
  puntos: PuntoMapa[];
  tramos: TramoMapa[];
  incidentes: { idIncidente: string; gravedad: Gravedad; idPunto: string }[];
  vehiculos: { placa: string; idPunto: string }[];
};

export type EstadoBase = { estado: "ok" | "error"; ms: number; detalle?: string };
export type Salud = { estado: "ok" | "degradado"; bases: { postgres: EstadoBase; mongo: EstadoBase; neo4j: EstadoBase } };

export type Criterio = "tiempo" | "distancia" | "costo";
export type TramoRuta = { desde: string; hacia: string; distanciaKm: number; tiempoMin: number; costoCaseta: number; tipoVia: string };
export type Ruta = {
  encontrada: boolean;
  ruta: Punto[];
  tramos: TramoRuta[];
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  avisos: string[];
};

export type OpcionTransporte = {
  modo: "camion" | "camion-tren";
  minutos: number;
  kilometros: number;
  costo: number;
  ruta?: Punto[];
  estacionSubida?: string;
  estacionBajada?: string;
  tramos?: { modo: "camion" | "tren"; desde: string; hasta: string; minutos: number; kilometros: number; costo: number }[];
};
export type ComparacionCamionTren = {
  origen: string;
  destino: string;
  pesoKg: number;
  costoKmCamion: number;
  soloCamion: OpcionTransporte | null;
  camionTren: OpcionTransporte | null;
  masBarata: string | null;
  masRapida: string | null;
};

export type PasoExploracion =
  | { tipo: "visita"; punto: string; lado: "origen" | "destino"; costo: number }
  | { tipo: "tramo"; desde: string; hasta: string; lado: "origen" | "destino"; mejora: boolean; costo?: number };
export type Algoritmo = "dijkstra" | "bidireccional";
export type Exploracion = {
  algoritmo: Algoritmo;
  criterio: Criterio;
  encontrada: boolean;
  ruta: string[];
  costo: number;
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  explorados: number;
  tramosRevisados: number;
  pasos: PasoExploracion[];
  neo4j: { encontrada: boolean; ruta: string[]; costo: number | null; minutos: number; kilometros: number };
  coincide: boolean;
  avisos: string[];
};

export type CiudadesAisladas = { puntoCerrado: Punto; destino: Punto; aisladas: { idCiudad: string; nombre: string }[] };

export type Gravedad = "Baja" | "Media" | "Alta";
export type TipoIncidente = "Bloqueo" | "Accidente" | "Obra" | "Derrumbe";
export type Evidencia = { tipo: "Foto" | "Testimonio"; url?: string; texto?: string; autor?: string; fecha: string };
export type Incidente = {
  idIncidente: string;
  tipo: TipoIncidente;
  idPunto: string;
  tipoPunto: "Ciudad" | "Interseccion";
  gravedad: Gravedad;
  descripcion: string;
  fechaInicio: string;
  fechaFin?: string;
  motivoCierre?: string;
  detalle: Record<string, unknown>;
  evidencias: Evidencia[];
  activo: boolean;
  sincronizado: boolean;
  reportadoPor: string;
  creadoEn: string;
  actualizadoEn?: string;
};
export type EscrituraIncidente = { incidente: Incidente; aviso?: string; status: number };

export type EnvioAfectado = {
  idEnvio: string;
  placa: string | null;
  prioridad: string;
  partida: string;
  destino: string;
  rutaSinIncidente: { minutos: number; kilometros: number; ruta: string[] };
  desvio: { minutos: number; kilometros: number; ruta: string[] } | null;
  minutosExtra: number | null;
};
export type EnviosAfectados = {
  incidente: { idIncidente: string; tipo: string; gravedad: string; activo: boolean; idPunto: string; punto: string | null };
  revisados: number;
  afectados: EnvioAfectado[];
  avisos: string[];
};

export type Reconciliacion = {
  incidentes: { revisados: number; copiados: string[]; borradosDelGrafo: string[]; conPuntoInexistente: string[] };
  ciudades: { revisadas: number; copiadas: string[]; soloEnGrafo: string[]; sinTramos: string[] } | null;
  vehiculos: { revisados: number; copiados: string[]; borradosDelGrafo: string[]; sinUbicacion: string[] } | null;
  avisos: string[];
  duracionMs: number;
};

export type EstadoEnvio = "Pendiente" | "Asignado" | "En camino" | "Entregado" | "Cancelado";
export type Envio = {
  idEnvio: string;
  idCliente: number;
  idCiudadOrigen: string;
  idCiudadDestino: string;
  pesoKg: number;
  prioridad: "Normal" | "Urgente";
  estado: EstadoEnvio;
  fechaSalida: string | null;
  creadoEn: string;
};
export type NuevoEnvio = Omit<Envio, "estado" | "fechaSalida" | "creadoEn">;
export type Cliente = { idCliente: number; razonSocial: string; rfc: string; telefono: string | null; correo: string | null };
export type Ciudad = { idCiudad: string; nombre: string; estado: string };
export type Vehiculo = { placa: string; tipo: "Camión" | "Tráiler" | "Tren"; capacidadKg: number; estado: string; idConductor: number | null };
export type TipoCarga = "general" | "refrigerada" | "peligrosa";
export type Articulo = { descripcion: string; cantidad: number; pesoKg: number };
export type Manifiesto = {
  idEnvio: string;
  tipoCarga: TipoCarga;
  articulos: Articulo[];
  tempMinC?: number;
  tempMaxC?: number;
  tiempoMaxMin?: number;
  claseUN?: number;
  numeroONU?: string;
  hojaSeguridad?: string;
  telefonoEmergencia?: string;
  restriccionesRuta?: { evitarTerraceria: boolean; tiempoMaxMin: number | null };
  creadoEn: string;
};
export type Bitacora = { idEnvio: string; eventos: { tipo: string; fecha: string; detalle: Record<string, unknown> }[] };
export type RutaEnvio = {
  idEnvio: string;
  estado: EstadoEnvio;
  origen: string;
  destino: string;
  pesoKg: number;
  tipoCarga: TipoCarga | null;
  criterio: Criterio;
  restricciones: { evitarTerraceria: boolean; tiempoMaxMin: number | null };
  candidatos: string[];
  encontrada: boolean;
  ruta: Punto[];
  tramos: TramoRuta[];
  minutos: number;
  kilometros: number;
  costoCasetas: number;
  vehiculoSugerido: { placa: string; minutosAlOrigen: number } | null;
  avisos: string[];
  fuentes: { postgresql: string; mongodb: string; neo4j: string };
};

// ---------- Llamadas ----------

export const api = {
  salud: () => get<Salud>("/health"),

  puntos: () => get<Punto[]>("/red/puntos"),
  mapa: () => get<Mapa>("/red/mapa"),
  ciudadesAisladas: (punto: string, destino?: string) => get<CiudadesAisladas>(`/red/ciudades-aisladas${consulta({ punto, destino })}`),

  ruta: (p: { origen: string; destino: string; criterio: Criterio; evitarTerraceria: boolean; tiempoMaxMin?: number | null }) =>
    get<Ruta>(`/rutas${consulta(p)}`),
  exploracion: (p: { origen: string; destino: string; criterio: Criterio; evitarTerraceria: boolean; tiempoMaxMin?: number | null; algoritmo: Algoritmo }) =>
    get<Exploracion>(`/rutas/exploracion${consulta(p)}`),
  camionTren: (p: { origen: string; destino: string; pesoKg: number }) => get<ComparacionCamionTren>(`/rutas/camion-tren${consulta(p)}`),

  incidentes: (f: { activo?: boolean; gravedad?: string; tipo?: string; sincronizado?: boolean } = {}) =>
    get<Incidente[]>(`/incidentes${consulta(f)}`),
  incidente: (id: string) => get<Incidente>(`/incidentes/${encodeURIComponent(id)}`),
  reportarIncidente: async (cuerpo: unknown): Promise<EscrituraIncidente> => {
    const r = await pedir<{ incidente: Incidente; aviso?: string }>("POST", "/incidentes", cuerpo);
    return { ...r.datos, status: r.status };
  },
  cerrarIncidente: async (id: string, cuerpo: { motivoCierre?: string }): Promise<EscrituraIncidente> => {
    const r = await pedir<{ incidente: Incidente; aviso?: string }>("PATCH", `/incidentes/${encodeURIComponent(id)}/cerrar`, cuerpo);
    return { ...r.datos, status: r.status };
  },
  agregarEvidencia: async (id: string, cuerpo: { tipo: "Foto" | "Testimonio"; url?: string; texto?: string; autor?: string }) =>
    (await pedir<Incidente>("POST", `/incidentes/${encodeURIComponent(id)}/evidencias`, cuerpo)).datos,
  enviosAfectados: (id: string) => get<EnviosAfectados>(`/incidentes/${encodeURIComponent(id)}/envios-afectados`),

  moverVehiculo: async (placa: string, idPunto: string) => (await pedir<unknown>("PATCH", `/vehiculos/${encodeURIComponent(placa)}/ubicacion`, { idPunto })).datos,

  reconciliar: async () => (await pedir<Reconciliacion>("POST", "/admin/reconciliar")).datos,

  login: async (correo: string, password: string) => (await pedir<{ token: string }>("POST", "/auth/login", { correo, password })).datos,

  clientes: () => get<Cliente[]>("/clientes"),
  ciudades: () => get<Ciudad[]>("/ciudades"),
  vehiculos: () => get<Vehiculo[]>("/vehiculos"),

  envios: (estado?: EstadoEnvio) => get<Envio[]>(`/envios${consulta({ estado })}`),
  envio: (id: string) => get<Envio>(`/envios/${encodeURIComponent(id)}`),
  registrarEnvio: async (cuerpo: NuevoEnvio) => (await pedir<Envio>("POST", "/envios", cuerpo)).datos,
  manifiesto: (id: string) => get<Manifiesto>(`/envios/${encodeURIComponent(id)}/manifiesto`),
  guardarManifiesto: async (id: string, cuerpo: Record<string, unknown>) => (await pedir<Manifiesto>("POST", `/envios/${encodeURIComponent(id)}/manifiesto`, cuerpo)).datos,
  bitacora: (id: string) => get<Bitacora>(`/envios/${encodeURIComponent(id)}/bitacora`),
  rutaEnvio: (id: string, criterio: Criterio) => get<RutaEnvio>(`/envios/${encodeURIComponent(id)}/ruta${consulta({ criterio })}`),
  asignar: async (id: string, placa: string) => (await pedir<unknown>("POST", `/envios/${encodeURIComponent(id)}/asignacion`, { placa })).datos,
  // Salida, entrega o cancelación: cambian el estado y regresan el envío actualizado
  cambiarEstado: async (id: string, accion: "salida" | "entrega" | "cancelacion") =>
    (await pedir<Envio>("POST", `/envios/${encodeURIComponent(id)}/${accion}`)).datos,
};

// ---------- Formato ----------

export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")} min`;
}

export const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
export const km = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`;
export const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
