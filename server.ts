/**
 * El MCP del motor de logística: tools con vistas (formulario de envío y
 * ofertas) para el agente, y el lado del proveedor sin vista.
 */
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ErrorDeLogistica, motor, type Motor } from "./src/motor/casos.ts";
import { vehiculoLegible } from "./src/motor/dominio.ts";
import { localidades } from "./src/motor/localidades.ts";
import { almacenEnMemoria } from "./src/motor/memoria.ts";

const vista = (nombre: string) => fs.readFileSync(path.join(process.cwd(), "dist", `${nombre}.html`), "utf-8");
const VERSION = fs.existsSync(path.join(process.cwd(), "dist", "version")) ? fs.readFileSync(path.join(process.cwd(), "dist", "version"), "utf-8").trim() : "dev";
const UI = { pedido: `ui://logistica/${VERSION}/pedido.html`, ofertas: `ui://logistica/${VERSION}/ofertas.html` };

function explicar(e: unknown): never {
  throw new Error(e instanceof ErrorDeLogistica ? e.message : e instanceof Error ? e.message : "El motor de logística no respondió.");
}
const intentar = async <T>(f: () => Promise<T>): Promise<T> => f().catch(explicar);
const pesos = (n: number) => `${n.toLocaleString("es-AR")} ARS`;
const hora = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const datosDePedido = z.object({
  origen: z.string().min(2).describe("Localidad de retiro, por ejemplo Villa Crespo o Rosario"),
  destino: z.string().min(2).describe("Localidad de entrega"),
  fechaLimite: z.string().datetime({ offset: true }).describe("Hora límite de entrega, ISO 8601 con zona"),
  mercaderia: z.string().min(2).describe("Qué se manda"),
  pesoKg: z.number().positive().describe("Peso total en kg"),
  volumenM3: z.number().positive().describe("Volumen total en m³"),
  fragil: z.boolean().default(false),
  refrigerado: z.boolean().default(false),
  contacto: z.string().min(2).describe("Nombre y teléfono de quien entrega y recibe"),
  notas: z.string().optional(),
});

