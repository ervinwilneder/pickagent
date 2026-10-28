/**
 * Transportista conectado: una empresa con API propia se suma implementando
 * un cliente con tres llamadas (cotizar, crear envío, seguir). Este módulo
 * traduce entre el dominio del motor y el de la empresa, y aísla las fallas.
 *
 * Los clientes de Andreani y Pickit de abajo son simulados: reproducen la
 * forma de sus APIs (cotización por código postal, orden de envío, tracking
 * por número) con datos deterministas, y marcan dónde va el cliente HTTP
 * real cuando haya credenciales.
 */
import { randomUUID } from "node:crypto";
import type { Cotizacion, EstadoReserva, Hito, Pedido } from "../dominio.ts";
import { distanciaKm } from "../localidades.ts";
import type { Contexto, Transportista } from "../puerto.ts";

/** Lo que una empresa implementa para conectarse. Todo en sus propios términos. */
export interface ClienteDeTransportista {
  cotizar(envio: EnvioParaCotizar, contexto: Contexto): Promise<CotizacionExterna[]>;
  crearEnvio(envio: EnvioParaCotizar, cotizacion: CotizacionExterna, contexto: Contexto): Promise<{ numero: string; etiquetaUrl?: string }>;
  seguir(numero: string, contexto: Contexto): Promise<{ estado: EstadoReserva; hitos: Hito[] }>;
}

export interface EnvioParaCotizar {
  codigoPostalOrigen: string;
  codigoPostalDestino: string;
  localidadOrigen: string;
  localidadDestino: string;
  pesoKg: number;
  volumenM3: number;
  valorDeclarado?: number;
  entregarAntesDe: string;
  cuidados: string[];
}

export interface CotizacionExterna {
  referencia: string;
  servicio: string;
  vehiculo: Cotizacion["vehiculo"];
  precio: number;
  retiro: string;
  entrega: string;
  condiciones?: string[];
}

export interface DatosDeConectado {
  id: string;
  nombre: string;
  calificacion: number;
  cobro: Transportista["cobro"];
  descuentoBelo: number;
  capacidades?: Partial<Transportista["capacidades"]>;
  cliente: ClienteDeTransportista;
  /** Plazo por llamada a la API de la empresa. */
  plazoMs?: number;
}

const conPlazo = <T>(p: Promise<T>, ms: number, que: string) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${que} no respondió en ${ms / 1000} s`)), ms))]);

export function transportistaConectado(datos: DatosDeConectado): Transportista {
  const plazo = datos.plazoMs ?? 4_000;
  const envio = (p: Pedido): EnvioParaCotizar => ({
    codigoPostalOrigen: p.origen.localidad.codigoPostal,
    codigoPostalDestino: p.destino.localidad.codigoPostal,
    localidadOrigen: p.origen.localidad.nombre,
    localidadDestino: p.destino.localidad.nombre,
    pesoKg: p.pesoKg,
    volumenM3: p.volumenM3,
    valorDeclarado: p.valorDeclarado,
    entregarAntesDe: p.fechaLimite,
    cuidados: p.cuidados,
  });
  return {
    id: datos.id,
    nombre: datos.nombre,
    modo: "conectado",
    calificacion: datos.calificacion,
    cobro: datos.cobro,
    descuentoBelo: datos.descuentoBelo,
    capacidades: { reserva: true, seguimiento: true, etiqueta: true, contraEntrega: false, ...datos.capacidades },
    async cotizar(pedido, contexto) {
      const km = distanciaKm(pedido.origen.localidad, pedido.destino.localidad);
      const limite = new Date(pedido.fechaLimite);
      const externas = await conPlazo(datos.cliente.cotizar(envio(pedido), contexto), plazo, `${datos.nombre} (cotizar)`);
      return externas
        .filter((c) => new Date(c.entrega) <= limite)
        .map((c) => ({ referencia: c.referencia, servicio: c.servicio, vehiculo: c.vehiculo, distanciaKm: km, horasViaje: Math.round(((new Date(c.entrega).getTime() - new Date(c.retiro).getTime()) / 3600_000) * 10) / 10, retiro: c.retiro, entrega: c.entrega, moneda: "ARS" as const, precio: Math.round(c.precio), condiciones: c.condiciones }));
    },
    async reservar(pedido, cotizacion, contexto) {
      const externa: CotizacionExterna = { referencia: cotizacion.referencia, servicio: cotizacion.servicio, vehiculo: cotizacion.vehiculo, precio: cotizacion.precio, retiro: cotizacion.retiro, entrega: cotizacion.entrega, condiciones: cotizacion.condiciones };
      const r = await conPlazo(datos.cliente.crearEnvio(envio(pedido), externa, contexto), plazo, `${datos.nombre} (crear envío)`);
      return { referencia: r.numero, etiquetaUrl: r.etiquetaUrl, hitos: [{ cuando: contexto.ahora.toISOString(), estado: "reservada", donde: pedido.origen.localidad.nombre, detalle: `Envío ${r.numero} creado en ${datos.nombre}` }] };
    },
    seguimiento(referencia, contexto) {
      return conPlazo(datos.cliente.seguir(referencia, contexto), plazo, `${datos.nombre} (seguimiento)`);
    },
  };
}

/* ---------- Clientes simulados con la forma de las APIs reales ---------- */

const diasHabiles = (desde: Date, dias: number) => {
  const d = new Date(desde);
  let faltan = dias;
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) faltan--;
  }
  d.setUTCHours(21, 0, 0, 0); // 18:00 de Argentina
  return d;
};

/**
 * Andreani: cotiza por código postal de origen y destino, peso y volumen,
 * sobre contratos (estándar, prioritario, sucursal); crea una orden de envío
 * y devuelve número y etiqueta; trackea por número. Cuando haya credenciales,
 * `ANDREANI_API_KEY` y la URL de su API reemplazan a estas simulaciones.
 */
export function clienteAndreaniSimulado(): ClienteDeTransportista {
  const envios = new Map<string, { creado: Date; destino: string }>();
  return {
    async cotizar(e, { ahora }) {
      if (e.pesoKg > 50 || e.volumenM3 > 0.5) return []; // paquetería: hasta 50 kg por bulto
      const mismaZona = e.codigoPostalOrigen.slice(0, 1) === e.codigoPostalDestino.slice(0, 1);
      const base = mismaZona ? 7900 : 14500;
      const porKg = mismaZona ? 320 : 690;
      const vol = Math.round(e.volumenM3 * 1000 * 18); // tarifa volumétrica
      const estandar = Math.max(base + porKg * e.pesoKg, vol);
      const retiro = new Date(ahora.getTime() + 24 * 3600_000);
      return [
        { referencia: "contrato-estandar", servicio: "Andreani Estándar a domicilio", vehiculo: "red_sucursales", precio: estandar, retiro: retiro.toISOString(), entrega: diasHabiles(retiro, mismaZona ? 2 : 4).toISOString(), condiciones: ["seguro incluido hasta el valor declarado", "retiro en domicilio con colecta programada"] },
        { referencia: "contrato-prioritario", servicio: "Andreani Prioritario", vehiculo: "red_sucursales", precio: Math.round(estandar * 1.45), retiro: retiro.toISOString(), entrega: diasHabiles(retiro, mismaZona ? 1 : 2).toISOString(), condiciones: ["seguro incluido", "entrega antes de las 18"] },
        { referencia: "contrato-sucursal", servicio: "Andreani a sucursal", vehiculo: "red_sucursales", precio: Math.round(estandar * 0.8), retiro: retiro.toISOString(), entrega: diasHabiles(retiro, mismaZona ? 2 : 3).toISOString(), condiciones: ["la persona retira en la sucursal más cercana al destino"] },
      ];
    },
    async crearEnvio(e, c, { ahora }) {
      const numero = `3600${Math.floor(100000000 + Math.random() * 899999999)}`;
      envios.set(numero, { creado: ahora, destino: e.localidadDestino });
      void c;
      return { numero, etiquetaUrl: `https://etiquetas.andreani.example/${numero}.pdf` };
    },
    async seguir(numero, { ahora }) {
      const e = envios.get(numero);
      if (!e) throw new Error("Andreani no encuentra ese envío");
      const horas = (ahora.getTime() - e.creado.getTime()) / 3600_000;
      const hitos: Hito[] = [{ cuando: e.creado.toISOString(), estado: "reservada", detalle: "Orden de envío creada" }];
      if (horas > 24) hitos.push({ cuando: new Date(e.creado.getTime() + 24 * 3600_000).toISOString(), estado: "retirada", detalle: "Colecta realizada" });
      if (horas > 36) hitos.push({ cuando: new Date(e.creado.getTime() + 36 * 3600_000).toISOString(), estado: "en_viaje", donde: "Planta Benavídez", detalle: `En camino a ${e.destino}` });
      return { estado: hitos.at(-1)!.estado, hitos };
    },
  };
}

