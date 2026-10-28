/** Casos de uso del motor: pedidos, ofertas, reservas, pagos y seguimiento. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Cuidado, ModoPago, Oferta, Pedido, Punto, Reserva } from "./dominio.ts";
import { localidad, localidades } from "./localidades.ts";
import type { Almacen, Contexto, CuentaPickagent } from "./puerto.ts";
import type { Servicio } from "./transportistas/catalogo.ts";
import type { Transportista } from "./puerto.ts";
import type { Registro } from "./transportistas/registro.ts";

export class ErrorDeLogistica extends Error {
  constructor(readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeLogistica";
  }
}

/** Lo que hace falta para un pedido. Es el contrato del formulario y de la tool. */
export const datosDePedido = z.object({
  origen: z.string().min(2).describe("Localidad o código postal de retiro, por ejemplo Villa Crespo o 2000"),
  destino: z.string().min(2).describe("Localidad o código postal de entrega"),
  direccionOrigen: z.string().optional().describe("Calle y número del retiro"),
  direccionDestino: z.string().optional().describe("Calle y número de la entrega"),
  fechaLimite: z.string().datetime({ offset: true }).describe("Hora límite de entrega, ISO 8601 con zona"),
  mercaderia: z.string().min(2).describe("Qué se manda"),
  pesoKg: z.number().positive().describe("Peso total en kg"),
  volumenM3: z.number().positive().describe("Volumen total en m³"),
  cuidados: z.array(z.enum(["fragil", "refrigerado", "peligroso"])).default([]),
  valorDeclarado: z.number().positive().optional().describe("Valor declarado en ARS, para el seguro"),
  contacto: z.string().min(2).describe("Nombre y teléfono de quien entrega y recibe"),
  notas: z.string().optional(),
});
export type DatosDePedido = z.infer<typeof datosDePedido>;

const nombresConocidos = () => localidades.map((l) => l.nombre).join(", ");

function punto(texto: string, direccion: string | undefined, rol: "origen" | "destino"): Punto {
  const l = localidad(texto);
  if (!l) throw new ErrorDeLogistica(`${rol}_desconocido`, `No conozco la localidad de ${rol} "${texto}". Conozco: ${nombresConocidos()}.`);
  return { texto: texto.trim(), localidad: l, direccion: direccion?.trim() || undefined };
}