export function crearServer(m: Motor = motor(almacenEnMemoria())) {
  const tools = {
    pedido_envio: createTool({
      id: "pedido_envio",
      description: "Abre el formulario de envío en el chat para que la persona complete o confirme los datos: origen, destino, hora límite, mercadería, peso, volumen, cuidados y contacto. Precargalo con todo lo que la persona ya dijo. Cuando lo confirma, la vista avisa en el chat con el id del pedido.",
      inputSchema: datosDePedido.partial().describe("Lo que ya se sabe del envío"),
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
        return { pedidoId: p.id, resumen: `Pedido ${p.id}: ${p.mercaderia}, ${p.pesoKg} kg, de ${p.origen} a ${p.destino} antes de ${hora(p.fechaLimite)}.` };
      }),
    }),

    ofertas: createTool({
      id: "ofertas",
      description: "Busca entre los proveedores de logística las mejores ofertas para un pedido (hasta cinco, ordenadas por precio pagando con belo) y las muestra en el chat para que la persona elija. Cada oferta trae proveedor, vehículo, retiro y entrega estimados, precio de lista y precio con belo.",
      inputSchema: z.object({ pedidoId: z.string().uuid() }),
      outputSchema: z.object({ resumen: z.string(), pedido: z.any(), ofertas: z.array(z.any()), descartadas: z.number() }),
      mcp: { _meta: { ui: { resourceUri: UI.ofertas } } },
      execute: ({ pedidoId }) => intentar(async () => {
        const r = await m.ofertasPara(pedidoId);
        const lineas = r.ofertas.map((o, i) => `${i + 1}. ${o.proveedor.nombre} (${vehiculoLegible[o.vehiculo]}, ${o.servicio}): retiro ${hora(o.retiro)}, entrega ${hora(o.entrega)}, ${pesos(o.precio)} de lista, ${pesos(o.precioBelo)} con belo (${Math.round(o.descuentoBelo * 100)} % off). id ${o.id}`);
        return { resumen: r.ofertas.length ? `${r.ofertas.length} ofertas para ${r.pedido.origen} → ${r.pedido.destino} (${r.ofertas[0]!.distanciaKm} km):\n${lineas.join("\n")}` : `Ningún proveedor puede con este envío (${r.descartadas} servicios descartados por cobertura, capacidad, cuidados o plazo). Probá con más plazo o menos carga.`, pedido: r.pedido, ofertas: r.ofertas, descartadas: r.descartadas };
      }),
    }),

    reservar: createTool({
      id: "reservar",
      description: "Reserva una oferta elegida por la persona y devuelve el cobro: cuánto (ya con el descuento por belo), en qué moneda y a quién pagarle por belo (belotag o CVU del proveedor). Después cotizá la transferencia en belo por ese monto, mostrásela a la persona y, cuando apruebe, confirmá y marcá la reserva como pagada.",
      inputSchema: z.object({ ofertaId: z.string().uuid() }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any(), cobro: z.object({ monto: z.string(), moneda: z.string(), destinatario: z.object({ nombre: z.string(), addressType: z.string(), address: z.string() }) }) }),
      execute: ({ ofertaId }) => intentar(async () => {
        const r = await m.reservar(ofertaId);
        const cobro = { monto: r.cobro.monto.toFixed(2), moneda: r.cobro.moneda, destinatario: r.cobro.destinatario };
        return { resumen: `Reserva ${r.codigo} con ${r.cobro.destinatario.nombre}: retiro ${hora(r.oferta.retiro)}, entrega ${hora(r.oferta.entrega)}. A pagar por belo: ${pesos(r.cobro.monto)} a ${r.cobro.destinatario.nombre} (${r.cobro.destinatario.addressType} ${r.cobro.destinatario.address}). Reserva id ${r.id}.`, reserva: r, cobro };
      }),
    }),

    marcar_pagada: createTool({
      id: "marcar_pagada",
      description: "Marca una reserva como pagada con el id de la transacción de belo ya confirmada.",
      inputSchema: z.object({ reservaId: z.string().uuid(), transaccionId: z.string(), monto: z.string() }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any() }),
      execute: ({ reservaId, transaccionId, monto }) => intentar(async () => {
        const r = await m.marcarPagada(reservaId, transaccionId, monto);
        return { resumen: `Reserva ${r.codigo} pagada. ${r.cobro.destinatario.nombre} retira en ${r.pedido.origen} ${hora(r.oferta.retiro)} y entrega en ${r.pedido.destino} ${hora(r.oferta.entrega)}. Código de seguimiento: ${r.codigo}.`, reserva: r };
      }),
    }),

    seguimiento: createTool({
      id: "seguimiento",
      description: "Estado de una reserva por su código (PA-XXXX) o id.",
      inputSchema: z.object({ codigo: z.string().min(3) }),
      outputSchema: z.object({ resumen: z.string(), reserva: z.any() }),
      execute: ({ codigo }) => intentar(async () => {
        const r = await m.seguimiento(codigo);
        return { resumen: `${r.codigo}: ${r.estado}. ${r.pedido.mercaderia} de ${r.pedido.origen} a ${r.pedido.destino} con ${r.cobro.destinatario.nombre}; entrega estimada ${hora(r.oferta.entrega)}.`, reserva: r };
      }),
    }),

    proveedores: createTool({
      id: "proveedores",
      description: "Los proveedores de logística agregados y sus servicios (vehículo, cobertura, tarifa, capacidad, ventana, cuidados, descuento por belo).",
      inputSchema: z.object({}),
      outputSchema: z.object({ proveedores: z.array(z.any()), servicios: z.array(z.any()) }),
      execute: () => intentar(async () => ({ proveedores: await m.proveedores(), servicios: await m.servicios() })),
    }),

    cargar_servicio: createTool({
      id: "cargar_servicio",
      description: "Lado del proveedor: carga un servicio nuevo (y el proveedor, si es nuevo).",
      inputSchema: z.object({
        proveedorId: z.string().optional(),
        proveedor: z.object({ nombre: z.string(), cobro: z.object({ addressType: z.enum(["BELOTAG", "CVU", "ALIAS"]), address: z.string() }), descuentoBelo: z.number().min(0).max(0.5), calificacion: z.number().min(0).max(5).default(4.5) }).optional(),
        nombre: z.string(),
        vehiculo: z.enum(["moto", "utilitario", "camion_chico", "camion"]),
        cobertura: z.object({ origenes: z.array(z.string()), destinos: z.array(z.string()) }),
        tarifa: z.object({ base: z.number(), porKm: z.number(), porKg: z.number() }),
        capacidad: z.object({ kg: z.number(), m3: z.number() }),
        ventana: z.object({ desde: z.number().min(0).max(23), hasta: z.number().min(1).max(24) }),
        anticipacionHoras: z.number().min(0),
        aptitudes: z.array(z.enum(["fragil", "refrigerado"])).default([]),
        velocidadKmh: z.number().positive(),
      }),
      outputSchema: z.object({ servicio: z.any() }),
      execute: ({ proveedor, proveedorId, ...s }) => intentar(async () => ({ servicio: await m.cargarServicio({ ...s, proveedorId: proveedorId ?? "" }, proveedor) })),
    }),
  };

  const server = new MCPServer({
    id: "logistica",
    name: "logistica",
    version: "0.0.0",
    description: "Motor de logística: proveedores agregados, formulario de envío, ofertas con descuento por pagar con belo, reservas y seguimiento.",
    legacy: "stateless",
    tools,
    appResources: {
      [UI.pedido]: { name: "Pedido de envío", description: "El formulario para completar un envío", html: vista("pedido") },
      [UI.ofertas]: { name: "Ofertas", description: "Las mejores ofertas para un pedido", html: vista("ofertas") },
    },
  });
  return { server };
}
