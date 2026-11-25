import { api } from "./api";

// Sesión del usuario: el token JWT que regresa POST /auth/login. Se guarda en el navegador para
// no pedir la contraseña en cada recarga; api.ts lo lee y lo manda en cada petición.
export type Usuario = { correo: string; rol: "despachador" | "administrador" };

const CLAVE = "hopwright.token";

function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

// El token es header.payload.firma; el payload trae el correo, el rol y cuándo vence
function usuarioDe(token: string | null): Usuario | null {
  if (!token) return null;
  try {
    const datos = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (datos.exp && datos.exp * 1000 < Date.now()) return null;
    return { correo: datos.correo, rol: datos.rol };
  } catch {
    return null;
  }
}

export const sesion = $state<{ usuario: Usuario | null }>({ usuario: null });

export function cargarSesion() {
  sesion.usuario = usuarioDe(leerToken());
  if (!sesion.usuario) cerrarSesion();
}

export async function iniciarSesion(correo: string, password: string) {
  const { token } = await api.login(correo, password);
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // Sin almacenamiento (ventana privada estricta): la sesión dura lo que dure la página
  }
  sesion.usuario = usuarioDe(token);
}

export function cerrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
  sesion.usuario = null;
}

export const nombreRol = { despachador: "Despachador", administrador: "Administrador" } as const;