export function motor(almacen: Almacen, registro: Registro, pickagent: CuentaPickagent, ahora: () => Date = () => new Date()) {
  const contexto = (): Contexto => ({ ahora: ahora() });

  async function crearPedido(entrada: unknown): Promise<Pedido> {
    const v = datosDePedido.safeParse(entrada);
    if (!v.success) throw new ErrorDeLogistica("pedido_invalido", `Faltan o están mal estos datos: ${v.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join("; ")}.`);
    const d = v.data;
    if (new Date(d.fechaLimite) <= ahora()) throw new ErrorDeLogistica("fecha_pasada", "La fecha límite ya pasó.");
    const pedido: Pedido = {
      id: randomUUID(),
      origen: punto(d.origen, d.direccionOrigen, "origen"),
      destino: punto(d.destino, d.direccionDestino, "destino"),
      fechaLimite: new Date(d.fechaLimite).toISOString(),
      mercaderia: d.mercaderia.trim(),
      pesoKg: d.pesoKg,
      volumenM3: d.volumenM3,
      cuidados: [...new Set(d.cuidados)] as Cuidado[],
      valorDeclarado: d.valorDeclarado,
      contacto: d.contacto.trim(),
      notas: d.notas?.trim() || undefined,
      creado: ahora().toISOString(),
    };
    await almacen.guardarPedido(pedido);
    return pedido;
  }

  /** Las mejores ofertas: cotizan todos los transportistas, se ordena por precio con belo, se devuelven hasta `maximo`. */
  async function ofertasPara(pedidoId: string, maximo = 5): Promise<{ pedido: Pedido; ofertas: Oferta[]; consultados: number; fallas: { transportista: string; motivo: string }[] }> {
    const pedido = await almacen.pedido(pedidoId);
    if (!pedido) throw new ErrorDeLogistica("pedido_desconocido", "No encuentro ese pedido.");
    const { cotizaciones, fallas } = await registro.cotizar(pedido, contexto());
    const ofertas: Oferta[] = cotizaciones.map(({ transportista: t, cotizacion: c }) => ({
      ...c,
      id: randomUUID(),
      pedidoId: pedido.id,
      transportista: { id: t.id, nombre: t.nombre, calificacion: t.calificacion, modo: t.modo },
      descuentoBelo: t.descuentoBelo,
      precioBelo: Math.round(c.precio * (1 - t.descuentoBelo)),
      contraEntrega: t.capacidades.contraEntrega,
    }));
    ofertas.sort((a, b) => a.precioBelo - b.precioBelo || new Date(a.entrega).getTime() - new Date(b.entrega).getTime());
    const mejores = ofertas.slice(0, maximo);
    await almacen.guardarOfertas(mejores);
    return { pedido, ofertas: mejores, consultados: registro.todos().length, fallas };
  }

  async function reservar(ofertaId: string, modoPago: ModoPago = "anticipado"): Promise<Reserva> {
    const oferta = await almacen.oferta(ofertaId);
    if (!oferta) throw new ErrorDeLogistica("oferta_desconocida", "Esa oferta no existe o venció: pedí las ofertas de nuevo.");
    const pedido = await almacen.pedido(oferta.pedidoId);
    const transportista = registro.por(oferta.transportista.id);
    if (!pedido || !transportista) throw new ErrorDeLogistica("oferta_incompleta", "La oferta no tiene pedido o transportista.");
    if (modoPago === "contra_entrega_belo_air" && !transportista.capacidades.contraEntrega) throw new ErrorDeLogistica("sin_contra_entrega", `${transportista.nombre} no cobra contra entrega: el pago es por adelantado.`);
    const r = await transportista.reservar(pedido, oferta, contexto()).catch((e) => {
      throw new ErrorDeLogistica("reserva_fallida", `${transportista.nombre} no pudo tomar la reserva: ${e instanceof Error ? e.message : e}`);
    });
    const comision = Math.round(oferta.precioBelo * pickagent.comision);
    const neto = oferta.precioBelo - comision;
    const cobraPickagent = modoPago === "anticipado";
    const reserva: Reserva = {
      id: randomUUID(),
      codigo: `PA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      estado: "reservada",
      pedido,
      oferta,
      referencia: r.referencia,
      etiquetaUrl: r.etiquetaUrl,
      cobro: cobraPickagent
        ? { monto: oferta.precioBelo, moneda: "ARS", modo: modoPago, cobradoPor: "pickagent", destinatario: { nombre: pickagent.nombre, addressType: "BELOTAG", address: pickagent.belotag } }
        : { monto: oferta.precioBelo, moneda: "ARS", modo: modoPago, cobradoPor: "transportista", destinatario: { ...transportista.cobro, nombre: transportista.nombre } },
      liquidacion: { transportistaId: transportista.id, comision, neto, aPagarAlTransportista: cobraPickagent ? neto : 0, aCobrarAlTransportista: cobraPickagent ? 0 : comision, estado: "pendiente" },
      hitos: r.hitos ?? [{ cuando: ahora().toISOString(), estado: "reservada", detalle: `Reserva tomada por ${transportista.nombre}` }],
      creada: ahora().toISOString(),
      actualizada: ahora().toISOString(),
    };
    await almacen.guardarReserva(reserva);
    return reserva;
  }

  async function marcarPagada(reservaId: string, transaccionId: string, monto: string): Promise<Reserva> {
    const r = await almacen.reserva(reservaId);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro esa reserva.");
    if (r.estado !== "reservada") throw new ErrorDeLogistica("reserva_no_pagable", `La reserva ${r.codigo} está ${r.estado}: no corresponde pagarla.`);
    r.estado = "pagada";
    r.pago = { transaccionId, monto, cuando: ahora().toISOString() };
    r.hitos.push({ cuando: ahora().toISOString(), estado: "pagada", detalle: `Pago de ${monto} ARS por belo` });
    r.actualizada = ahora().toISOString();
    await almacen.guardarReserva(r);
    return r;
  }

  /** Estado actual: el del transportista si lo sabe, y los hitos acumulados. */
  async function seguimiento(idOCodigo: string): Promise<Reserva> {
    const r = await almacen.reserva(idOCodigo);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro una reserva con ese código.");
    const t = registro.por(r.oferta.transportista.id);
    if (t?.capacidades.seguimiento && r.estado !== "cancelada") {
      try {
        const s = await t.seguimiento(r.referencia, contexto());
        const nuevos = s.hitos.filter((h) => !r.hitos.some((x) => x.cuando === h.cuando && x.estado === h.estado));
        r.hitos.push(...nuevos);
        if (s.estado !== "reservada" || r.estado === "reservada") r.estado = r.estado === "pagada" && s.estado === "reservada" ? "pagada" : s.estado;
        r.actualizada = ahora().toISOString();
        await almacen.guardarReserva(r);
      } catch (e) {
        r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `No pude consultar a ${t.nombre}: ${e instanceof Error ? e.message : e}` });
      }
    }
    return r;
  }

  /** Lo que pickagent y cada transportista se deben por las reservas pagadas y no liquidadas, neteado. */
  async function liquidaciones(): Promise<{ transportista: { id: string; nombre: string; cobro: Transportista["cobro"] }; reservas: string[]; aPagar: number; aCobrar: number; saldo: number }[]> {
    const porTransportista = new Map<string, { reservas: string[]; aPagar: number; aCobrar: number }>();
    for (const r of await almacen.reservas()) {
      if (r.estado === "reservada" || r.estado === "cancelada" || r.liquidacion.estado !== "pendiente") continue;
      const acc = porTransportista.get(r.liquidacion.transportistaId) ?? { reservas: [], aPagar: 0, aCobrar: 0 };
      acc.reservas.push(r.codigo);
      acc.aPagar += r.liquidacion.aPagarAlTransportista;
      acc.aCobrar += r.liquidacion.aCobrarAlTransportista;
      porTransportista.set(r.liquidacion.transportistaId, acc);
    }
    return [...porTransportista].flatMap(([id, acc]) => {
      const t = registro.por(id);
      return t ? [{ transportista: { id: t.id, nombre: t.nombre, cobro: t.cobro }, reservas: acc.reservas, aPagar: acc.aPagar, aCobrar: acc.aCobrar, saldo: acc.aPagar - acc.aCobrar }] : [];
    });
  }

  /** Salda las reservas pendientes de un transportista con la transacción de belo que las pagó (o cobró). */
  async function marcarLiquidada(transportistaId: string, transaccionId: string): Promise<{ transportista: string; reservas: string[]; saldo: number }> {
    const t = registro.por(transportistaId);
    if (!t) throw new ErrorDeLogistica("transportista_desconocido", "Ese transportista no existe.");
    const codigos: string[] = [];
    let saldo = 0;
    for (const r of await almacen.reservas()) {
      if (r.liquidacion.transportistaId !== transportistaId || r.liquidacion.estado !== "pendiente" || r.estado === "reservada" || r.estado === "cancelada") continue;
      r.liquidacion = { ...r.liquidacion, estado: "liquidada", transaccionId, cuando: ahora().toISOString() };
      r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `Liquidada con ${t.nombre}` });
      saldo += r.liquidacion.aPagarAlTransportista - r.liquidacion.aCobrarAlTransportista;
      codigos.push(r.codigo);
      await almacen.guardarReserva(r);
    }
    if (!codigos.length) throw new ErrorDeLogistica("nada_que_liquidar", `${t.nombre} no tiene reservas pendientes de liquidación.`);
    return { transportista: t.nombre, reservas: codigos, saldo };
  }

  function cargarServicio(transportistaId: string, servicio: Omit<Servicio, "id">): Servicio {
    const t = registro.por(transportistaId);
    if (!t) throw new ErrorDeLogistica("transportista_desconocido", "Ese transportista no existe.");
    if (!("agregarServicio" in t)) throw new ErrorDeLogistica("sin_catalogo", `${t.nombre} está conectado por API: sus servicios los define su sistema.`);
    return (t as unknown as { agregarServicio(s: Omit<Servicio, "id">): Servicio }).agregarServicio(servicio);
  }

  return {
    crearPedido,
    ofertasPara,
    reservar,
    marcarPagada,
    seguimiento,
    liquidaciones,
    marcarLiquidada,
    cargarServicio,
    transportistas: () => registro.todos().map((t) => ({ id: t.id, nombre: t.nombre, modo: t.modo, calificacion: t.calificacion, descuentoBelo: t.descuentoBelo, capacidades: t.capacidades, servicios: "servicios" in t ? (t as unknown as { servicios: Servicio[] }).servicios : undefined })),
    reservas: () => almacen.reservas(),
  };
}
export type Motor = ReturnType<typeof motor>;
