/**
 * El agente de belo: conectado al server MCP de belo por MCPClient (tools y
 * vistas), suscripto a sus eventos por señales, con memoria persistente.
 */
import { Agent } from "@mastra/core/agent";

/** La fecha y hora actuales en Argentina, para resolver "el lunes a las 18" sin adivinar. */
const ahora = () => `Hoy es ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} (hora de Argentina, UTC-3). Cuando la persona dice un día relativo, calculá la fecha a partir de hoy y usá la zona -03:00.`;
import { LibSQLStore } from "@mastra/libsql";
import { MCPClient, MCPEventsSignalProvider, MCPServer } from "@mastra/mcp";
import { Memory } from "@mastra/memory";
import { instrucciones } from "./instrucciones.ts";

/** Los dos servers MCP de pickagent. Sin defaults de producción: salen de la configuración. */
const servidorBelo = process.env.BELO_MCP_URL;
const servidorLogistica = process.env.LOGISTICA_MCP_URL;
if (!servidorBelo) throw new Error("Configurá BELO_MCP_URL (por ejemplo http://localhost:3001/mcp)");
if (!servidorLogistica) throw new Error("Configurá LOGISTICA_MCP_URL (por ejemplo http://localhost:3002/mcp)");

export const storage = new LibSQLStore({ id: "belo-agente", url: process.env.BELO_AGENTE_DB ?? "file:./belo-agente.db" });

export const belo = new MCPClient({
  id: "pickagent",
  servers: { logistica: { url: new URL(servidorLogistica) }, belo: { url: new URL(servidorBelo) } },
});

/** Los eventos del server llegan al hilo del agente como notificaciones de prioridad alta: arrancan un turno si el hilo está inactivo. */
export const eventos = new MCPEventsSignalProvider({
  id: "belo-eventos",
  name: "Eventos de belo",
  client: belo,
  subscribeOptions: { delivery: "poll" },
  priority: "high",
  coalesce: false,
  onError: (error: unknown, info: { server: string; event: string }) => console.error(`eventos de belo (${info.server}/${info.event}):`, error instanceof Error ? error.message : error),
});

export const agente = new Agent({
  id: "pickagent",
  name: "pickagent",
  description: "Resuelve envíos de mercadería con los proveedores de logística agregados y cobra por belo; reacciona a los movimientos de la cuenta.",
  instructions: () => `${instrucciones}\n\n${ahora()}`,
  model: process.env.BELO_AGENTE_MODELO ?? "anthropic/claude-sonnet-5-5",
  tools: await belo.listTools(),
  memory: new Memory({ storage }),
  signals: [eventos],
});

/** El hilo principal de la persona: es el que recibe los eventos. */
export const hiloPrincipal = { resourceId: process.env.BELO_AGENTE_PERSONA ?? "ervin", threadId: "principal" };

/** pickagent expuesto como MCP: cualquier host o agente le pregunta por la tool ask_pickagent. */
export const pickagentMcp = new MCPServer({
  id: "pickagent",
  name: "pickagent",
  version: "0.0.0",
  description: "El agente de envíos de pickagent: le contás qué mandar y a dónde, y planifica, cotiza con los transportistas agregados y cobra por belo.",
  legacy: "stateless",
  tools: {},
  agents: { pickagent: agente },
});
