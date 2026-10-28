/**
 * El dominio de la logística, en los términos del rubro.
 *
 * Un envío nace como un Pedido (qué, de dónde, a dónde, para cuándo), recibe
 * Ofertas de los Transportistas (precio, retiro y entrega estimados), una se
 * convierte en Reserva, y la Reserva avanza por Hitos hasta la entrega.
 */

export type Vehiculo = "moto" | "utilitario" | "camion_chico" | "camion" | "red_sucursales";
export type Cuidado = "fragil" | "refrigerado" | "peligroso";
export type EstadoReserva = "reservada" | "pagada" | "retirada" | "en_viaje" | "entregada" | "cancelada" | "con_problemas";

export interface Localidad {
  nombre: string;
  provincia: string;
  zona: "AMBA" | "interior";
  codigoPostal: string;
  lat: number;
  lon: number;
}

/** Un punto del envío: la localidad resuelta más lo que la persona escribió. */
export interface Punto {
  texto: string;
  localidad: Localidad;
  direccion?: string;
}

export interface Pedido {
  id: string;
  origen: Punto;
  destino: Punto;
  /** Hora límite de entrega, ISO 8601. */
  fechaLimite: string;
  mercaderia: string;
  pesoKg: number;
  volumenM3: number;
  cuidados: Cuidado[];
  /** Valor declarado, para seguro, opcional. */
  valorDeclarado?: number;
  contacto: string;
  notas?: string;
  creado: string;
}

/** Lo que un transportista responde a un pedido, antes de ser una oferta del motor. */
export interface Cotizacion {
  /** Referencia del transportista para esta cotización (su id de tarifa, contrato o quote). */
  referencia: string;
  servicio: string;
  vehiculo: Vehiculo;
  distanciaKm: number;
  horasViaje: number;
  retiro: string;
  entrega: string;
  moneda: "ARS";
  precio: number;
  /** Algo que la persona debe saber: punto de retiro, franja, seguro incluido. */
  condiciones?: string[];
}

export interface Oferta extends Cotizacion {
  id: string;
  pedidoId: string;
  transportista: { id: string; nombre: string; calificacion: number; modo: "catalogo" | "conectado" };
  descuentoBelo: number;
  precioBelo: number;
}

export interface Hito {
  cuando: string;
  estado: EstadoReserva;
  donde?: string;
  detalle: string;
}

export interface Reserva {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  pedido: Pedido;
  oferta: Oferta;
  /** Referencia de la reserva en el transportista (su número de envío u orden). */
  referencia: string;
  etiquetaUrl?: string;
  cobro: { monto: number; moneda: "ARS"; destinatario: { nombre: string; addressType: "BELOTAG" | "CVU" | "ALIAS"; address: string } };
  pago?: { transaccionId: string; monto: string; cuando: string };
  hitos: Hito[];
  creada: string;
  actualizada: string;
}

export const vehiculoLegible: Record<Vehiculo, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión", red_sucursales: "red de sucursales" };
export const estadoLegible: Record<EstadoReserva, string> = { reservada: "reservada", pagada: "pagada", retirada: "retirada", en_viaje: "en viaje", entregada: "entregada", cancelada: "cancelada", con_problemas: "con problemas" };
