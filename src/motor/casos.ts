/** Casos de uso del motor: pedidos, ofertas por tramos, reservas, pagos, puntos de cobro, seguimiento y liquidación. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adjuntosPara, resolverAdjuntos } from "./adjuntos.ts";
import type { AdjuntoElegido, Cotizacion, Cuidado, ModoPago, Oferta, Pedido, Punto, Reserva, Tramo, TramoReservado } from "./dominio.ts";
import { localidad, localidades } from "./localidades.ts";
import type { Almacen, Contexto, CuentaPickagent, Transportista } from "./puerto.ts";
import type { PuntosDeCobro } from "./spotme.ts";
import type { Servicio } from "./transportistas/catalogo.ts";
import type { Registro } from "./transportistas/registro.ts";

export class ErrorDeLogistica extends Error {
  constructor(readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeLogistica";
  }
}

/** Radio del punto de cobro de un traspaso: la localidad, no la dirección. */
export const RADIO_LOCALIDAD_M = 1500;

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
  valorDeclarado: z.number().positive().optional().describe("Valor declarado en ARS: habilita el seguro por tramo"),
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

export function motor(almacen: Almacen, registro: Registro, pickagent: CuentaPickagent, ahora: () => Date = () => new Date(), puntosDeCobro?: PuntosDeCobro) {
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

  function tramo(n: number, tipo: Tramo["tipo"], desde: Punto, hasta: Punto, t: Transportista, c: Cotizacion, pedido: Pedido): Tramo {
    const precioBelo = Math.round(c.precio * (1 - t.descuentoBelo));
    const base = { ...c, n, tipo, desde, hasta, transportista: { id: t.id, nombre: t.nombre, calificacion: t.calificacion, modo: t.modo }, descuentoBelo: t.descuentoBelo, precioBelo };
    return { ...base, adjuntosDisponibles: adjuntosPara(base, pedido) };
  }

  const deposito = (p: Punto, t: Transportista): Punto => ({ texto: `depósito de ${t.nombre} en ${p.localidad.nombre}`, localidad: p.localidad });

  function oferta(pedido: Pedido, tramos: Tramo[]): Oferta {
    const ultimo = tramos.at(-1)!;
    const t = registro.por(ultimo.transportista.id)!;
    return {
      id: randomUUID(),
      pedidoId: pedido.id,
      tramos,
      precio: tramos.reduce((s, x) => s + x.precio, 0),
      precioBelo: tramos.reduce((s, x) => s + x.precioBelo, 0),
      retiro: tramos[0]!.retiro,
      entrega: ultimo.entrega,
      contraEntrega: tramos.length === 1 && t.capacidades.contraEntrega,
    };
  }

  /**
   * Las mejores ofertas: directas (un tramo puerta a puerta) y cadenas (un servicio que entrega en
   * su depósito más una última milla local en destino). Se ordenan por precio con belo; hasta `maximo`.
   */
  async function ofertasPara(pedidoId: string, maximo = 5): Promise<{ pedido: Pedido; ofertas: Oferta[]; consultados: number; fallas: { transportista: string; motivo: string }[] }> {
    const pedido = await almacen.pedido(pedidoId);
    if (!pedido) throw new ErrorDeLogistica("pedido_desconocido", "No encuentro ese pedido.");
    const { cotizaciones, fallas } = await registro.cotizar(pedido, contexto());
    const ofertas: Oferta[] = [];
    for (const { transportista: t, cotizacion: c } of cotizaciones) {
      if (!c.entregaEnDeposito) {
        ofertas.push(oferta(pedido, [tramo(1, "directo", pedido.origen, pedido.destino, t, c, pedido)]));
        continue;
      }
      // Última milla: un servicio local en la localidad de destino, con retiro posible desde que llega la línea.
      const local: Pedido = { ...pedido, id: `${pedido.id}:local`, origen: deposito(pedido.destino, t) };
      const { cotizaciones: locales } = await registro.cotizar(local, { ahora: new Date(c.entrega) });
      for (const { transportista: tl, cotizacion: cl } of locales) {
        if (tl.id === t.id || cl.entregaEnDeposito) continue;
        ofertas.push(oferta(pedido, [tramo(1, "linea", pedido.origen, deposito(pedido.destino, t), t, c, pedido), tramo(2, "ultima_milla", deposito(pedido.destino, t), pedido.destino, tl, cl, pedido)]));
      }
    }
    ofertas.sort((a, b) => a.precioBelo - b.precioBelo || new Date(a.entrega).getTime() - new Date(b.entrega).getTime());
    const mejores = ofertas.slice(0, maximo);
    await almacen.guardarOfertas(mejores);
    return { pedido, ofertas: mejores, consultados: registro.todos().length, fallas };
  }

  async function reservar(ofertaId: string, modoPago: ModoPago = "anticipado", adjuntos: AdjuntoElegido[] = []): Promise<Reserva> {
    const o = await almacen.oferta(ofertaId);
    if (!o) throw new ErrorDeLogistica("oferta_desconocida", "Esa oferta no existe o venció: pedí las ofertas de nuevo.");
    const pedido = await almacen.pedido(o.pedidoId);
    if (!pedido) throw new ErrorDeLogistica("oferta_incompleta", "La oferta no tiene pedido.");
    if (modoPago === "contra_entrega_belo_air" && !o.contraEntrega) throw new ErrorDeLogistica("sin_contra_entrega", "Esta oferta no se cobra contra entrega: el pago es por adelantado.");
    let elegidos: Map<number, TramoReservado["adjuntos"]>;
    try {
      elegidos = resolverAdjuntos(adjuntos, o.tramos);
    } catch (e) {
      throw new ErrorDeLogistica("adjunto_invalido", e instanceof Error ? e.message : String(e));
    }
    const tramos: TramoReservado[] = [];
    const hitos: Reserva["hitos"] = [];
    for (const tr of o.tramos) {
      const t = registro.por(tr.transportista.id);
      if (!t) throw new ErrorDeLogistica("oferta_incompleta", `No encuentro a ${tr.transportista.nombre}.`);
      const pedidoDelTramo: Pedido = { ...pedido, origen: tr.desde, destino: tr.hasta };
      const r = await t.reservar(pedidoDelTramo, tr, contexto()).catch((e) => {
        throw new ErrorDeLogistica("reserva_fallida", `${t.nombre} no pudo tomar el tramo ${tr.n}: ${e instanceof Error ? e.message : e}`);
      });
      const comision = Math.round(tr.precioBelo * pickagent.comision);
      const neto = tr.precioBelo - comision;
      const cobraPickagent = modoPago === "anticipado";
      tramos.push({
        tramo: tr,
        referencia: r.referencia,
        etiquetaUrl: r.etiquetaUrl,
        adjuntos: elegidos.get(tr.n) ?? [],
        liquidacion: { comision, neto, aPagarAlTransportista: cobraPickagent ? neto : 0, aCobrarAlTransportista: cobraPickagent ? 0 : comision, estado: "pendiente" },
      });
      hitos.push(...(r.hitos ?? [{ cuando: ahora().toISOString(), estado: "reservada" as const, donde: tr.desde.localidad.nombre, detalle: `Tramo ${tr.n}: reserva tomada por ${t.nombre}` }]));
    }
    const adjuntosTotal = tramos.reduce((s, x) => s + x.adjuntos.reduce((a, b) => a + b.precio, 0), 0);
    const monto = o.precioBelo + adjuntosTotal;
    const ultimo = registro.por(o.tramos.at(-1)!.transportista.id)!;
    const reserva: Reserva = {
      id: randomUUID(),
      codigo: `PA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      estado: "reservada",
      pedido,
      oferta: o,
      tramos,
      cobro:
        modoPago === "anticipado"
          ? { monto, moneda: "ARS", modo: modoPago, cobradoPor: "pickagent", destinatario: { nombre: pickagent.nombre, addressType: "BELOTAG", address: pickagent.belotag } }
          : { monto, moneda: "ARS", modo: modoPago, cobradoPor: "transportista", destinatario: { ...ultimo.cobro, nombre: ultimo.nombre } },
      hitos,
      creada: ahora().toISOString(),
      actualizada: ahora().toISOString(),
    };
    await almacen.guardarReserva(reserva);
    return reserva;
  }

  /** Crea el punto de cobro de Spotme de cada tramo cuyo transportista cobra por CVU. Solo con la reserva pagada. */
  async function crearPuntosDeCobro(r: Reserva): Promise<void> {
    if (!puntosDeCobro) return;
    for (const tr of r.tramos) {
      const t = registro.por(tr.tramo.transportista.id);
      if (!t || t.cobro.addressType !== "CVU" || tr.puntoDeCobro || tr.liquidacion.aPagarAlTransportista <= 0) continue;
      const l = tr.tramo.hasta.localidad;
      try {
        const p = await puntosDeCobro.crear({ nombre: `${r.codigo} tramo ${tr.tramo.n} · ${t.nombre}`, lat: l.lat, lon: l.lon, radioM: RADIO_LOCALIDAD_M, cvu: t.cobro.address, importe: tr.liquidacion.neto.toFixed(2) });
        tr.puntoDeCobro = { hotspotId: p.hotspotId, enlace: p.enlace, codigo: p.codigo, pagado: false };
        r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, donde: l.nombre, detalle: `Tramo ${tr.tramo.n}: punto de cobro creado para ${t.nombre} por ${tr.liquidacion.neto.toLocaleString("es-AR")} ARS` });
      } catch (e) {
        r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `Tramo ${tr.tramo.n}: sin punto de cobro (${e instanceof Error ? e.message : e}); se liquida por lote` });
      }
    }
  }

  async function marcarPagada(reservaId: string, transaccionId: string, monto: string): Promise<Reserva> {
    const r = await almacen.reserva(reservaId);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro esa reserva.");
    if (r.estado !== "reservada") throw new ErrorDeLogistica("reserva_no_pagable", `La reserva ${r.codigo} está ${r.estado}: no corresponde pagarla.`);
    r.estado = "pagada";
    r.pago = { transaccionId, monto, cuando: ahora().toISOString() };
    r.hitos.push({ cuando: ahora().toISOString(), estado: "pagada", detalle: `Pago de ${monto} ARS por belo` });
    await crearPuntosDeCobro(r);
    r.actualizada = ahora().toISOString();
    await almacen.guardarReserva(r);
    return r;
  }

  /** Estado actual: lo que dicen los transportistas y los puntos de cobro de cada tramo. */
  async function seguimiento(idOCodigo: string): Promise<Reserva> {
    const r = await almacen.reserva(idOCodigo);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro una reserva con ese código.");
    if (r.estado === "cancelada") return r;
    for (const tr of r.tramos) {
      const t = registro.por(tr.tramo.transportista.id);
      if (t?.capacidades.seguimiento) {
        try {
          const s = await t.seguimiento(tr.referencia, contexto());
          const nuevos = s.hitos.filter((h) => !r.hitos.some((x) => x.cuando === h.cuando && x.estado === h.estado && x.detalle === h.detalle));
          r.hitos.push(...nuevos);
        } catch (e) {
          r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `No pude consultar a ${t.nombre}: ${e instanceof Error ? e.message : e}` });
        }
      }
      if (tr.puntoDeCobro && puntosDeCobro && !tr.puntoDeCobro.pagado) {
        try {
          const e = await puntosDeCobro.estado(tr.puntoDeCobro.hotspotId);
          if (e.reclamado && !tr.puntoDeCobro.reclamadoEn) {
            tr.puntoDeCobro.reclamadoEn = ahora().toISOString();
            r.hitos.push({ cuando: tr.puntoDeCobro.reclamadoEn, estado: tr.tramo.n === r.tramos.length ? "entregada" : "en_viaje", donde: tr.tramo.hasta.localidad.nombre, detalle: `Tramo ${tr.tramo.n}: traspaso confirmado en el lugar por ${tr.tramo.transportista.nombre}` });
          }
          if (e.pagado) {
            tr.puntoDeCobro.pagado = true;
            tr.puntoDeCobro.transaccionId = e.transaccionId;
            tr.liquidacion = { ...tr.liquidacion, estado: "liquidada", transaccionId: e.transaccionId, cuando: ahora().toISOString() };
            r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `Tramo ${tr.tramo.n}: liquidado a ${tr.tramo.transportista.nombre} por el punto de cobro` });
          }
          if (e.fallido) {
            r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `Tramo ${tr.tramo.n}: el punto de cobro no se pagó; vuelve a la liquidación por lote` });
            tr.puntoDeCobro = undefined;
          }
        } catch (e) {
          r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `No pude consultar el punto de cobro del tramo ${tr.tramo.n}: ${e instanceof Error ? e.message : e}` });
        }
      }
    }
    const traspasados = r.tramos.filter((x) => x.puntoDeCobro?.reclamadoEn).length;
    if (r.estado === "pagada" && traspasados > 0) r.estado = traspasados === r.tramos.length ? "entregada" : "en_viaje";
    r.actualizada = ahora().toISOString();
    await almacen.guardarReserva(r);
    return r;
  }

  /** Las reservas que esperan un pago: para cruzarlas con lo que entra en la cuenta de pickagent. */
  async function reservasPendientesDePago(): Promise<Reserva[]> {
    return (await almacen.reservas()).filter((r) => r.estado === "reservada");
  }

  /** Los puntos de cobro de las reservas pagadas: enlace y código son para el transportista. */
  async function listarPuntosDeCobro(): Promise<{ reserva: string; tramo: number; transportista: string; neto: number; enlace: string; codigo: string; reclamadoEn?: string; pagado: boolean }[]> {
    const lista = [];
    for (const r of await almacen.reservas())
      for (const tr of r.tramos)
        if (tr.puntoDeCobro) lista.push({ reserva: r.codigo, tramo: tr.tramo.n, transportista: tr.tramo.transportista.nombre, neto: tr.liquidacion.neto, enlace: tr.puntoDeCobro.enlace, codigo: tr.puntoDeCobro.codigo, reclamadoEn: tr.puntoDeCobro.reclamadoEn, pagado: tr.puntoDeCobro.pagado });
    return lista;
  }

  const pendienteDeLote = (r: Reserva, tr: TramoReservado) => r.estado !== "reservada" && r.estado !== "cancelada" && tr.liquidacion.estado === "pendiente" && !tr.puntoDeCobro;

  /** Lo que pickagent y cada transportista se deben por los tramos pagados sin punto de cobro, neteado. */
  async function liquidaciones(): Promise<{ transportista: { id: string; nombre: string; cobro: Transportista["cobro"] }; reservas: string[]; aPagar: number; aCobrar: number; saldo: number }[]> {
    const porTransportista = new Map<string, { reservas: Set<string>; aPagar: number; aCobrar: number }>();
    for (const r of await almacen.reservas()) {
      for (const tr of r.tramos) {
        if (!pendienteDeLote(r, tr)) continue;
        const acc = porTransportista.get(tr.tramo.transportista.id) ?? { reservas: new Set<string>(), aPagar: 0, aCobrar: 0 };
        acc.reservas.add(`${r.codigo} t${tr.tramo.n}`);
        acc.aPagar += tr.liquidacion.aPagarAlTransportista;
        acc.aCobrar += tr.liquidacion.aCobrarAlTransportista;
        porTransportista.set(tr.tramo.transportista.id, acc);
      }
    }
    return [...porTransportista].flatMap(([id, acc]) => {
      const t = registro.por(id);
      return t ? [{ transportista: { id: t.id, nombre: t.nombre, cobro: t.cobro }, reservas: [...acc.reservas], aPagar: acc.aPagar, aCobrar: acc.aCobrar, saldo: acc.aPagar - acc.aCobrar }] : [];
    });
  }

  /** Salda los tramos pendientes de un transportista con la transacción de belo que los pagó (o cobró). */
  async function marcarLiquidada(transportistaId: string, transaccionId: string): Promise<{ transportista: string; reservas: string[]; saldo: number }> {
    const t = registro.por(transportistaId);
    if (!t) throw new ErrorDeLogistica("transportista_desconocido", "Ese transportista no existe.");
    const codigos: string[] = [];
    let saldo = 0;
    for (const r of await almacen.reservas()) {
      let toco = false;
      for (const tr of r.tramos) {
        if (tr.tramo.transportista.id !== transportistaId || !pendienteDeLote(r, tr)) continue;
        tr.liquidacion = { ...tr.liquidacion, estado: "liquidada", transaccionId, cuando: ahora().toISOString() };
        saldo += tr.liquidacion.aPagarAlTransportista - tr.liquidacion.aCobrarAlTransportista;
        codigos.push(`${r.codigo} t${tr.tramo.n}`);
        toco = true;
      }
      if (toco) {
        r.hitos.push({ cuando: ahora().toISOString(), estado: r.estado, detalle: `Liquidada con ${t.nombre}` });
        await almacen.guardarReserva(r);
      }
    }
    if (!codigos.length) throw new ErrorDeLogistica("nada_que_liquidar", `${t.nombre} no tiene tramos pendientes de liquidación.`);
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
    reservasPendientesDePago,
    listarPuntosDeCobro,
    liquidaciones,
    marcarLiquidada,
    cargarServicio,
    transportistas: () => registro.todos().map((t) => ({ id: t.id, nombre: t.nombre, modo: t.modo, calificacion: t.calificacion, descuentoBelo: t.descuentoBelo, capacidades: t.capacidades, servicios: "servicios" in t ? (t as unknown as { servicios: Servicio[] }).servicios : undefined })),
    reservas: () => almacen.reservas(),
  };
}
export type Motor = ReturnType<typeof motor>;
