/** El dominio de la logística, en los términos del rubro. */

export type Vehiculo = "moto" | "utilitario" | "camion_chico" | "camion";
export type Aptitud = "fragil" | "refrigerado";
export type EstadoReserva = "reservada" | "pagada" | "en_curso" | "entregada" | "cancelada";

export interface Localidad {
  nombre: string;
  provincia: string;
  zona: "AMBA" | "interior";
  lat: number;
  lon: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
  /** Dónde cobra por belo: belotag (interno, sin comisión) o CVU/alias. */
  cobro: { addressType: "BELOTAG" | "CVU" | "ALIAS"; address: string };
  /** Descuento que ofrece a quien paga por belo, como fracción (0.08 = 8 %). */
  descuentoBelo: number;
  calificacion: number;
}

export interface Servicio {
  id: string;
  proveedorId: string;
  nombre: string;
  vehiculo: Vehiculo;
  /** Localidades o zonas ("AMBA", "interior", "*") que cubre como origen y como destino. */
  cobertura: { origenes: string[]; destinos: string[] };
  tarifa: { base: number; porKm: number; porKg: number };
  capacidad: { kg: number; m3: number };
  /** Ventana horaria de retiro, en hora local. */
  ventana: { desde: number; hasta: number };
  anticipacionHoras: number;
  aptitudes: Aptitud[];
  velocidadKmh: number;
}

export interface Pedido {
  id: string;
  origen: string;
  destino: string;
  /** Hora límite de entrega, ISO 8601. */
  fechaLimite: string;
  mercaderia: string;
  pesoKg: number;
  volumenM3: number;
  fragil: boolean;
  refrigerado: boolean;
  contacto: string;
  notas?: string;
  creado: string;
}

export interface Oferta {
  id: string;
  pedidoId: string;
  servicioId: string;
  proveedor: { id: string; nombre: string; calificacion: number };
  servicio: string;
  vehiculo: Vehiculo;
  distanciaKm: number;
  horasViaje: number;
  retiro: string;
  entrega: string;
  moneda: "ARS";
  precio: number;
  descuentoBelo: number;
  precioBelo: number;
}

export interface Reserva {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  pedido: Pedido;
  oferta: Oferta;
  cobro: { monto: number; moneda: "ARS"; destinatario: Proveedor["cobro"] & { nombre: string } };
  pago?: { transaccionId: string; monto: string; cuando: string };
  creada: string;
  actualizada: string;
}

export const vehiculoLegible: Record<Vehiculo, string> = { moto: "moto", utilitario: "utilitario", camion_chico: "camión chico", camion: "camión" };
