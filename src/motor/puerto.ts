/** Puerto de almacenamiento del motor. */
import type { Oferta, Pedido, Proveedor, Reserva, Servicio } from "./dominio.ts";

export interface Almacen {
  proveedores(): Promise<Proveedor[]>;
  proveedor(id: string): Promise<Proveedor | undefined>;
  guardarProveedor(p: Proveedor): Promise<void>;
  servicios(): Promise<Servicio[]>;
  guardarServicio(s: Servicio): Promise<void>;
  pedido(id: string): Promise<Pedido | undefined>;
  guardarPedido(p: Pedido): Promise<void>;
  oferta(id: string): Promise<Oferta | undefined>;
  guardarOfertas(ofertas: Oferta[]): Promise<void>;
  reserva(idOCodigo: string): Promise<Reserva | undefined>;
  reservas(): Promise<Reserva[]>;
  guardarReserva(r: Reserva): Promise<void>;
}
