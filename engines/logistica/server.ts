/**
 * El MCP del motor de logística: tools con vistas (formulario de envío y
 * ofertas) para el agente, y el lado del transportista sin vista.
 */
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { datosDePedido, ErrorDeLogistica, motor, type Motor } from "./src/motor/casos.ts";
import { adjuntoLegible, estadoLegible, modoPagoLegible, tipoTramoLegible, vehiculoLegible } from "./src/motor/dominio.ts";
import { puntosDeCobroEnSpotme } from "./src/motor/spotme.ts";
import { localidades } from "./src/motor/localidades.ts";
import { almacenEnArchivo } from "./src/motor/archivo.ts";
import { almacenEnMemoria, registroDeEjemplo } from "./src/motor/memoria.ts";

const vista = (nombre: string) => fs.readFileSync(path.join(process.cwd(), "dist", `${nombre}.html`), "utf-8");
const VERSION = fs.existsSync(path.join(process.cwd(), "dist", "version")) ? fs.readFileSync(path.join(process.cwd(), "dist", "version"), "utf-8").trim() : "dev";
const UI = { pedido: `ui://logistica/${VERSION}/pedido.html`, ofertas: `ui://logistica/${VERSION}/ofertas.html` };

function explicar(e: unknown): never {
  throw new Error(e instanceof ErrorDeLogistica ? e.message : e instanceof Error ? e.message : "El motor de logística no respondió.");
}
const intentar = async <T>(f: () => Promise<T>): Promise<T> => f().catch(explicar);
const pesos = (n: number) => `${n.toLocaleString("es-AR")} ARS`;
const hora = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** La cuenta de belo de pickagent, a la que paga el cliente. Sin default: sale de la configuración. */
function cuentaPickagent() {
  const belotag = process.env.PICKAGENT_BELOTAG;
  if (!belotag) throw new Error("Configurá PICKAGENT_BELOTAG (el belotag de la cuenta de belo de pickagent)");
  return { nombre: process.env.PICKAGENT_NOMBRE ?? "pickagent", belotag, cvu: process.env.PICKAGENT_CVU, comision: Number(process.env.PICKAGENT_COMISION ?? "0.08") };
}

/** Con LOGISTICA_DATOS, el almacén vive en ese archivo y sobrevive a los reinicios; sin él, en memoria. */
const almacen = () => (process.env.LOGISTICA_DATOS ? almacenEnArchivo(process.env.LOGISTICA_DATOS) : almacenEnMemoria());

/** Con SPOTME_MCP_URL, cada traspaso con CVU tiene un punto de cobro en Spotme; sin ella, se liquida por lote. */
const spotme = () => (process.env.SPOTME_MCP_URL ? puntosDeCobroEnSpotme(process.env.SPOTME_MCP_URL) : undefined);
const describirTramos = (r: { tramos: { tramo: { n: number; tipo: "directo" | "linea" | "ultima_milla"; transportista: { nombre: string }; precioBelo: number; retiro: string; entrega: string }; adjuntos: { nombre: string; precio: number }[]; puntoDeCobro?: { reclamadoEn?: string; pagado: boolean } }[] }) =>
  r.tramos.map((t) => `tramo ${t.tramo.n} (${tipoTramoLegible[t.tramo.tipo]}): ${t.tramo.transportista.nombre}, ${hora(t.tramo.retiro)} → ${hora(t.tramo.entrega)}, ${pesos(t.tramo.precioBelo)} con belo${t.adjuntos.length ? ` + ${t.adjuntos.map((a) => `${a.nombre} ${pesos(a.precio)}`).join(" + ")}` : ""}${t.puntoDeCobro ? t.puntoDeCobro.pagado ? ", liquidado por el punto de cobro" : t.puntoDeCobro.reclamadoEn ? `, traspaso confirmado ${hora(t.puntoDeCobro.reclamadoEn)}` : ", con punto de cobro pendiente" : ""}`).join("; ");