/**
 * Pickit: red de puntos de retiro y entrega; cotiza por código postal y peso,
 * ofrece entrega en punto Pickit (más barata) o a domicilio; crea el envío y
 * trackea por código. `PICKIT_API_KEY` y su URL reemplazan a la simulación.
 */
export function clientePickitSimulado(): ClienteDeTransportista {
  const envios = new Map<string, Date>();
  return {
    async cotizar(e, { ahora }) {
      if (e.pesoKg > 25 || e.volumenM3 > 0.25 || e.cuidados.includes("refrigerado")) return [];
      const base = 5200 + 410 * e.pesoKg;
      const lejos = e.codigoPostalOrigen.slice(0, 1) !== e.codigoPostalDestino.slice(0, 1);
      const retiro = new Date(ahora.getTime() + 6 * 3600_000);
      return [
        { referencia: "punto-pickit", servicio: "Pickit a punto de retiro", vehiculo: "red_sucursales", precio: Math.round(base * (lejos ? 1.6 : 1)), retiro: retiro.toISOString(), entrega: diasHabiles(retiro, lejos ? 3 : 1).toISOString(), condiciones: ["la persona retira en un punto Pickit con el código", "disponible 5 días en el punto"] },
        { referencia: "domicilio", servicio: "Pickit a domicilio", vehiculo: "red_sucursales", precio: Math.round(base * (lejos ? 2.1 : 1.35)), retiro: retiro.toISOString(), entrega: diasHabiles(retiro, lejos ? 3 : 2).toISOString() },
      ];
    },
    async crearEnvio(e, c, { ahora }) {
      const numero = `PK${randomUUID().slice(0, 8).toUpperCase()}`;
      envios.set(numero, ahora);
      void e;
      void c;
      return { numero, etiquetaUrl: `https://pickit.example/etiquetas/${numero}` };
    },
    async seguir(numero, { ahora }) {
      const creado = envios.get(numero);
      if (!creado) throw new Error("Pickit no encuentra ese código");
      const horas = (ahora.getTime() - creado.getTime()) / 3600_000;
      const hitos: Hito[] = [{ cuando: creado.toISOString(), estado: "reservada", detalle: "Envío creado" }];
      if (horas > 6) hitos.push({ cuando: new Date(creado.getTime() + 6 * 3600_000).toISOString(), estado: "retirada", detalle: "Ingresó a la red Pickit" });
      return { estado: hitos.at(-1)!.estado, hitos };
    },
  };
}
