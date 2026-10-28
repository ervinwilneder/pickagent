/**
 * El dominio de la logística, en los términos del rubro.
 *
 * Un envío nace como un Pedido (qué, de dónde, a dónde, para cuándo), recibe
 * Ofertas: cadenas de uno o dos Tramos, cada uno con su Transportista, su
 * precio y sus productos adjuntos (seguro, entrega a tiempo). Una se convierte
 * en Reserva, con cada tramo reservado y liquidado por separado, y avanza por
 * Hitos hasta la entrega.
 */

export type Vehiculo = "moto" | "utilitario" | "camion_chico" | "camion" | "red_sucursales";
export type Cuidado = "fragil" | "refrigerado" | "peligroso";
export type EstadoReserva = "reservada" | "pagada" | "retirada" | "en_viaje" | "entregada" | "cancelada" | "con_problemas";
/**
 * Cuándo y cómo se paga: por adelantado con una transferencia belo, o contra
 * entrega con belo air (solo ofertas de un tramo): el chofer pide el monto
 * exacto desde su belo, la persona acerca su teléfono, revisa y confirma.
 */
export type ModoPago = "anticipado" | "contra_entrega_belo_air";

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
  /** Valor declarado, para el seguro por tramo, opcional. */
  valorDeclarado?: number;
  contacto: string;
  notas?: string;
  creado: string;
}

/** Lo que un transportista responde a un pedido, antes de ser un tramo de una oferta. */
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
  /** El servicio entrega en el depósito del transportista en destino: necesita una última milla. */
  entregaEnDeposito?: boolean;
}

export type TipoAdjunto = "seguro" | "entrega_a_tiempo";

/** Un producto que se suma a un tramo, con su precio. */
export interface Adjunto {
  tipo: TipoAdjunto;
  nombre: string;
  precio: number;
  detalle: string;
  /** Seguro: valor cubierto. */
  cobertura?: number;
  /** Entrega a tiempo: lo que se devuelve si el tramo cierra tarde. */
  compensacion?: number;
}

export interface AdjuntoElegido {
  tramo: number;
  tipo: TipoAdjunto;
}

export interface TransportistaResumen {
  id: string;
  nombre: string;
  calificacion: number;
  modo: "catalogo" | "conectado";
}

/** Un eslabón de la oferta: un transportista lleva la carga de `desde` a `hasta`. */
export interface Tramo extends Cotizacion {
  n: number;
  tipo: "directo" | "linea" | "ultima_milla";
  desde: Punto;
  hasta: Punto;
  transportista: TransportistaResumen;
  descuentoBelo: number;
  precioBelo: number;
  adjuntosDisponibles: Adjunto[];
}

export interface Oferta {
  id: string;
  pedidoId: string;
  tramos: Tramo[];
  /** Suma de lista y suma con belo de los tramos; los adjuntos se suman al elegir. */
  precio: number;
  precioBelo: number;
  retiro: string;
  entrega: string;
  /** Solo ofertas de un tramo cuyo transportista cobra con belo air. */
  contraEntrega: boolean;
}

export interface Hito {
  cuando: string;
  estado: EstadoReserva;
  donde?: string;
  detalle: string;
}

/** El punto de cobro de Spotme donde el chofer cierra el tramo y cobra el neto. */
export interface PuntoDeCobro {
  hotspotId: string;
  enlace: string;
  codigo: string;
  reclamadoEn?: string;
  pagado: boolean;
  transaccionId?: string;
}

export interface TramoReservado {
  tramo: Tramo;
  /** Referencia de la reserva en el transportista (su número de envío u orden). */
  referencia: string;
  etiquetaUrl?: string;
  adjuntos: Adjunto[];
  /**
   * Lo que pickagent y el transportista se deben por este tramo: si cobró
   * pickagent, le debe el neto (precio con belo menos la comisión); si cobró el
   * transportista en mano, le debe a pickagent la comisión. Se salda por el
   * punto de cobro de Spotme o, si no lo hay, en la liquidación por lote.
   */
  liquidacion: { comision: number; neto: number; aPagarAlTransportista: number; aCobrarAlTransportista: number; estado: "pendiente" | "liquidada"; transaccionId?: string; cuando?: string };
  puntoDeCobro?: PuntoDeCobro;
}

export interface Reserva {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  pedido: Pedido;
  oferta: Oferta;
  tramos: TramoReservado[];
  /** Lo que paga el cliente: tramos con belo más adjuntos elegidos. */
  cobro: { monto: number; moneda: "ARS"; modo: ModoPago; cobradoPor: "pickagent" | "transportista"; destinatario: { nombre: string; addressType: "BELOTAG" | "CVU" | "ALIAS"; address: string } };
  pago?: { transaccionId: string; monto: string; cuando: string };
  hitos: Hito[];
  creada: string;
  actualizada: string;
}

export const vehiculoLegible: Record<Vehiculo, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión", red_sucursales: "red de sucursales" };
export const modoPagoLegible: Record<ModoPago, string> = { anticipado: "por adelantado con belo", contra_entrega_belo_air: "contra entrega con belo air (acercando los teléfonos)" };
export const estadoLegible: Record<EstadoReserva, string> = { reservada: "reservada", pagada: "pagada", retirada: "retirada", en_viaje: "en viaje", entregada: "entregada", cancelada: "cancelada", con_problemas: "con problemas" };
export const tipoTramoLegible: Record<Tramo["tipo"], string> = { directo: "puerta a puerta", linea: "hasta el depósito", ultima_milla: "última milla" };
export const adjuntoLegible: Record<TipoAdjunto, string> = { seguro: "seguro del tramo", entrega_a_tiempo: "entrega a tiempo" };