export function crearServer(m: Motor = motor(almacen(), registroDeEjemplo(), cuentaPickagent(), undefined, spotme())) {
  const tools = {
    pedido_envio: createTool({
      id: "pedido_envio",
      description: "Abre el formulario de envío en el chat para que la persona complete o confirme los datos: origen, destino, hora límite, mercadería, peso, volumen, cuidados y contacto. Precargalo con todo lo que la persona ya dijo. Cuando lo confirma, la vista avisa en el chat con el id del pedido.",
      inputSchema: datosDePedido.partial().extend({ fragil: z.boolean().optional(), refrigerado: z.boolean().optional() }).describe("Lo que ya se sabe del envío"),
      outputSchema: z.object({ resumen: z.string(), borrador: z.any(), localidades: z.array(z.string()) }),
      mcp: { _meta: { ui: { resourceUri: UI.pedido } } },
      execute: async (borrador) => ({ resumen: "Formulario de envío abierto. Esperá a que la persona lo confirme; la vista avisa con el id del pedido.", borrador, localidades: localidades.map((l) => `${l.nombre}, ${l.provincia}`) }),
    }),

    crear_pedido: createTool({
      id: "crear_pedido",
      description: "Registra un pedido de envío completo y devuelve su id. La usa el formulario; el agente puede usarla si ya tiene todos los datos.",
      inputSchema: datosDePedido,
      outputSchema: z.object({ pedidoId: z.string(), resumen: z.string() }),
      execute: (datos) => intentar(async () => {
        const p = await m.crearPedido(datos);
        return { pedidoId: p.id, resumen: `Pedido ${p.id}: ${p.mercaderia}, ${p.pesoKg} kg, ${p.volumenM3} m³${p.cuidados.length ? ` (${p.cuidados.join(", ")})` : ""}, de ${p.origen.localidad.nombre} a ${p.destino.localidad.nombre} antes de ${hora(p.fechaLimite)}.` };
      }),
    }),

    ofertas: createTool({
      id: "ofertas",
      description: "Pide cotización a todos los transportistas (catálogo y conectados por API) para un pedido y muestra las mejores ofertas (hasta cinco, ordenadas por precio pagando con belo) para que la persona elija. Cada oferta es una cadena de uno o dos tramos (puerta a puerta, o línea hasta el depósito más última milla), cada tramo con su transportista, vehículo, horarios, precio con belo y productos adjuntos disponibles (seguro del tramo si hay valor declarado, entrega a tiempo). La persona elige la oferta y los adjuntos en la vista.",
      inputSchema: z.object({ pedidoId: z.string().uuid() }),
      outputSchema: z.object({ resumen: z.string(), pedido: z.any(), ofertas: z.array(z.any()), consultados: z.number(), fallas: z.array(z.object({ transportista: z.string(), motivo: z.string() })) }),
      mcp: { _meta: { ui: { resourceUri: UI.ofertas } } },
      execute: ({ pedidoId }) => intentar(async () => {
        const r = await m.ofertasPara(pedidoId);
        const lineas = r.ofertas.map((o, i) => `${i + 1}. ${o.tramos.length === 1 ? `${o.tramos[0]!.transportista.nombre} · ${o.tramos[0]!.servicio} (${vehiculoLegible[o.tramos[0]!.vehiculo]})` : `${o.tramos.length} tramos: ${o.tramos.map((t) => `${t.transportista.nombre} (${tipoTramoLegible[t.tipo]}, ${vehiculoLegible[t.vehiculo]}, ${pesos(t.precioBelo)} con belo)`).join(" + ")}`}: retiro ${hora(o.retiro)}, entrega ${hora(o.entrega)}, ${pesos(o.precio)} de lista, ${pesos(o.precioBelo)} con belo${o.contraEntrega ? ", acepta contra entrega con belo air" : ""}. Adjuntos por tramo: ${o.tramos.map((t) => `t${t.n} ${t.adjuntosDisponibles.map((a) => `${adjuntoLegible[a.tipo]} ${pesos(a.precio)}`).join(", ")}`).join("; ")}. Id ${o.id}`);
        const fallas = r.fallas.length ? ` Sin respuesta de: ${r.fallas.map((f) => `${f.transportista} (${f.motivo})`).join(", ")}.` : "";
        const resumen = r.ofertas.length
          ? `${r.ofertas.length} ofertas de ${r.consultados} transportistas para ${r.pedido.origen.localidad.nombre} → ${r.pedido.destino.localidad.nombre} (${r.ofertas[0]!.tramos.reduce((k, t) => k + t.distanciaKm, 0)} km):\n${lineas.join("\n")}${fallas}`
          : `Ningún transportista de ${r.consultados} puede con este envío (cobertura, capacidad, cuidados o plazo). Probá con más plazo o menos carga.${fallas}`;
        return { resumen, pedido: r.pedido, ofertas: r.ofertas, consultados: r.consultados, fallas: r.fallas };
      }),
    }),

    reservar: createTool({
      id: "reservar",
      description: "Reserva una oferta elegida por la persona (todos sus tramos, con los adjuntos que eligió) y devuelve el cobro total: cuánto (ya con el descuento por belo), en qué moneda, a quién pagarle y el modo. Modo 'anticipado': el cliente le paga a pickagent (su belotag); cotizá la transferencia en belo por ese monto, mostrásela a la persona y, cuando apruebe, confirmá. pickagent marca la reserva pagada cuando ve entrar el pago en su cuenta. Modo 'contra_entrega_belo_air' (solo si la oferta lo acepta): al retirar o entregar, el chofer pide el monto exacto desde su belo con belo air, la persona acerca su teléfono, revisa y confirma, y la plata llega al instante; no cotices nada; cuando llegue el movimiento de belo, marcá la reserva pagada.",
      inputSchema: z.object({ ofertaId: z.string().uuid(), modoPago: z.enum(["anticipado", "contra_entrega_belo_air"]).default("anticipado"), adjuntos: z.array(z.object({ tramo: z.number().int().min(1), tipo: z.enum(["seguro", "entrega_a_tiempo"]) })).default([]).describe("Los productos adjuntos que la persona eligió por tramo") }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any(), cobro: z.object({ monto: z.string(), moneda: z.string(), modo: z.string(), destinatario: z.object({ nombre: z.string(), addressType: z.string(), address: z.string() }) }) }),
      execute: ({ ofertaId, modoPago, adjuntos }) => intentar(async () => {
        const r = await m.reservar(ofertaId, modoPago, adjuntos);
        const cobro = { monto: r.cobro.monto.toFixed(2), moneda: r.cobro.moneda, modo: r.cobro.modo, destinatario: r.cobro.destinatario };
        const pago = r.cobro.modo === "anticipado"
          ? `El cliente le paga a pickagent por belo: ${pesos(r.cobro.monto)} a ${r.cobro.destinatario.nombre} (${r.cobro.destinatario.addressType} ${r.cobro.destinatario.address}); pickagent le liquida después al transportista.`
          : `Se paga contra entrega con belo air: al retirar o entregar, el chofer de ${r.cobro.destinatario.nombre} pide ${pesos(r.cobro.monto)} desde su belo, la persona acerca su teléfono, revisa y confirma; nada que cotizar ahora.`;
        return { resumen: `Reserva ${r.codigo} (${r.tramos.length} ${r.tramos.length === 1 ? "tramo" : "tramos"}: ${describirTramos(r)}; referencias ${r.tramos.map((t) => t.referencia).join(", ")}): retiro ${hora(r.oferta.retiro)}, entrega ${hora(r.oferta.entrega)}. ${pago} Reserva id ${r.id}.`, reserva: r, cobro };
      }),
    }),

    marcar_pagada: createTool({
      id: "marcar_pagada",
      description: "Marca una reserva como pagada con el id de la transacción de belo ya confirmada.",
      inputSchema: z.object({ reservaId: z.string().uuid(), transaccionId: z.string(), monto: z.string() }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any() }),
      execute: ({ reservaId, transaccionId, monto }) => intentar(async () => {
        const r = await m.marcarPagada(reservaId, transaccionId, monto);
        const puntos = r.tramos.filter((t) => t.puntoDeCobro).length;
        return { resumen: `Reserva ${r.codigo} pagada. ${r.tramos[0]!.tramo.transportista.nombre} retira en ${r.pedido.origen.localidad.nombre} ${hora(r.oferta.retiro)}; entrega en ${r.pedido.destino.localidad.nombre} ${hora(r.oferta.entrega)} por ${r.tramos.at(-1)!.tramo.transportista.nombre}. Ahorro por belo: ${pesos(r.oferta.precio - r.oferta.precioBelo)}. ${puntos ? `${puntos} ${puntos === 1 ? "traspaso se confirma" : "traspasos se confirman"} en el lugar con punto de cobro (los enlaces son del transportista; están en puntos_de_cobro). ` : ""}Código de seguimiento: ${r.codigo}.`, reserva: r };
      }),
    }),

    seguimiento: createTool({
      id: "seguimiento",
      description: "Estado de una reserva por su código (PA-XXXX) o id, con sus tramos, los hitos de cada transportista y los traspasos confirmados en el lugar.",
      inputSchema: z.object({ codigo: z.string().min(3) }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any() }),
      execute: ({ codigo }) => intentar(async () => {
        const r = await m.seguimiento(codigo);
        const hitos = r.hitos.map((h) => `${hora(h.cuando)}: ${estadoLegible[h.estado]}${h.donde ? ` en ${h.donde}` : ""}, ${h.detalle}`).join("; ");
        return { resumen: `${r.codigo}: ${estadoLegible[r.estado]} (pago ${modoPagoLegible[r.cobro.modo]}). ${r.pedido.mercaderia} de ${r.pedido.origen.localidad.nombre} a ${r.pedido.destino.localidad.nombre}; ${describirTramos(r)}; entrega estimada ${hora(r.oferta.entrega)}. Hitos: ${hitos}.`, reserva: r };
      }),
    }),

    reservas_pendientes: createTool({
      id: "reservas_pendientes",
      description: "Lado de pickagent: las reservas que esperan un pago, con código, id, monto, modo y a quién se le paga. Cuando entra un depósito en la cuenta de pickagent, buscá acá la reserva con ese monto y marcala pagada.",
      inputSchema: z.object({}),
      outputSchema: z.object({ resumen: z.string(), reservas: z.array(z.any()) }),
      execute: () => intentar(async () => {
        const rs = await m.reservasPendientesDePago();
        const lineas = rs.map((r) => `${r.codigo} (id ${r.id}): ${pesos(r.cobro.monto)} ${modoPagoLegible[r.cobro.modo]}, ${r.pedido.mercaderia} de ${r.pedido.origen.localidad.nombre} a ${r.pedido.destino.localidad.nombre} con ${r.tramos.map((t) => t.tramo.transportista.nombre).join(" + ")}, reservada ${hora(r.creada)}`);
        return { resumen: rs.length ? `${rs.length} reservas esperando pago:\n${lineas.join("\n")}` : "No hay reservas esperando pago.", reservas: rs.map((r) => ({ id: r.id, codigo: r.codigo, monto: r.cobro.monto.toFixed(2), modo: r.cobro.modo, transportista: r.tramos.map((t) => t.tramo.transportista.nombre).join(" + "), creada: r.creada })) };
      }),
    }),

    liquidaciones: createTool({
      id: "liquidaciones",
      description: "Lado de pickagent: lo que pickagent y cada transportista se deben por los tramos pagados sin punto de cobro, neteado (los tramos con punto de cobro se liquidan solos cuando Spotme confirma el pago). Saldo positivo: pickagent le transfiere al transportista (a su belotag o CVU); negativo: el transportista le debe a pickagent la comisión de lo que cobró en mano con belo air.",
      inputSchema: z.object({}),
      outputSchema: z.object({ resumen: z.string(), liquidaciones: z.array(z.any()) }),
      execute: () => intentar(async () => {
        const ls = await m.liquidaciones();
        const lineas = ls.map((l) => `${l.transportista.nombre}: ${l.reservas.length} tramos (${l.reservas.join(", ")}), a pagar ${pesos(l.aPagar)}, a cobrar ${pesos(l.aCobrar)}, saldo ${pesos(l.saldo)} → ${l.saldo > 0 ? `transferir ${pesos(l.saldo)} a ${l.transportista.cobro.addressType} ${l.transportista.cobro.address}` : l.saldo < 0 ? `el transportista le debe ${pesos(-l.saldo)} a pickagent` : "nada que mover"} (id ${l.transportista.id})`);
        return { resumen: ls.length ? `Liquidaciones pendientes:\n${lineas.join("\n")}` : "No hay reservas pendientes de liquidación.", liquidaciones: ls };
      }),
    }),

    marcar_liquidada: createTool({
      id: "marcar_liquidada",
      description: "Lado de pickagent: salda las reservas pendientes de un transportista con el id de la transacción de belo que las pagó.",
      inputSchema: z.object({ transportistaId: z.string(), transaccionId: z.string() }),
      outputSchema: z.object({ resumen: z.string() }),
      execute: ({ transportistaId, transaccionId }) => intentar(async () => {
        const r = await m.marcarLiquidada(transportistaId, transaccionId);
        return { resumen: `Liquidadas ${r.reservas.length} reservas con ${r.transportista} (${r.reservas.join(", ")}), saldo ${pesos(r.saldo)}.` };
      }),
    }),

    puntos_de_cobro: createTool({
      id: "puntos_de_cobro",
      description: "Lado de pickagent: los puntos de cobro de Spotme de las reservas pagadas, uno por traspaso con transportista que cobra por CVU: enlace y código para dárselos al transportista (nunca al cliente), neto a liberar, y si el chofer ya lo reclamó o ya se pagó.",
      inputSchema: z.object({}),
      outputSchema: z.object({ resumen: z.string(), puntos: z.array(z.any()) }),
      execute: () => intentar(async () => {
        const ps = await m.listarPuntosDeCobro();
        const lineas = ps.map((p) => `${p.reserva} tramo ${p.tramo} · ${p.transportista}: ${pesos(p.neto)} · enlace ${p.enlace} · código ${p.codigo} · ${p.pagado ? "pagado" : p.reclamadoEn ? `reclamado ${hora(p.reclamadoEn)}, esperando aprobación de pickagent en Spotme` : "pendiente de reclamo"}`);
        return { resumen: ps.length ? `Puntos de cobro:\n${lineas.join("\n")}` : "No hay puntos de cobro.", puntos: ps };
      }),
    }),

    transportistas: createTool({
      id: "transportistas",
      description: "Los transportistas agregados: por catálogo (el motor cotiza con sus servicios) o conectados por API (cotizan ellos), con sus capacidades y descuento por belo.",
      inputSchema: z.object({}),
      outputSchema: z.object({ transportistas: z.array(z.any()) }),
      execute: () => intentar(async () => ({ transportistas: m.transportistas() })),
    }),

    cargar_servicio: createTool({
      id: "cargar_servicio",
      description: "Lado del transportista por catálogo: carga un servicio nuevo (vehículo, cobertura, tarifa, capacidad, ventana, cuidados).",
      inputSchema: z.object({
        transportistaId: z.string(),
        nombre: z.string(),
        vehiculo: z.enum(["moto", "utilitario", "camion_chico", "camion", "red_sucursales"]),
        cobertura: z.object({ origenes: z.array(z.string()), destinos: z.array(z.string()) }),
        tarifa: z.object({ base: z.number(), porKm: z.number(), porKg: z.number(), minimo: z.number().optional() }),
        capacidad: z.object({ kg: z.number(), m3: z.number() }),
        ventana: z.object({ desde: z.number().min(0).max(23), hasta: z.number().min(1).max(24) }),
        anticipacionHoras: z.number().min(0),
        cuidados: z.array(z.enum(["fragil", "refrigerado", "peligroso"])).default([]),
        velocidadKmh: z.number().positive(),
        horasOperativas: z.number().min(0).optional(),
      }),
      outputSchema: z.object({ servicio: z.any() }),
      execute: ({ transportistaId, ...s }) => intentar(async () => ({ servicio: m.cargarServicio(transportistaId, s) })),
    }),
  };

  const server = new MCPServer({
    id: "logistica",
    name: "logistica",
    version: "0.0.0",
    description: "Motor de logística: transportistas agregados (catálogo y API), formulario de envío, ofertas con descuento por pagar con belo, reservas y seguimiento.",
    legacy: "stateless",
    tools,
    appResources: {
      [UI.pedido]: { name: "Pedido de envío", description: "El formulario para completar un envío", html: vista("pedido") },
      [UI.ofertas]: { name: "Ofertas", description: "Las mejores ofertas para un pedido", html: vista("ofertas") },
    },
  });
  return { server };
}
