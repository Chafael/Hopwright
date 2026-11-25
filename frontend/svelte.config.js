import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// La interfaz es una aplicación estática que solo consume la API: no hay render en servidor.
// fallback: index.html hace que cualquier ruta (/incidentes/INC-0001, por ejemplo) cargue la app.
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: "index.html" }),
  },
};
