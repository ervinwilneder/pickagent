/**
 * Eventos del server (extensión MCP Events, borrador SEP-3415): lo que pasa en
 * la cuenta de belo, para que un agente reaccione sin preguntar.
 *
 * belo no emite eventos y el server corre sin estado (Vercel), así que el
 * evento es de tipo poll: el cliente trae un cursor (la fecha del último
 * movimiento que vio) y el server lee belo desde ahí.
 */
import { defineEvent } from "@mastra/mcp";
import { z } from "zod";
import type { BeloPort, Transaccion } from "./belo/port.ts";

export const tipoMovimiento = z.enum(["deposit", "withdrawal", "swap", "transfer", "pix_payout"]);

export const movimiento = z.object({
  id: z.string(),
  tipo: tipoMovimiento,
  estado: z.string(),
  monto: z.string(),
  moneda: z.string(),
  contraparte: z.string().nullable(),
  fecha: z.string(),
});
export type Movimiento = z.infer<typeof movimiento>;

export function resumir(t: Transaccion): Movimiento {
  const moneda = t.currency ?? "";
  return {
    id: t.id,
    tipo: t.type,
    estado: t.status,
    monto: t.amount ?? "",
    moneda: moneda === "ARGt" ? "ARS" : moneda,
    contraparte: t.receipt?.counterparty?.name ?? null,
    fecha: t.createdAt,
  };
}

export function eventos(cuenta: BeloPort) {
  return {
    "movimiento.nuevo": defineEvent({
      description: "Un movimiento nuevo en la cuenta de belo: un depósito recibido, una transferencia, una conversión o un pago por pix. Filtrable por tipo.",
      inputSchema: z.object({ tipo: tipoMovimiento.optional().describe("Solo movimientos de este tipo") }),
      payloadSchema: movimiento,
      match: (args, data) => !args.tipo || data.tipo === args.tipo,
      pollIntervalMs: 5_000,
      async poll({ arguments: args, cursor, maxEvents }) {
        // Sin cursor: "desde ahora". No se reproduce historia vieja.
        if (!cursor) return { events: [], cursor: new Date().toISOString(), nextPollMs: 5_000 };
        const { data } = await cuenta.transacciones({ from: cursor, type: args.tipo, limit: Math.min(maxEvents, 100) });
        const nuevos = data.filter((t) => t.createdAt > cursor).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          events: nuevos.map((t) => ({ eventId: t.id, timestamp: t.createdAt, data: resumir(t) })),
          cursor: nuevos.at(-1)?.createdAt ?? cursor,
          nextPollMs: 5_000,
        };
      },
    }),
  };
}
