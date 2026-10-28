/** Almacén en memoria con los proveedores y servicios de ejemplo. */
import type { Oferta, Pedido, Proveedor, Reserva, Servicio } from "./dominio.ts";
import type { Almacen } from "./puerto.ts";

export function almacenEnMemoria(): Almacen {
  const proveedores = new Map<string, Proveedor>();
  const servicios = new Map<string, Servicio>();
  const pedidos = new Map<string, Pedido>();
  const ofertas = new Map<string, Oferta>();
  const reservas = new Map<string, Reserva>();

  for (const p of proveedoresDeEjemplo) proveedores.set(p.id, p);
  for (const s of serviciosDeEjemplo) servicios.set(s.id, s);

  return {
    async proveedores() { return [...proveedores.values()]; },
    async proveedor(id) { return proveedores.get(id); },
    async guardarProveedor(p) { proveedores.set(p.id, p); },
    async servicios() { return [...servicios.values()]; },
    async guardarServicio(s) { servicios.set(s.id, s); },
    async pedido(id) { return pedidos.get(id); },
    async guardarPedido(p) { pedidos.set(p.id, p); },
    async oferta(id) { return ofertas.get(id); },
    async guardarOfertas(os) { for (const o of os) ofertas.set(o.id, o); },
    async reserva(idOCodigo) { return reservas.get(idOCodigo) ?? [...reservas.values()].find((r) => r.codigo === idOCodigo); },
    async reservas() { return [...reservas.values()]; },
    async guardarReserva(r) { reservas.set(r.id, r); },
  };
}

/** Los belotags y CVU de cobro coinciden con los contactos de la cuenta de ejemplo de belo. */
const proveedoresDeEjemplo: Proveedor[] = [
  { id: "p-rapidito", nombre: "Rapidito Mensajería", cobro: { addressType: "BELOTAG", address: "vassa" }, descuentoBelo: 0.1, calificacion: 4.6 },
  { id: "p-cargas-sur", nombre: "Cargas del Sur", cobro: { addressType: "BELOTAG", address: "anibio2627" }, descuentoBelo: 0.08, calificacion: 4.4 },
  { id: "p-ruta-pampa", nombre: "Ruta Pampa Transportes", cobro: { addressType: "CVU", address: "0000003100066397779989" }, descuentoBelo: 0.12, calificacion: 4.7 },
  { id: "p-frio-andino", nombre: "Frío Andino", cobro: { addressType: "CVU", address: "0000003100072524561404" }, descuentoBelo: 0.05, calificacion: 4.8 },
  { id: "p-flete-ya", nombre: "FleteYa", cobro: { addressType: "BELOTAG", address: "vassa" }, descuentoBelo: 0.15, calificacion: 4.1 },
];

const serviciosDeEjemplo: Servicio[] = [
  { id: "s-moto-amba", proveedorId: "p-rapidito", nombre: "Moto express AMBA", vehiculo: "moto", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 3500, porKm: 180, porKg: 0 }, capacidad: { kg: 8, m3: 0.05 }, ventana: { desde: 8, hasta: 21 }, anticipacionHoras: 1, aptitudes: ["fragil"], velocidadKmh: 28 },
  { id: "s-util-amba", proveedorId: "p-rapidito", nombre: "Utilitario AMBA", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 14000, porKm: 420, porKg: 15 }, capacidad: { kg: 600, m3: 4 }, ventana: { desde: 7, hasta: 19 }, anticipacionHoras: 3, aptitudes: ["fragil"], velocidadKmh: 25 },
  { id: "s-flete-amba", proveedorId: "p-flete-ya", nombre: "Flete utilitario", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 11000, porKm: 480, porKg: 20 }, capacidad: { kg: 500, m3: 3.5 }, ventana: { desde: 9, hasta: 18 }, anticipacionHoras: 4, aptitudes: [], velocidadKmh: 22 },
  { id: "s-camionchico-amba", proveedorId: "p-cargas-sur", nombre: "Camión chico AMBA", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 32000, porKm: 650, porKg: 12 }, capacidad: { kg: 2500, m3: 16 }, ventana: { desde: 6, hasta: 18 }, anticipacionHoras: 12, aptitudes: ["fragil"], velocidadKmh: 24 },
  { id: "s-util-interior", proveedorId: "p-cargas-sur", nombre: "Utilitario al interior", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 38000, porKm: 520, porKg: 35 }, capacidad: { kg: 700, m3: 4.5 }, ventana: { desde: 5, hasta: 12 }, anticipacionHoras: 18, aptitudes: ["fragil"], velocidadKmh: 70 },
  { id: "s-camion-interior", proveedorId: "p-ruta-pampa", nombre: "Camión consolidado al interior", vehiculo: "camion", cobertura: { origenes: ["AMBA", "Rosario", "Córdoba"], destinos: ["interior", "AMBA"] }, tarifa: { base: 60000, porKm: 480, porKg: 28 }, capacidad: { kg: 8000, m3: 45 }, ventana: { desde: 6, hasta: 16 }, anticipacionHoras: 24, aptitudes: ["fragil"], velocidadKmh: 65 },
  { id: "s-camionchico-interior", proveedorId: "p-ruta-pampa", nombre: "Camión chico directo al interior", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 52000, porKm: 610, porKg: 30 }, capacidad: { kg: 2500, m3: 16 }, ventana: { desde: 5, hasta: 14 }, anticipacionHoras: 12, aptitudes: ["fragil"], velocidadKmh: 75 },
  { id: "s-frio-amba", proveedorId: "p-frio-andino", nombre: "Refrigerado AMBA", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 26000, porKm: 700, porKg: 40 }, capacidad: { kg: 800, m3: 5 }, ventana: { desde: 6, hasta: 20 }, anticipacionHoras: 6, aptitudes: ["refrigerado", "fragil"], velocidadKmh: 24 },
  { id: "s-frio-interior", proveedorId: "p-frio-andino", nombre: "Refrigerado al interior", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 95000, porKm: 820, porKg: 55 }, capacidad: { kg: 3000, m3: 18 }, ventana: { desde: 4, hasta: 10 }, anticipacionHoras: 24, aptitudes: ["refrigerado", "fragil"], velocidadKmh: 70 },
];
