import { env } from "./config/env.js";
import { construirApp } from "./server.js";

const app = await construirApp();

// Cierra las conexiones a las tres bases al detener el servidor (Ctrl+C)
for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: env.port, host: env.host });
app.log.info(`Documentación de la API en http://localhost:${env.port}/docs`);
