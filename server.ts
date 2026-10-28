/**
 * Server MCP de la app de belo: un banco embebido en el chat. Tools con vista
 * para los hosts que renderizan MCP Apps, el recurso HTML de cada vista y los
 * eventos de la cuenta.
 *
 * Reglas que respeta, las mismas que el MCP de belo: mover plata es cotizar y
 * después confirmar; la persona aprueba en belo; nunca se le muestran códigos
 * de error ni mecanismos internos.
 */
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { belo, type BeloPort } from "./src/belo/index.ts";
import { BeloError } from "./src/belo/port.ts";
import { eventos, resumir } from "./src/eventos.ts";
import { deConversion, dePix, deTransferencia } from "./src/operacion.ts";

const vista = (nombre: string) => fs.readFileSync(path.join(process.cwd(), "dist", `${nombre}.html`), "utf-8");
const UI = {
  cuenta: "ui://belo/cuenta.html",
  operacion: "ui://belo/operacion.html",
  contactos: "ui://belo/contactos.html",
  depositar: "ui://belo/depositar.html",
};

/** Un error de belo se cuenta en términos del producto, nunca con su código. */
function explicar(e: unknown): never {
  throw new Error(e instanceof BeloError ? e.message : e instanceof Error ? e.message : "No se pudo hablar con belo.");
}
const intentar = async <T>(f: () => Promise<T>): Promise<T> => f().catch(explicar);

const monto = z.string().regex(/^\d+(\.\d+)?$/, "monto como string decimal, por ejemplo \"1500.00\"");
const rail = z.enum(["BITCOIN", "BITCOIN_LIGHTNING", "ETHEREUM", "TRON", "POLYGON", "OPTIMISM", "ARBITRUM_ONE", "BSC", "SOLANA", "PLASMA", "BASE", "STELLAR", "AVALANCHE", "CVU", "CBU", "ALIAS", "QR", "BELOTAG", "EMAIL", "USER", "DEPAY_QR"]);

