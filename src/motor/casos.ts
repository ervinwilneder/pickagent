/** Casos de uso del motor: pedidos, ofertas, reservas y pagos. */
import { randomUUID } from "node:crypto";
import { distanciaKm, localidad, localidades } from "./localidades.ts";
import type { Localidad, Oferta, Pedido, Proveedor, Reserva, Servicio } from "./dominio.ts";
import type { Almacen } from "./puerto.ts";

export class ErrorDeLogistica extends Error {
  constructor(readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeLogistica";
  }
}

export interface DatosDePedido {
  origen: string;
  destino: string;
  fechaLimite: string;
  mercaderia: string;
  pesoKg: number;
  volumenM3: number;
  fragil?: boolean;
  refrigerado?: boolean;
  contacto: string;
  notas?: string;
}

const HORAS_CARGA_DESCARGA = 1;
const ZONA_HORARIA_MS = -3 * 3600_000; // Argentina, sin horario de verano.

const cubre = (cobertura: string[], l: Localidad) => cobertura.some((c) => c === "*" || c === l.zona || c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === l.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
const horaLocal = (d: Date) => new Date(d.getTime() + ZONA_HORARIA_MS).getUTCHours() + new Date(d.getTime() + ZONA_HORARIA_MS).getUTCMinutes() / 60;

/** El primer retiro posible dentro de la ventana del servicio, desde un instante dado. */
function primerRetiro(desde: Date, s: Servicio): Date {
  const d = new Date(desde);
  for (let i = 0; i < 8; i++) {
    const h = horaLocal(d);
    if (h >= s.ventana.desde && h < s.ventana.hasta) return d;
    // Saltar al comienzo de la próxima ventana.
    const local = new Date(d.getTime() + ZONA_HORARIA_MS);
    if (h >= s.ventana.hasta) local.setUTCDate(local.getUTCDate() + 1);
    local.setUTCHours(s.ventana.desde, 0, 0, 0);
    d.setTime(local.getTime() - ZONA_HORARIA_MS);
  }
  return d;
}

export function motor(almacen: Almacen, ahora: () => Date = () => new Date()) {
  async function crearPedido(datos: DatosDePedido): Promise<Pedido> {
    if (!localidad(datos.origen)) throw new ErrorDeLogistica("origen_desconocido", `No conozco la localidad de origen "${datos.origen}". Conozco: ${localidades.map((l) => l.nombre).join(", ")}.`);
    if (!localidad(datos.destino)) throw new ErrorDeLogistica("destino_desconocido", `No conozco la localidad de destino "${datos.destino}". Conozco: ${localidades.map((l) => l.nombre).join(", ")}.`);
    if (Number.isNaN(Date.parse(datos.fechaLimite))) throw new ErrorDeLogistica("fecha_invalida", "La fecha límite no es una fecha válida.");
    if (new Date(datos.fechaLimite) <= ahora()) throw new ErrorDeLogistica("fecha_pasada", "La fecha límite ya pasó.");
    const pedido: Pedido = {
      id: randomUUID(),
      origen: datos.origen.trim(),
      destino: datos.destino.trim(),
      fechaLimite: new Date(datos.fechaLimite).toISOString(),
      mercaderia: datos.mercaderia.trim(),
      pesoKg: Math.max(0.1, Number(datos.pesoKg) || 1),
      volumenM3: Math.max(0.001, Number(datos.volumenM3) || 0.01),
      fragil: Boolean(datos.fragil),
      refrigerado: Boolean(datos.refrigerado),
      contacto: datos.contacto.trim(),
      notas: datos.notas?.trim() || undefined,
      creado: ahora().toISOString(),
    };
    await almacen.guardarPedido(pedido);
    return pedido;
  }

  async function ofertasPara(pedidoId: string): Promise<{ pedido: Pedido; ofertas: Oferta[]; descartadas: number }> {
    const pedido = await almacen.pedido(pedidoId);
    if (!pedido) throw new ErrorDeLogistica("pedido_desconocido", "No encuentro ese pedido.");
    const o = localidad(pedido.origen)!;
    const d = localidad(pedido.destino)!;
    const km = distanciaKm(o, d);
    const limite = new Date(pedido.fechaLimite);
    const proveedores = new Map((await almacen.proveedores()).map((p) => [p.id, p]));
    const ofertas: Oferta[] = [];
    let descartadas = 0;
    for (const s of await almacen.servicios()) {
      const p = proveedores.get(s.proveedorId);
      if (!p) continue;
      const apto = cubre(s.cobertura.origenes, o) && cubre(s.cobertura.destinos, d) && s.capacidad.kg >= pedido.pesoKg && s.capacidad.m3 >= pedido.volumenM3 && (!pedido.fragil || s.aptitudes.includes("fragil")) && (!pedido.refrigerado || s.aptitudes.includes("refrigerado"));
      if (!apto) {
        descartadas++;
        continue;
      }
      const retiro = primerRetiro(new Date(ahora().getTime() + s.anticipacionHoras * 3600_000), s);
      const horasViaje = Math.round((km / s.velocidadKmh + HORAS_CARGA_DESCARGA) * 10) / 10;
      const entrega = new Date(retiro.getTime() + horasViaje * 3600_000);
      if (entrega > limite) {
        descartadas++;
        continue;
      }
      const precio = Math.round(s.tarifa.base + s.tarifa.porKm * km + s.tarifa.porKg * pedido.pesoKg);
      const precioBelo = Math.round(precio * (1 - p.descuentoBelo));
      ofertas.push({
        id: randomUUID(),
        pedidoId: pedido.id,
        servicioId: s.id,
        proveedor: { id: p.id, nombre: p.nombre, calificacion: p.calificacion },
        servicio: s.nombre,
        vehiculo: s.vehiculo,
        distanciaKm: km,
        horasViaje,
        retiro: retiro.toISOString(),
        entrega: entrega.toISOString(),
        moneda: "ARS",
        precio,
        descuentoBelo: p.descuentoBelo,
        precioBelo,
      });
    }
    ofertas.sort((a, b) => a.precioBelo - b.precioBelo);
    const mejores = ofertas.slice(0, 5);
    await almacen.guardarOfertas(mejores);
    return { pedido, ofertas: mejores, descartadas };
  }

  async function reservar(ofertaId: string): Promise<Reserva> {
    const oferta = await almacen.oferta(ofertaId);
    if (!oferta) throw new ErrorDeLogistica("oferta_desconocida", "Esa oferta no existe o venció: pedí las ofertas de nuevo.");
    const pedido = await almacen.pedido(oferta.pedidoId);
    const proveedor = await almacen.proveedor(oferta.proveedor.id);
    if (!pedido || !proveedor) throw new ErrorDeLogistica("oferta_incompleta", "La oferta no tiene pedido o proveedor.");
    const reserva: Reserva = {
      id: randomUUID(),
      codigo: `PA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      estado: "reservada",
      pedido,
      oferta,
      cobro: { monto: oferta.precioBelo, moneda: "ARS", destinatario: { ...proveedor.cobro, nombre: proveedor.nombre } },
      creada: ahora().toISOString(),
      actualizada: ahora().toISOString(),
    };
    await almacen.guardarReserva(reserva);
    return reserva;
  }

  async function marcarPagada(reservaId: string, transaccionId: string, monto: string): Promise<Reserva> {
    const r = await almacen.reserva(reservaId);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro esa reserva.");
    r.estado = "pagada";
    r.pago = { transaccionId, monto, cuando: ahora().toISOString() };
    r.actualizada = ahora().toISOString();
    await almacen.guardarReserva(r);
    return r;
  }

  async function seguimiento(idOCodigo: string): Promise<Reserva> {
    const r = await almacen.reserva(idOCodigo);
    if (!r) throw new ErrorDeLogistica("reserva_desconocida", "No encuentro una reserva con ese código.");
    return r;
  }

  async function cargarServicio(s: Omit<Servicio, "id">, proveedor?: Omit<Proveedor, "id">): Promise<Servicio> {
    let proveedorId = s.proveedorId;
    if (proveedor) {
      const p: Proveedor = { id: `p-${randomUUID().slice(0, 8)}`, ...proveedor };
      await almacen.guardarProveedor(p);
      proveedorId = p.id;
    }
    if (!(await almacen.proveedor(proveedorId))) throw new ErrorDeLogistica("proveedor_desconocido", "Ese proveedor no existe.");
    const servicio: Servicio = { id: `s-${randomUUID().slice(0, 8)}`, ...s, proveedorId };
    await almacen.guardarServicio(servicio);
    return servicio;
  }

  return { crearPedido, ofertasPara, reservar, marcarPagada, seguimiento, cargarServicio, proveedores: () => almacen.proveedores(), servicios: () => almacen.servicios(), reservas: () => almacen.reservas() };
}
export type Motor = ReturnType<typeof motor>;
