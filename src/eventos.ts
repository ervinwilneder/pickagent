/**
 * Eventos del server (extensión MCP Events, borrador SEP-3415): lo que pasa en
 * la cuenta de belo, para que un agente o una app reaccionen sin preguntar.
 *
 * belo no emite eventos: el vigía relee el historial cada tanto y emite un
 * `movimiento.nuevo` por cada movimiento que no había visto.
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
  return {
    id: t.id,
    tipo: t.type,
    estado: t.status,
    monto: t.amount ?? "",
    moneda: (t.currency ?? "") === "ARGt" ? "ARS" : (t.currency ?? ""),
    contraparte: t.receipt?.counterparty?.name ?? null,
    fecha: t.createdAt,
  };
}

export const eventos = {
  "movimiento.nuevo": defineEvent({
    description: "Un movimiento nuevo en la cuenta de belo: un depósito recibido, una transferencia, una conversión o un pago por pix. Filtrable por tipo.",
    inputSchema: z.object({ tipo: tipoMovimiento.optional().describe("Solo movimientos de este tipo") }),
    payloadSchema: movimiento,
    match: (args, data) => !args.tipo || data.tipo === args.tipo,
  }),
};

/** Relee el historial y emite lo nuevo. Devuelve cómo pararlo. */
export function vigilar(cuenta: BeloPort, emitir: (nombre: string, data: Movimiento, opciones: { eventId: string; timestamp: string }) => Promise<unknown>, cadaMs = 5_000): () => void {
  const vistos = new Set<string>();
  let primera = true;
  const tick = async () => {
    try {
      const { data } = await cuenta.transacciones({ limit: 20 });
      for (const t of data.reverse()) {
        if (vistos.has(t.id)) continue;
        vistos.add(t.id);
        if (primera) continue; // la primera pasada solo aprende lo que ya existía
        await emitir("movimiento.nuevo", resumir(t), { eventId: t.id, timestamp: t.createdAt });
      }
      primera = false;
    } catch (e) {
      console.error("vigía belo:", e instanceof Error ? e.message : e);
    }
  };
  void tick();
  const timer = setInterval(tick, cadaMs);
  return () => clearInterval(timer);
}