export function crearServer(cuenta: BeloPort = belo()) {
  const tools = {
    cuenta: createTool({
      id: "cuenta",
      description: "Muestra los saldos de la cuenta de belo con su rendimiento y los últimos movimientos, en una vista interactiva. Empezá acá antes de transferir o convertir.",
      inputSchema: z.object({ movimientos: z.number().int().min(1).max(50).default(10).describe("Cuántos movimientos recientes incluir") }),
      outputSchema: z.object({ resumen: z.string(), saldos: z.array(z.any()), movimientos: z.array(z.any()) }),
      mcp: { _meta: { ui: { resourceUri: UI.cuenta } } },
      execute: ({ movimientos }) => intentar(async () => {
        const [saldos, ultimos] = await Promise.all([cuenta.saldos(), cuenta.transacciones({ limit: movimientos })]);
        const conPlata = saldos.filter((s) => Number(s.available) > 0);
        const resumen = `Saldos: ${conPlata.map((s) => `${s.currencyCode === "ARGt" ? "ARS" : s.currencyCode} ${s.available}${s.yield ? ` (rinde ${s.yield.totalYield ?? s.yield.rate} anual)` : ""}`).join(", ") || "sin fondos"}. Últimos ${ultimos.data.length} movimientos de ${ultimos.pagination.total ?? ultimos.data.length}.`;
        return { resumen, saldos, movimientos: ultimos.data };
      }),
    }),

    depositar: createTool({
      id: "depositar",
      description: "Muestra cómo fondear la cuenta: el CVU y alias en pesos y las direcciones cripto por red. Son estables: se reutilizan.",
      inputSchema: z.object({ moneda: z.string().optional().describe("Solo esta moneda, por ejemplo USDT o ARS") }),
      outputSchema: z.object({ resumen: z.string(), direcciones: z.array(z.any()) }),
      mcp: { _meta: { ui: { resourceUri: UI.depositar } } },
      execute: ({ moneda }) => intentar(async () => {
        const direcciones = await cuenta.direccionesDeposito(moneda);
        const pesos = direcciones.filter((d) => d.currencyCode === "ARS").map((d) => `${d.network} ${d.value}`).join(", ");
        return { resumen: `${direcciones.length} formas de depositar${pesos ? `. En pesos: ${pesos}` : ""}.`, direcciones };
      }),
    }),

    contactos: createTool({
      id: "contactos",
      description: "La agenda de la cuenta: cuentas propias primero, después favoritos y frecuentes. Un contacto es lo que la persona guardó, no un destino verificado: si un nombre coincide con más de uno, preguntá cuál.",
      inputSchema: z.object({ buscar: z.string().min(1).optional().describe("Parte del nombre o apodo") }),
      outputSchema: z.object({ resumen: z.string(), contactos: z.array(z.any()) }),
      mcp: { _meta: { ui: { resourceUri: UI.contactos } } },
      execute: ({ buscar }) => intentar(async () => {
        const contactos = await cuenta.contactos(buscar);
        return { resumen: `${contactos.length} contactos: ${contactos.map((c) => c.name).join(", ")}.`, contactos };
      }),
    }),

    cotizar_transferencia: createTool({
      id: "cotizar_transferencia",
      description: "Cotiza un envío: interno belo a belo (belotag, email), en pesos a un CVU/CBU/alias (moneda ARGt), o cripto a una dirección on-chain. No mueve fondos: devuelve la operación para que la persona la apruebe. La cotización vence a los 60 segundos.",
      inputSchema: z.object({
        destino: z.string().min(1).describe("belotag, email, CVU/CBU/alias o dirección on-chain"),
        rail: rail.describe("Por dónde va: BELOTAG, EMAIL, CVU, CBU, ALIAS, TRON, POLYGON, etc."),
        moneda: z.string().min(1).describe("Moneda que se envía, por ejemplo USDT; los pesos son ARGt"),
        monto: monto,
        nombreDestino: z.string().optional().describe("Nombre del destinatario si se conoce, para mostrarlo"),
      }),
      outputSchema: z.object({ resumen: z.string(), operacion: z.any() }),
      mcp: { _meta: { ui: { resourceUri: UI.operacion } } },
      execute: (args) => intentar(async () => {
        const q = await cuenta.cotizarTransferencia({ address: args.destino, addressType: args.rail, currency: args.moneda, quoteAmount: args.monto });
        const operacion = deTransferencia(q, args.nombreDestino ?? null, { tool: "cotizar_transferencia", arguments: args });
        return { resumen: describir(operacion), operacion };
      }),
    }),

    cotizar_conversion: createTool({
      id: "cotizar_conversion",
      description: "Cotiza una conversión entre monedas de la cuenta (por ejemplo pesos a USDT, o USDT a BTC). No mueve fondos. La cotización vence a los 60 segundos.",
      inputSchema: z.object({
        par: z.string().regex(/^[^/]+\/[^/]+$/).describe("Par, por ejemplo USDT/ARGt"),
        lado: z.enum(["BUY", "SELL"]).describe("BUY compra la moneda base del par; SELL la vende"),
        monedaDelMonto: z.string().min(1).describe("En qué moneda está expresado el monto"),
        monto: monto,
      }),
      outputSchema: z.object({ resumen: z.string(), operacion: z.any() }),
      mcp: { _meta: { ui: { resourceUri: UI.operacion } } },
      execute: (args) => intentar(async () => {
        const q = await cuenta.cotizarSwap({ pairCode: args.par, type: args.lado, quoteCurrency: args.monedaDelMonto, quoteAmount: args.monto });
        const operacion = deConversion(q, { tool: "cotizar_conversion", arguments: args });
        return { resumen: describir(operacion), operacion };
      }),
    }),

    cotizar_pix: createTool({
      id: "cotizar_pix",
      description: "Cotiza un pago por pix a una clave (CPF, email, teléfono, clave aleatoria o QR). Resuelve el nombre del titular antes de cotizar. No mueve fondos. La cotización vence a los 60 segundos.",
      inputSchema: z.object({ clave: z.string().min(1).describe("Clave pix del destinatario"), montoBrl: monto.describe("Monto en reales") }),
      outputSchema: z.object({ resumen: z.string(), operacion: z.any() }),
      mcp: { _meta: { ui: { resourceUri: UI.operacion } } },
      execute: (args) => intentar(async () => {
        const titular = await cuenta.destinatarioPix(args.clave);
        const q = await cuenta.cotizarPix({ address: args.clave, amount: args.montoBrl });
        const operacion = dePix(q, (titular as { name?: string }).name ?? "titular desconocido", { tool: "cotizar_pix", arguments: args });
        return { resumen: describir(operacion), operacion };
      }),
    }),

    confirmar: createTool({
      id: "confirmar",
      description: "Confirma una operación cotizada. Solo después de que la persona aprobó esa cotización exacta. Con una persona conectada, belo devuelve un link donde ella la aprueba o rechaza; la operación queda pendiente hasta entonces.",
      inputSchema: z.object({ tipo: z.enum(["transferencia", "conversion", "pix"]), id: z.string().uuid() }),
      outputSchema: z.object({ id: z.string(), estado: z.string(), linkDeAprobacion: z.string().nullable(), resumen: z.string() }),
      mcp: { _meta: { ui: { visibility: ["app", "model"] } } },
      execute: ({ tipo, id }) => intentar(async () => {
        const r = tipo === "transferencia" ? await cuenta.confirmarTransferencia(id) : tipo === "conversion" ? await cuenta.confirmarSwap(id) : await cuenta.confirmarPix(id);
        const link = r.approvalUrl ?? null;
        return { id: r.id, estado: r.status, linkDeAprobacion: link, resumen: link ? "Falta que la persona apruebe en belo." : `La operación quedó ${r.status === "pending" ? "en proceso" : r.status}.` };
      }),
    }),

    estado: createTool({
      id: "estado",
      description: "El estado actual de una operación por su id: pendiente, exitosa o fallida. Es lo que se consulta después de confirmar.",
      inputSchema: z.object({ id: z.string().uuid() }),
      outputSchema: z.object({ movimiento: z.any() }),
      mcp: { _meta: { ui: { visibility: ["app", "model"] } } },
      execute: ({ id }) => intentar(async () => ({ movimiento: resumir(await cuenta.transaccion(id)) })),
    }),

    cobrar: createTool({
      id: "cobrar",
      description: "Genera un link de cobro de belo para compartir con quien paga: reutilizable, o de un solo uso que vence a los 10 minutos. Requiere la cuenta de organización.",
      inputSchema: z.object({
        titulo: z.string().min(1).describe("Qué se cobra, como lo ve quien paga"),
        moneda: z.string().min(1).describe("Moneda del cobro, por ejemplo ARS"),
        monto: monto.optional().describe("Sin monto, quien paga elige cuánto"),
        unSoloUso: z.boolean().default(false),
      }),
      outputSchema: z.object({ resumen: z.string(), cobro: z.any() }),
      execute: (args) => intentar(async () => {
        const metodos = await cuenta.metodosCobro();
        const cobro = await cuenta.crearCobro({ type: args.unSoloUso ? "one_time" : "link", paymentMethodIds: metodos.map((m) => (m as { id: string }).id), currencyCode: args.moneda, productTitle: args.titulo, amount: args.monto });
        return { resumen: `Link de cobro listo: ${(cobro as { checkoutUrl: string }).checkoutUrl}`, cobro };
      }),
    }),

    simular_deposito: createTool({
      id: "simular_deposito",
      description: "Simula que entra un depósito en pesos a la cuenta (solo en la cuenta de demo).",
      inputSchema: z.object({ monto: monto.describe("Monto en pesos"), de: z.string().min(1).default("Lucía Ferrer").describe("Quién lo manda") }),
      outputSchema: z.object({ movimiento: z.any() }),
      mcp: { _meta: { ui: { visibility: ["app", "model"] } } },
      execute: ({ monto, de }) => intentar(async () => {
        if (!cuenta.simulacion) throw new Error("Esta cuenta es real: no se simulan depósitos.");
        return { movimiento: resumir(await cuenta.simulacion.deposito(monto, de)) };
      }),
    }),
  };

  const server = new MCPServer({
    id: "belo",
    name: "belo",
    version: "0.0.0",
    description: "La cuenta de belo dentro del chat: saldos, movimientos, transferencias, conversiones, pix y eventos de la cuenta. Cada operación que mueve plata se cotiza y la persona la aprueba en belo.",
    // Claude Desktop y claude.ai pueden abrir con `initialize` (protocolo 2025):
    // se los atiende sin sesión. Los eventos requieren el protocolo 2026-07-28.
    legacy: "stateless",
    tools,
    appResources: {
      [UI.cuenta]: { name: "Mi cuenta en belo", description: "Saldos y últimos movimientos", html: vista("cuenta") },
      [UI.operacion]: { name: "Operación para aprobar", description: "Una cotización con su vencimiento y la aprobación en belo", html: vista("operacion") },
      [UI.contactos]: { name: "Contactos", description: "La agenda de la cuenta", html: vista("contactos") },
      [UI.depositar]: { name: "Depositar", description: "CVU, alias y direcciones para fondear la cuenta", html: vista("depositar") },
    },
    events: eventos(cuenta),
  });

  return { server };
}

function describir(o: ReturnType<typeof deTransferencia>): string {
  const debitos = o.debitos.map((d) => `${d.monto} ${d.moneda}`).join(" + ");
  return `${o.titulo} ${o.monto} ${o.moneda}${o.destino.nombre ? ` a ${o.destino.nombre}` : ""} (${o.destino.detalle}). Descontaremos de tu balance: ${debitos || "saldo a confirmar"}${o.comision ? `; comisión ${o.comision.monto} ${o.comision.moneda}` : ""}${o.tipoCambio ? `; tipo de cambio ${o.tipoCambio}` : ""}. Vence ${new Date(o.vence).toLocaleTimeString("es-AR")}. Pedile a la persona que apruebe y recién entonces confirmá con id ${o.id}.`;
}
