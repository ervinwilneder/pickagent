/** Almacén en memoria, y los transportistas de ejemplo con los que arranca el motor. */
import type { Oferta, Pedido, Reserva } from "./dominio.ts";
import type { Almacen } from "./puerto.ts";
import { transportistaPorCatalogo } from "./transportistas/catalogo.ts";
import { clienteAndreaniSimulado, clientePickitSimulado, transportistaConectado } from "./transportistas/conectado.ts";
import { Registro } from "./transportistas/registro.ts";

export function almacenEnMemoria(): Almacen {
  const pedidos = new Map<string, Pedido>();
  const ofertas = new Map<string, Oferta>();
  const reservas = new Map<string, Reserva>();
  return {
    async pedido(id) { return pedidos.get(id); },
    async guardarPedido(p) { pedidos.set(p.id, p); },
    async oferta(id) { return ofertas.get(id); },
    async guardarOfertas(os) { for (const o of os) ofertas.set(o.id, o); },
    async reserva(idOCodigo) { return reservas.get(idOCodigo) ?? [...reservas.values()].find((r) => r.codigo === idOCodigo); },
    async reservas() { return [...reservas.values()]; },
    async guardarReserva(r) { reservas.set(r.id, r); },
  };
}

/**
 * Los transportistas de ejemplo: tres por catálogo (fletes y camiones) y dos
 * conectados (Andreani y Pickit, simulados). Los cobros coinciden con los
 * contactos de la cuenta de ejemplo de belo.
 */
export function registroDeEjemplo(): Registro {
  return new Registro([
    transportistaPorCatalogo({
      id: "rapidito", nombre: "Rapidito Mensajería", calificacion: 4.6, cobro: { addressType: "BELOTAG", address: "vassa" }, descuentoBelo: 0.1, contraEntrega: true,
      servicios: [
        { id: "moto-amba", nombre: "Moto express AMBA", vehiculo: "moto", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 3500, porKm: 180, porKg: 0 }, capacidad: { kg: 8, m3: 0.05 }, ventana: { desde: 8, hasta: 21 }, anticipacionHoras: 1, cuidados: ["fragil"], velocidadKmh: 28, horasOperativas: 0.5 },
        { id: "util-amba", nombre: "Utilitario AMBA", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 14000, porKm: 420, porKg: 15 }, capacidad: { kg: 600, m3: 4 }, ventana: { desde: 7, hasta: 19 }, anticipacionHoras: 3, cuidados: ["fragil"], velocidadKmh: 25 },
      ],
    }),
    transportistaPorCatalogo({
      id: "cargas-del-sur", nombre: "Cargas del Sur", calificacion: 4.4, cobro: { addressType: "BELOTAG", address: "anibio2627" }, descuentoBelo: 0.08, contraEntrega: true,
      servicios: [
        { id: "camionchico-amba", nombre: "Camión chico AMBA a depósito", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["AMBA"] }, tarifa: { base: 26000, porKm: 520, porKg: 10 }, capacidad: { kg: 2500, m3: 16 }, ventana: { desde: 6, hasta: 18 }, anticipacionHoras: 2, cuidados: ["fragil"], velocidadKmh: 24, deposito: { destino: true } },
        { id: "util-interior", nombre: "Utilitario al interior", vehiculo: "utilitario", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 38000, porKm: 520, porKg: 35 }, capacidad: { kg: 700, m3: 4.5 }, ventana: { desde: 5, hasta: 12 }, anticipacionHoras: 18, cuidados: ["fragil"], velocidadKmh: 70 },
      ],
    }),
    transportistaPorCatalogo({
      id: "ruta-pampa", nombre: "Ruta Pampa Transportes", calificacion: 4.7, cobro: { addressType: "CVU", address: "0000003100066397779989" }, descuentoBelo: 0.12, contraEntrega: true,
      servicios: [
        { id: "camion-interior", nombre: "Camión consolidado al interior", vehiculo: "camion", cobertura: { origenes: ["AMBA", "Rosario", "Córdoba"], destinos: ["interior", "AMBA"] }, tarifa: { base: 60000, porKm: 480, porKg: 28, minimo: 90000 }, capacidad: { kg: 8000, m3: 45 }, ventana: { desde: 6, hasta: 16 }, anticipacionHoras: 24, cuidados: ["fragil"], velocidadKmh: 65, horasOperativas: 2, deposito: { destino: true } },
        { id: "camionchico-interior", nombre: "Camión chico directo al interior", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 52000, porKm: 610, porKg: 30 }, capacidad: { kg: 2500, m3: 16 }, ventana: { desde: 5, hasta: 14 }, anticipacionHoras: 12, cuidados: ["fragil"], velocidadKmh: 75 },
        { id: "frio-interior", nombre: "Refrigerado al interior", vehiculo: "camion_chico", cobertura: { origenes: ["AMBA"], destinos: ["interior"] }, tarifa: { base: 95000, porKm: 820, porKg: 55 }, capacidad: { kg: 3000, m3: 18 }, ventana: { desde: 4, hasta: 10 }, anticipacionHoras: 24, cuidados: ["refrigerado", "fragil"], velocidadKmh: 70 },
      ],
    }),
    transportistaPorCatalogo({
      id: "rosario-express", nombre: "Rosario Express", calificacion: 4.5, cobro: { addressType: "CVU", address: "0000003100099988877766" }, descuentoBelo: 0.1, contraEntrega: true,
      servicios: [
        { id: "util-rosario", nombre: "Utilitario última milla Rosario", vehiculo: "utilitario", cobertura: { origenes: ["Rosario"], destinos: ["Rosario"] }, tarifa: { base: 9000, porKm: 400, porKg: 12 }, capacidad: { kg: 700, m3: 4.5 }, ventana: { desde: 7, hasta: 20 }, anticipacionHoras: 1, cuidados: ["fragil"], velocidadKmh: 25 },
      ],
    }),
    transportistaConectado({ id: "andreani", nombre: "Andreani", calificacion: 4.5, cobro: { addressType: "CVU", address: "0000003100072524561404" }, descuentoBelo: 0.06, cliente: clienteAndreaniSimulado() }),
    transportistaConectado({ id: "pickit", nombre: "Pickit", calificacion: 4.3, cobro: { addressType: "BELOTAG", address: "vassa" }, descuentoBelo: 0.1, capacidades: { etiqueta: true }, cliente: clientePickitSimulado() }),
  ]);
}
