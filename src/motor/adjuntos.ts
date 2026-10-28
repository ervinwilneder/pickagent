/**
 * Productos adjuntos a un tramo, con su precio. El riesgo es del tramo, no del
 * envío: asegurar 15 km en moto no cuesta lo mismo que 300 km en camión.
 * Valores de demo; se ajustan cuando haya aseguradora o datos.
 */
import type { Adjunto, AdjuntoElegido, Pedido, Tramo, Vehiculo } from "./dominio.ts";

export const TASA_SEGURO = 0.003;
export const FACTOR_VEHICULO: Record<Vehiculo, number> = { moto: 1.5, utilitario: 1.2, camion_chico: 1.1, camion: 1.0, red_sucursales: 0.8 };
export const FACTOR_DISTANCIA_LARGA = 1.3;
export const KM_LARGA = 200;
export const RECARGO_SLA = 0.05;
export const COMPENSACION_SLA = 0.2;

export function adjuntosPara(tramo: Pick<Tramo, "vehiculo" | "distanciaKm" | "precioBelo">, pedido: Pick<Pedido, "valorDeclarado">): Adjunto[] {
  const adjuntos: Adjunto[] = [];
  if (pedido.valorDeclarado) {
    const tasa = TASA_SEGURO * FACTOR_VEHICULO[tramo.vehiculo] * (tramo.distanciaKm > KM_LARGA ? FACTOR_DISTANCIA_LARGA : 1);
    adjuntos.push({
      tipo: "seguro",
      nombre: "Seguro del tramo",
      precio: Math.round(pedido.valorDeclarado * tasa),
      cobertura: pedido.valorDeclarado,
      detalle: `Cubre hasta ${pedido.valorDeclarado.toLocaleString("es-AR")} ARS en este tramo (${(tasa * 100).toFixed(2)} % del valor declarado).`,
    });
  }
  const compensacion = Math.round(tramo.precioBelo * COMPENSACION_SLA);
  adjuntos.push({
    tipo: "entrega_a_tiempo",
    nombre: "Entrega a tiempo",
    precio: Math.round(tramo.precioBelo * RECARGO_SLA),
    compensacion,
    detalle: `Si este tramo cierra después de la hora prometida, se te devuelven ${compensacion.toLocaleString("es-AR")} ARS.`,
  });
  return adjuntos;
}

/** Los adjuntos elegidos, resueltos contra los disponibles de cada tramo. */
export function resolverAdjuntos(elegidos: AdjuntoElegido[], tramos: Tramo[]): Map<number, Adjunto[]> {
  const porTramo = new Map<number, Adjunto[]>();
  for (const e of elegidos) {
    const tramo = tramos.find((t) => t.n === e.tramo);
    const adjunto = tramo?.adjuntosDisponibles.find((a) => a.tipo === e.tipo);
    if (!tramo || !adjunto) throw new Error(`El tramo ${e.tramo} no ofrece ${e.tipo}.`);
    const lista = porTramo.get(tramo.n) ?? [];
    if (!lista.some((a) => a.tipo === adjunto.tipo)) lista.push(adjunto);
    porTramo.set(tramo.n, lista);
  }
  return porTramo;
}
