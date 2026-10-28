/**
 * Transportista por catálogo: la empresa carga sus servicios (vehículo,
 * cobertura, tarifa, capacidad, ventana, cuidados) y el motor cotiza por ella.
 * Es la forma más simple de sumarse: no hace falta una API.
 */
import { randomUUID } from "node:crypto";
import type { Cotizacion, Cuidado, EstadoReserva, Hito, Pedido, Vehiculo } from "../dominio.ts";
import { distanciaKm, normalizar } from "../localidades.ts";
import type { Transportista } from "../puerto.ts";

export interface Servicio {
  id: string;
  nombre: string;
  vehiculo: Vehiculo;
  /** Localidades, zonas ("AMBA", "interior") o "*" que cubre como origen y como destino. */
  cobertura: { origenes: string[]; destinos: string[] };
  /** Precio = máximo(mínimo, base + porKm·km + porKg·kg). */
  tarifa: { base: number; porKm: number; porKg: number; minimo?: number };
  capacidad: { kg: number; m3: number };
  /** Ventana horaria de retiro, en hora de Argentina (0 a 24). */
  ventana: { desde: number; hasta: number };
  anticipacionHoras: number;
  cuidados: Cuidado[];
  velocidadKmh: number;
  /** Horas fijas de carga y descarga. */
  horasOperativas?: number;
}

export interface DatosDeCatalogo {
  id: string;
  nombre: string;
  calificacion: number;
  cobro: Transportista["cobro"];
  descuentoBelo: number;
  servicios: Servicio[];
}

const ZONA_HORARIA_MS = -3 * 3600_000;
const horaLocal = (d: Date) => {
  const l = new Date(d.getTime() + ZONA_HORARIA_MS);
  return l.getUTCHours() + l.getUTCMinutes() / 60;
};

/** El primer retiro posible dentro de la ventana del servicio, desde un instante dado. */
export function primerRetiro(desde: Date, ventana: Servicio["ventana"]): Date {
  const d = new Date(desde);
  for (let i = 0; i < 8; i++) {
    const h = horaLocal(d);
    if (h >= ventana.desde && h < ventana.hasta) return d;
    const local = new Date(d.getTime() + ZONA_HORARIA_MS);
    if (h >= ventana.hasta) local.setUTCDate(local.getUTCDate() + 1);
    local.setUTCHours(ventana.desde, 0, 0, 0);
    d.setTime(local.getTime() - ZONA_HORARIA_MS);
  }
  return d;
}

const cubre = (cobertura: string[], l: Pedido["origen"]["localidad"]) => cobertura.some((c) => c === "*" || c === l.zona || normalizar(c) === normalizar(l.nombre) || c === l.codigoPostal);

export function transportistaPorCatalogo(datos: DatosDeCatalogo): Transportista & { servicios: Servicio[]; agregarServicio(s: Omit<Servicio, "id">): Servicio } {
  const servicios = [...datos.servicios];
  const reservas = new Map<string, Hito[]>();
  return {
    id: datos.id,
    nombre: datos.nombre,
    modo: "catalogo",
    calificacion: datos.calificacion,
    cobro: datos.cobro,
    descuentoBelo: datos.descuentoBelo,
    capacidades: { reserva: true, seguimiento: true, etiqueta: false },
    servicios,
    agregarServicio(s) {
      const servicio = { id: `s-${randomUUID().slice(0, 8)}`, ...s };
      servicios.push(servicio);
      return servicio;
    },
    async cotizar(pedido, { ahora }) {
      const km = distanciaKm(pedido.origen.localidad, pedido.destino.localidad);
      const limite = new Date(pedido.fechaLimite);
      const cotizaciones: Cotizacion[] = [];
      for (const s of servicios) {
        const apto = cubre(s.cobertura.origenes, pedido.origen.localidad) && cubre(s.cobertura.destinos, pedido.destino.localidad) && s.capacidad.kg >= pedido.pesoKg && s.capacidad.m3 >= pedido.volumenM3 && pedido.cuidados.every((c) => s.cuidados.includes(c));
        if (!apto) continue;
        const retiro = primerRetiro(new Date(ahora.getTime() + s.anticipacionHoras * 3600_000), s.ventana);
        const horasViaje = Math.round((km / s.velocidadKmh + (s.horasOperativas ?? 1)) * 10) / 10;
        const entrega = new Date(retiro.getTime() + horasViaje * 3600_000);
        if (entrega > limite) continue;
        const precio = Math.round(Math.max(s.tarifa.minimo ?? 0, s.tarifa.base + s.tarifa.porKm * km + s.tarifa.porKg * pedido.pesoKg));
        cotizaciones.push({ referencia: s.id, servicio: s.nombre, vehiculo: s.vehiculo, distanciaKm: km, horasViaje, retiro: retiro.toISOString(), entrega: entrega.toISOString(), moneda: "ARS", precio });
      }
      return cotizaciones;
    },
    async reservar(pedido, cotizacion, { ahora }) {
      const referencia = `${datos.id.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const hitos: Hito[] = [{ cuando: ahora.toISOString(), estado: "reservada", donde: pedido.origen.localidad.nombre, detalle: `Reserva tomada para ${cotizacion.servicio}` }];
      reservas.set(referencia, hitos);
      return { referencia, hitos };
    },
    async seguimiento(referencia, { ahora }) {
      const hitos = reservas.get(referencia) ?? [];
      void ahora;
      const estado: EstadoReserva = hitos.at(-1)?.estado ?? "reservada";
      return { estado, hitos };
    },
  };
}
