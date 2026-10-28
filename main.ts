/** Arranque local: Streamable HTTP en PORT (3001 por defecto) o stdio con --stdio. */
import http from "node:http";
import { crearServer } from "./server.ts";

const { server } = crearServer();

if (process.argv.includes("--stdio")) {
  await server.startStdio();
} else {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
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
