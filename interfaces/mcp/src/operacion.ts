/**
 * Una operación cotizada, en los términos en que belo se la muestra a la
 * persona: qué va a pasar, de qué saldos sale, comisión, tipo de cambio y
 * hasta cuándo vale. Es lo que la vista "operación" renderiza y lo que el
 * modelo lee antes de pedir aprobación.
 */
import type { CotizacionPix, CotizacionSwap, CotizacionTransferencia } from "./belo/port.ts";

export type TipoOperacion = "transferencia" | "conversion" | "pix";

export interface Operacion {
  tipo: TipoOperacion;
  id: string;
  titulo: string;
  monto: string;
  moneda: string;
  destino: { nombre: string | null; detalle: string };
  debitos: { moneda: string; monto: string }[];
  comision: { monto: string; moneda: string } | null;
  tipoCambio: string | null;
  vence: string;
  /** Cómo volver a cotizar si venció: la misma tool con los mismos argumentos. */
  recotizar: { tool: string; arguments: Record<string, unknown> };
}

const moneda = (c: string) => (c === "ARGt" ? "ARS" : c);
const texto = (v: string | null | undefined) => v ?? "";
/** Si belo no informa vencimiento, se asume el de sus cotizaciones: 60 segundos. */
const vencimiento = (v: string | null | undefined) => v ?? new Date(Date.now() + 60_000).toISOString();
const comision = (fee: string | null | undefined, m: string) => (fee && Number(fee) > 0 ? { monto: fee, moneda: moneda(m) } : null);
const cambio = (r: { base: string; quote: string; rate: string } | null | undefined) => (r ? `1 ${moneda(r.base)} ≈ ${r.rate} ${moneda(r.quote)}` : null);

export function deTransferencia(q: CotizacionTransferencia, destinoNombre: string | null, recotizar: Operacion["recotizar"]): Operacion {
  return {
    tipo: "transferencia",
    id: q.id,
    titulo: "Vas a transferir",
    monto: texto(q.amount),
    moneda: moneda(q.currency),
    destino: { nombre: destinoNombre, detalle: `${q.address} (${q.addressType})` },
    debitos: q.debits.map((d) => ({ moneda: moneda(d.currency), monto: d.amount })),
    comision: comision(q.fee, q.currency),
    tipoCambio: cambio(q.exchangeRate),
    vence: vencimiento(q.expiresAt),
    recotizar,
  };
}

export function deConversion(q: CotizacionSwap, recotizar: Operacion["recotizar"]): Operacion {
  const [base, quote] = q.pairCode.split("/") as [string, string];
  const compra = q.type === "BUY";
  const baseAmount = texto(q.baseAmount);
  const quoteAmount = texto(q.quoteAmount);
  const sale = compra ? `${quoteAmount} ${moneda(quote)}` : `${baseAmount} ${moneda(base)}`;
  const entra = compra ? `${baseAmount} ${moneda(base)}` : `${quoteAmount} ${moneda(quote)}`;
  return {
    tipo: "conversion",
    id: q.id,
    titulo: "Vas a convertir",
    monto: compra ? baseAmount : quoteAmount,
    moneda: moneda(compra ? base : quote),
    destino: { nombre: null, detalle: `de ${sale} a ${entra}` },
    debitos: [{ moneda: moneda(compra ? quote : base), monto: compra ? quoteAmount : baseAmount }],
    comision: null,
    tipoCambio: q.price ? `1 ${moneda(base)} ≈ ${q.price} ${moneda(quote)}` : null,
    vence: vencimiento(q.expiresAt),
    recotizar,
  };
}

export function dePix(q: CotizacionPix, titular: string, recotizar: Operacion["recotizar"]): Operacion {
  return {
    tipo: "pix",
    id: q.id,
    titulo: "Vas a pagar por pix",
    monto: texto(q.amount),
    moneda: moneda(q.currency),
    destino: { nombre: titular, detalle: `clave pix ${q.address}` },
    debitos: q.debits.map((d) => ({ moneda: moneda(d.currency), monto: d.amount })),
    comision: comision(q.fee, q.currency),
    tipoCambio: cambio(q.exchangeRate),
    vence: vencimiento(q.expiresAt),
    recotizar,
  };
}
