import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { agente, belo, eventos, hiloPrincipal, storage } from "./belo.ts";

export const mastra = new Mastra({
  agents: { belo: agente },
  // Los proxies del server de belo: así Studio resuelve los recursos ui:// de sus vistas.
  mcpServers: belo.toMCPServerProxies(),
  storage,
  logger: new PinoLogger({ name: "belo-agente", level: "info" }),
});

// Al arrancar, el hilo principal queda suscripto a los movimientos de la cuenta.
eventos
  .subscribeThread(hiloPrincipal, { server: "belo", event: "movimiento.nuevo" })
  .then(() => console.log(`belo-agente: hilo "${hiloPrincipal.threadId}" escuchando movimiento.nuevo`))
  .catch((e: unknown) => console.error("belo-agente: no pude suscribir el hilo:", e instanceof Error ? e.message : e));
