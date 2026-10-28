/**
 * Cliente de ejemplo: se suscribe a los eventos del server y los imprime.
 * Uso: npx tsx escucha.ts [url del server]
 */
import { MCPClient } from "@mastra/mcp";

const url = new URL(process.argv[2] ?? "http://localhost:3001/mcp");
const mcp = new MCPClient({ id: "escucha", servers: { belo: { url } } });

console.log("eventos disponibles:", (await mcp.events.list("belo")).map((e) => e.name));
console.log("escuchando movimiento.nuevo…");
const sub = await mcp.events.subscribe("belo", "movimiento.nuevo", {}, { delivery: "push" });
for await (const evento of sub) {
  const m = evento.data as { tipo: string; monto: string; moneda: string; contraparte: string | null };
  console.log(`[${evento.timestamp}] ${m.tipo} ${m.monto} ${m.moneda}${m.contraparte ? ` · ${m.contraparte}` : ""}`);
}
