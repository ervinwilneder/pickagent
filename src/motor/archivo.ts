/**
 * Almacén en un archivo JSON: lo mismo que el de memoria, pero sobrevive a los
 * reinicios. Escribe el archivo entero en cada cambio; alcanza de sobra para
 * un motor con cientos de reservas.
 */
import fs from "node:fs";
import path from "node:path";
import type { Oferta, Pedido, Reserva } from "./dominio.ts";
import type { Almacen } from "./puerto.ts";

interface Datos {
  pedidos: Record<string, Pedido>;
  ofertas: Record<string, Oferta>;
  reservas: Record<string, Reserva>;
}

export function almacenEnArchivo(ruta: string): Almacen {
  const datos: Datos = fs.existsSync(ruta) ? (JSON.parse(fs.readFileSync(ruta, "utf-8")) as Datos) : { pedidos: {}, ofertas: {}, reservas: {} };
  const guardar = () => {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(datos, null, 2));
  };
  return {
    async pedido(id) { return datos.pedidos[id]; },
    async guardarPedido(p) { datos.pedidos[p.id] = p; guardar(); },
    async oferta(id) { return datos.ofertas[id]; },
    async guardarOfertas(os) { for (const o of os) datos.ofertas[o.id] = o; guardar(); },
    async reserva(idOCodigo) { return datos.reservas[idOCodigo] ?? Object.values(datos.reservas).find((r) => r.codigo === idOCodigo); },
    async reservas() { return Object.values(datos.reservas); },
    async guardarReserva(r) { datos.reservas[r.id] = r; guardar(); },
  };
}
