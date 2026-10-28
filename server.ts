/**
 * Server MCP de la app de belo: tools (con vista para los hosts que renderizan
 * MCP Apps), el recurso HTML de cada vista y los eventos de la cuenta.
 */
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { belo, type BeloPort } from "./src/belo/index.ts";
import { BeloError } from "./src/belo/port.ts";
import { eventos, resumir, vigilar } from "./src/eventos.ts";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const CUENTA_UI = "ui://belo/cuenta.html";

/** Un error de belo se cuenta en términos del producto, nunca con su código. */
function explicar(e: unknown): never {
  throw new Error(e instanceof BeloError ? e.message : "No se pudo hablar con belo.");
}

export function crearServer(cuenta: BeloPort = belo()) {
  const tools = {
    cuenta: createTool({
      id: "cuenta",
      description: "Muestra los saldos de la cuenta de belo con su rendimiento y los últimos movimientos, en una vista interactiva.",
      inputSchema: z.object({
        movimientos: z.number().int().min(1).max(50).default(10).describe("Cuántos movimientos recientes incluir"),
      }),
      outputSchema: z.object({ resumen: z.string(), saldos: z.array(z.any()), movimientos: z.array(z.any()) }),
      mcp: { _meta: { ui: { resourceUri: CUENTA_UI } } },
      execute: async ({ movimientos }) => {
        try {
          const [saldos, ultimos] = await Promise.all([cuenta.saldos(), cuenta.transacciones({ limit: movimientos })]);
          const conPlata = saldos.filter((s) => Number(s.available) > 0);
          const resumen = `Saldos: ${conPlata.map((s) => `${s.currencyCode === "ARGt" ? "ARS" : s.currencyCode} ${s.available}${s.yield ? ` (rinde ${s.yield.totalYield ?? s.yield.rate} anual)` : ""}`).join(", ") || "sin fondos"}. Últimos ${ultimos.data.length} movimientos de ${ultimos.pagination.total ?? ultimos.data.length}.`;
          return { resumen, saldos, movimientos: ultimos.data };
        } catch (e) {
          return explicar(e);
        }
      },
    }),

    // Solo para la demo con la cuenta falsa: provoca un depósito y dispara el evento.
    simular_deposito: createTool({
      id: "simular_deposito",
      description: "Simula que entra un depósito en pesos a la cuenta (solo en la cuenta de demo).",
      inputSchema: z.object({
        monto: z.string().regex(/^\d+(\.\d+)?$/).describe("Monto en pesos, como string decimal"),
        de: z.string().min(1).default("Lucía Ferrer").describe("Quién lo manda"),
      }),
      outputSchema: z.object({ movimiento: z.any() }),
      mcp: { _meta: { ui: { visibility: ["app", "model"] } } },
      execute: async ({ monto, de }) => {
        if (!cuenta.simulacion) throw new Error("Esta cuenta es real: no se simulan depósitos.");
        return { movimiento: resumir(await cuenta.simulacion.deposito(monto, de)) };
      },
    }),
  };

  const server = new MCPServer({
    id: "belo",
    name: "belo",
    version: "0.0.0",
    description: "La cuenta de belo dentro del chat: saldos, movimientos y eventos de la cuenta.",
    // Claude Desktop y claude.ai pueden abrir con `initialize` (protocolo 2025):
    // se los atiende sin sesión. Los eventos requieren el protocolo 2026-07-28.
    legacy: "stateless",
    tools,
    appResources: {
      [CUENTA_UI]: { name: "Mi cuenta en belo", description: "Saldos y últimos movimientos", htmlPath: path.join(DIST, "cuenta.html") },
    },
    events: eventos,
  });

  const parar = vigilar(cuenta, (nombre, data, opciones) => server.events.emit(nombre, data, opciones));
  return { server, parar };
}
