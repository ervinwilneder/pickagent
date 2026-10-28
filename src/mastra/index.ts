import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { asistente, asistenteSinBelo, conBelo, eventosAsistente, hiloAsistente } from "./asistente.ts";
import { agente as pickagent, belo, eventos, hiloPrincipal, pickagentMcp, storage } from "./pickagent.ts";

export const mastra = new Mastra({
  agents: { pickagent, asistente, "asistente-sin-belo": asistenteSinBelo },
  // Los proxies de los servers de belo y logística (para que Studio resuelva las vistas) y pickagent como MCP.
  mcpServers: { ...belo.toMCPServerProxies(), ...conBelo.toMCPServerProxies(), pickagent: pickagentMcp },
  storage,
  logger: new PinoLogger({ name: "pickagent", level: "info" }),
});

// Al arrancar, los hilos quedan suscriptos a los movimientos de la cuenta de belo.
eventos
  .subscribeThread(hiloPrincipal, { server: "belo", event: "movimiento.nuevo" })
  .then(() => console.log(`pickagent: hilo "${hiloPrincipal.threadId}" escuchando movimiento.nuevo`))
  .catch((e: unknown) => console.error("pickagent: no pude suscribir el hilo:", e instanceof Error ? e.message : e));
eventosAsistente
  .subscribeThread(hiloAsistente, { server: "belo", event: "movimiento.nuevo" })
  .then(() => console.log(`asistente: hilo "${hiloAsistente.threadId}" escuchando movimiento.nuevo`))
  .catch((e: unknown) => console.error("asistente: no pude suscribir el hilo:", e instanceof Error ? e.message : e));
