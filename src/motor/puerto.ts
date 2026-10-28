/**
 * Los dos puertos del motor.
 *
 * `Transportista` es lo que una empresa de logística implementa para sumarse:
 * cotizar un pedido, reservar una cotización y seguir una reserva. Puede ser
 * un catálogo (el motor cotiza con sus tarifas) o una conexión a su propia
 * API (Andreani, Pickit, la que sea). El motor no distingue: consulta a todos.
 *
 * `Almacen` guarda pedidos, ofertas y reservas.
 */
import type { Cotizacion, EstadoReserva, Hito, Oferta, Pedido, Reserva } from "./dominio.ts";

export interface Transportista {
  id: string;
  nombre: string;
  modo: "catalogo" | "conectado";
  calificacion: number;
  /** Dónde cobra por belo. */
  cobro: { addressType: "BELOTAG" | "CVU" | "ALIAS"; address: string };
  /** Descuento para quien paga por belo, como fracción. */
  descuentoBelo: number;
  /** `contraEntrega`: el chofer cobra en el momento con belo Air, de teléfono a teléfono. */
  capacidades: { reserva: boolean; seguimiento: boolean; etiqueta: boolean; contraEntrega: boolean };
  /** Devuelve ninguna, una o varias cotizaciones. No tira si no puede: devuelve []. */
  cotizar(pedido: Pedido, contexto: Contexto): Promise<Cotizacion[]>;
  /** Reserva una cotización y devuelve la referencia del transportista. */
  reservar(pedido: Pedido, cotizacion: Cotizacion, contexto: Contexto): Promise<{ referencia: string; etiquetaUrl?: string; hitos?: Hito[] }>;
  /** Estado y hitos de una reserva por su referencia. */
  seguimiento(referencia: string, contexto: Contexto): Promise<{ estado: EstadoReserva; hitos: Hito[] }>;
}

export interface Contexto {
  ahora: Date;
}

/** La cuenta de belo de pickagent: a dónde le paga el cliente. Sale de la configuración. */
export interface CuentaPickagent {
  nombre: string;
  belotag: string;
  cvu?: string;
  /** Comisión de pickagent sobre el precio con belo, como fracción. */
  comision: number;
}

export interface Almacen {
  pedido(id: string): Promise<Pedido | undefined>;
  guardarPedido(p: Pedido): Promise<void>;
  oferta(id: string): Promise<Oferta | undefined>;
  guardarOfertas(ofertas: Oferta[]): Promise<void>;
  reserva(idOCodigo: string): Promise<Reserva | undefined>;
  reservas(): Promise<Reserva[]>;
  guardarReserva(r: Reserva): Promise<void>;
}
