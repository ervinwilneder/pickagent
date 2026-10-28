/**
 * El agente de belo: conectado al server MCP de belo por MCPClient (tools y
 * vistas), suscripto a sus eventos por señales, con memoria persistente.
 */
import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { MCPClient, MCPEventsSignalProvider } from "@mastra/mcp";
import { Memory } from "@mastra/memory";
import { instrucciones } from "./instrucciones.ts";

/** El server MCP de belo. Sin default de producción: sale de la configuración. */
const servidor = process.env.BELO_MCP_URL;
if (!servidor) throw new Error("Configurá BELO_MCP_URL (por ejemplo http://localhost:3001/mcp)");

export const storage = new LibSQLStore({ id: "belo-agente", url: process.env.BELO_AGENTE_DB ?? "file:./belo-agente.db" });

export const belo = new MCPClient({
  id: "belo",
  servers: { belo: { url: new URL(servidor) } },
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
  id: "belo",
  name: "belo",
  description: "Acompaña a la persona con su cuenta de belo y reacciona a los movimientos de la cuenta.",
  instructions: instrucciones,
  model: process.env.BELO_AGENTE_MODELO ?? "anthropic/claude-sonnet-5-5",
  tools: await belo.listTools(),
  memory: new Memory({ storage }),
  signals: [eventos],
});

/** El hilo principal de la persona: es el que recibe los eventos. */
export const hiloPrincipal = { resourceId: process.env.BELO_AGENTE_PERSONA ?? "ervin", threadId: "principal" };
