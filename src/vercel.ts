/** Función de Vercel: el mismo server, un pedido por invocación. */
import type { IncomingMessage, ServerResponse } from "node:http";
import { crearServer } from "../server.ts";

const { server } = crearServer();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  await server.startHTTP({ url, httpPath: url.pathname, req, res });
}
