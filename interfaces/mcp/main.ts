/** Arranque local: Streamable HTTP en PORT (3001 por defecto) o stdio con --stdio. */
import http from "node:http";
import { crearServer } from "./server.ts";

import { belo } from "./src/belo/index.ts";

const cuenta = belo();
const { server } = crearServer(cuenta);

/** Con BELO_LOG=1 imprime método y tool de cada pedido, para diagnosticar. */
function registrar(req: http.IncomingMessage) {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    try {
      const j = JSON.parse(cuerpo) as { method?: string; params?: { name?: string } };
      console.log(new Date().toISOString(), req.method, j.method ?? "?", j.params?.name ?? "");
    } catch {
      console.log(new Date().toISOString(), req.method, "(sin json)");
    }
  });
}

if (process.argv.includes("--stdio")) {
  await server.startStdio();
} else {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    // Solo la cuenta falsa: otro server falso le avisa que le transfirieron (un depósito entra al historial).
    if (url.pathname === "/interno/deposito" && req.method === "POST" && cuenta.simulacion) {
      let cuerpo = "";
      req.on("data", (c) => (cuerpo += c));
      req.on("end", async () => {
        try {
          const { monto, de } = JSON.parse(cuerpo) as { monto: string; de: string };
          await cuenta.simulacion!.deposito(String(monto), String(de));
          res.writeHead(204).end();
        } catch {
          res.writeHead(400).end();
        }
      });
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    // La pantalla del agente (otro origen en el navegador) habla con este server directo.
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (process.env.BELO_LOG) registrar(req);
    await server.startHTTP({ url, httpPath: "/mcp", req, res });
  });
  httpServer.listen(port, () => console.log(`belo MCP App en http://localhost:${port}/mcp`));
  const apagar = async () => {
    await server.close();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", apagar);
  process.on("SIGTERM", apagar);
}
