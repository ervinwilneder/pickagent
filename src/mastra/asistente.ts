/**
 * El asistente personal de la persona: su propio agente, que usa a pickagent
 * como un servicio. Hay dos versiones para mostrar la diferencia: con el MCP
 * de belo de la persona conectado, y sin él.
 */
import { Agent } from "@mastra/core/agent";

/** La fecha y hora actuales en Argentina, para resolver "el lunes a las 18" sin adivinar. */
const ahora = () => `Hoy es ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} (hora de Argentina, UTC-3). Cuando la persona dice un día relativo, calculá la fecha a partir de hoy y usá la zona -03:00.`;
import { createTool } from "@mastra/core/tools";
import { MCPClient, MCPEventsSignalProvider } from "@mastra/mcp";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { agente as pickagent, storage } from "./pickagent.ts";

const servidorBelo = process.env.BELO_MCP_URL!;
const servidorLogistica = process.env.LOGISTICA_MCP_URL!;

/** La persona con belo conectado: el motor de envíos y su cuenta de belo. */
export const conBelo = new MCPClient({ id: "asistente-con-belo", servers: { logistica: { url: new URL(servidorLogistica) }, belo: { url: new URL(servidorBelo) } } });
/** La misma persona sin belo: solo el motor de envíos. */
export const sinBelo = new MCPClient({ id: "asistente-sin-belo", servers: { logistica: { url: new URL(servidorLogistica) } } });

/** Preguntarle a pickagent: el agente de la empresa planifica y recomienda. */
const preguntarAPickagent = createTool({
  id: "preguntar_a_pickagent",
  description: "Le pregunta a pickagent, el agente de envíos, algo que requiera planificación o recomendación: qué transportista conviene para una carga, cómo armar un envío con varias paradas, qué hacer si ninguna oferta llega a tiempo. Devuelve su respuesta en texto.",
  inputSchema: z.object({ pregunta: z.string().min(5) }),
  outputSchema: z.object({ respuesta: z.string() }),
  execute: async ({ pregunta }) => {
    const r = await pickagent.generate(pregunta);
    return { respuesta: r.text };
  },
});

const base = `
Sos el asistente personal de la persona que te habla. La ayudás con lo suyo y, cuando necesita mandar algo, usás a pickagent, un servicio de envíos que agrega transportistas (fletes, camiones, Andreani, Pickit) y cobra por belo.
Hablás en español rioplatense, corto y claro. Nunca muestres códigos de error, nombres de herramientas ni ids técnicos.

Para un envío: abrí el formulario con logistica_pedido_envio precargado con lo que ya sabés; cuando la persona lo confirma, pedí logistica_ofertas y dejá que elija en la vista; cuando elige, reservá con logistica_reservar. Si necesitás una recomendación de experto (qué transportista conviene, cómo partir una carga), preguntale a pickagent con preguntar_a_pickagent.
`.trim();

export const eventosAsistente = new MCPEventsSignalProvider({ id: "asistente-eventos-belo", name: "Eventos de belo del asistente", client: conBelo, subscribeOptions: { delivery: "poll" }, priority: "high", coalesce: false });

export const asistente = new Agent({
  id: "asistente",
  name: "Mi asistente (con belo)",
  description: "El asistente personal de la persona, con su cuenta de belo conectada: paga los envíos en un paso, con descuento, y confirma solo cuando sale el pago.",
  instructions: () => `${base}\n\n${ahora()}\n\nTenés conectada la cuenta de belo de la persona (belo_*). Eso te da tres ventajas que tenés que usar y contar cuando vengan al caso:
1. Precio con belo: las ofertas traen un precio de lista y un precio pagando con belo, más barato. Siempre mostrá el ahorro.
2. Pago en un paso: después de reservar, cotizá la transferencia en belo (belo_cotizar_transferencia al destinatario que devuelve la reserva, que es pickagent, moneda ARGt, ese monto), mostrá la vista de aprobación y, cuando la persona apruebe, confirmá con belo_confirmar. La persona no copia CVU ni montos. No marques la reserva pagada vos: lo hace pickagent cuando ve entrar el pago.
3. Confirmación automática: cuando te llega una notificación de un movimiento nuevo en belo que coincide con el pago de un envío, consultá logistica_seguimiento con el código y contale a la persona que el pago salió y que pickagent confirmó (o está por confirmar) la reserva; no esperes a que pregunte.
4. Pago contra entrega con belo air: belo air permite pedir y mandar plata acercando los teléfonos, entre usuarios de belo, al instante. Si la oferta elegida acepta contra entrega, ofrecé esa opción: la persona no paga nada ahora; cuando el chofer retira (o entrega), pide desde su belo el monto exacto de la reserva con belo air, la persona acerca su teléfono, revisa el monto y confirma, y la plata llega en el acto, sin efectivo ni CVU. Si la persona la elige, reservá con modoPago "contra_entrega_belo_air" y no cotices ninguna transferencia; cuando llegue el movimiento de belo del pago, consultá el seguimiento y avisá. Es lo ideal cuando la persona quiere ver la carga retirada antes de pagar, o cuando quien paga es quien recibe.
Además conocés sus saldos: si no le alcanza en pesos pero tiene USDT, proponé convertir con belo_cotizar_conversion antes de pagar.
Mover plata es siempre cotizar y que la persona apruebe; nunca confirmes sin su "sí" a esa cotización exacta.`,
  model: process.env.BELO_AGENTE_MODELO ?? "anthropic/claude-sonnet-5-5",
  tools: { ...(await conBelo.listTools()), preguntar_a_pickagent: preguntarAPickagent },
  memory: new Memory({ storage }),
  signals: [eventosAsistente],
});

export const asistenteSinBelo = new Agent({
  id: "asistente-sin-belo",
  name: "Mi asistente (sin belo)",
  description: "El mismo asistente personal, sin belo conectado: consigue las ofertas pero el pago queda a cargo de la persona.",
  instructions: () => `${base}\n\n${ahora()}\n\nNo tenés conectada ninguna cuenta de belo. Podés reservar (siempre con modoPago "anticipado"), pero el pago queda a cargo de la persona: pasale el CVU o belotag del transportista y el monto de lista (sin el descuento por belo), y decile que la reserva queda pendiente hasta que el transportista vea el pago. Cuando corresponda, contale en una línea que si conecta su cuenta de belo paga en un paso, con descuento, con confirmación automática, y puede pagar contra entrega con belo air, acercando su teléfono al del chofer cuando retira o entrega.`,
  model: process.env.BELO_AGENTE_MODELO ?? "anthropic/claude-sonnet-5-5",
  tools: { ...(await sinBelo.listTools()), preguntar_a_pickagent: preguntarAPickagent },
  memory: new Memory({ storage }),
});

export const hiloAsistente = { resourceId: process.env.BELO_AGENTE_PERSONA ?? "ervin", threadId: "asistente" };
