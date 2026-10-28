/**
 * Adaptador falso: una cuenta en memoria con la misma forma que belo, para
 * correr la app sin API key. Los movimientos que cotiza y confirma quedan en
 * memoria y las cotizaciones vencen a los 60 segundos como en belo.
 */
import { randomUUID } from "node:crypto";
import { BeloError, type BeloPort, type Confirmacion, type Saldo, type Transaccion } from "./port.ts";

const ahora = () => new Date().toISOString();
const vence = () => new Date(Date.now() + 60_000).toISOString();
const dec = (n: number, d = 2) => n.toFixed(d);

export function beloFalso(): BeloPort {
  const saldos: Saldo[] = [
    { currencyCode: "ARGt", name: "Argentine Peso Token", type: "fiat_token", decimals: 2, available: "1850000.00", earned: { total: "12500.00", today: "890.00", month: "9800.00" }, yield: { rate: "19.00%" } },
    { currencyCode: "USDT", name: "Tether USD", type: "stablecoin", decimals: 6, available: "2400.000000", earned: { total: "61.204000", today: "0.650000", month: "18.100000" }, yield: { rate: "3.36%", extraYield: "6.63%", totalYield: "10.00%" } },
    { currencyCode: "USDC", name: "USD Coin", type: "stablecoin", decimals: 6, available: "0.000000", earned: { total: "0.000000", today: "0.000000", month: "0.000000" }, yield: { rate: "2.36%" } },
    { currencyCode: "BTC", name: "Bitcoin", type: "crypto", decimals: 8, available: "0.00210000", earned: { total: "0.00000120", today: "0.00000000", month: "0.00000030" }, yield: { rate: "0.10%" } },
  ];
  const precioUsdtArs = 1637.34;
  const precioUsdtBrl = 5.17;

  const transacciones: Transaccion[] = [
    tx("deposit", "350000.00", "ARS", "success", { counterparty: { name: "Lucía Ferrer", bank: "Mercado Pago", belotag: null, account: "0000003100099988877766", accountType: "CVU" }, debits: [] }, -1),
    tx("pix_payout", "38.680000", "USDT", "success", { counterparty: { name: "Pousada Mar Azul LTDA", bank: "Pix", belotag: null, account: "+5548999001122", accountType: "PIX" }, debits: [{ currency: "ARS", amount: "63330.00" }], netAmount: "200.00", netCurrency: "BRL", conversion: { pairCode: "ARS/USDT", type: "SELL", price: dec(1 / precioUsdtArs, 18), baseAmount: "63330.00", quoteAmount: "38.68" } }, -2),
    tx("swap", "100.000000", "USDT", "success", { counterparty: null, debits: [{ currency: "ARS", amount: "163734.00" }], conversion: { pairCode: "USDT/ARGt", type: "BUY", price: dec(precioUsdtArs, 18), baseAmount: "100", quoteAmount: "163734.00" } }, -3),
    tx("transfer", "90000.00", "ARS", "success", { counterparty: { name: "Martín Oyola", bank: "Banco Galicia", belotag: null, account: "0070999030004012345678", accountType: "CBU" }, debits: [{ currency: "ARS", amount: "90000.00" }], netAmount: "90000.00", netCurrency: "ARS", fee: "0", feeCurrency: "ARS" }, -5),
  ];
  const pendientes = new Map<string, Transaccion>();

  function tx(type: Transaccion["type"], amount: string, currency: string, status: Transaccion["status"], receipt: Partial<NonNullable<Transaccion["receipt"]>>, diasAtras: number): Transaccion {
    const fecha = new Date(Date.now() + diasAtras * 86_400_000).toISOString();
    return {
      id: randomUUID(), type, status, amount, currency,
      metadata: {},
      receipt: { counterparty: null, debits: [], netAmount: null, netCurrency: null, fee: null, feeCurrency: null, taxes: null, taxCurrency: null, conversion: null, network: null, transactionHash: null, explorerUrl: null, bankReference: null, ...receipt } as Transaccion["receipt"],
      createdAt: fecha, updatedAt: fecha,
    } as Transaccion;
  }

  function saldo(code: string) {
    const s = saldos.find((x) => x.currencyCode === code);
    if (!s) throw new BeloError("not_found", "validation_error", `No hay saldo en ${code}`);
    return s;
  }
  function exigir(code: string, monto: number) {
    if (Number(saldo(code).available) < monto) throw new BeloError("insufficient_funds", "validation_error", "Insufficient balance for this operation");
  }
  function confirmar(id: string): Confirmacion {
    const t = pendientes.get(id);
    if (!t) throw new BeloError("not_found", "validation_error", "Quote not found or expired");
    // Con una persona conectada belo devolvería un link de aprobación; el falso lo simula.
    return { id, status: "pending", approvalUrl: `https://belo.app/aprobar/${id}` };
  }

  return {
    async saldos() { return saldos; },
    async direccionesDeposito() {
      return [{ currencyCode: "ARS", network: "cvu", value: "0000139300000009999999" }, { currencyCode: "ARS", network: "alias", value: "demo.belo" }, { currencyCode: "USDT", network: "tron", value: "TDemoDemoDemoDemoDemoDemoDemoDemo1" }];
    },
    async transacciones(filtro = {}) {
      const data = transacciones.filter((t) => (!filtro.type || t.type === filtro.type) && (!filtro.currency || t.currency === filtro.currency));
      const limit = filtro.limit ?? 20;
      return { data: data.slice(0, limit), pagination: { total: data.length, limit, currentPage: 1, nextPage: null, prevPage: null } };
    },
    async transaccion(id) {
      const t = transacciones.find((x) => x.id === id) ?? pendientes.get(id);
      if (!t) throw new BeloError("not_found", "validation_error", "Transaction not found");
      return t;
    },
    async contactos(busqueda) {
      const todos = [
        { id: "64a5b7618786a50e09752f38", name: "Cuenta propia", nickname: null, belotag: "demo", isFavorite: false, tier: "self", lastTransferAt: null, accounts: [{ currency: "ARGt", ownerName: null, addresses: [{ addressType: "CVU", address: "0000003100099988877766", network: null, country: null, fields: [] }] }] },
        { id: "6735180b8bcef37ff3031176", name: "Martín Oyola", nickname: null, belotag: null, isFavorite: true, tier: "frequent", lastTransferAt: null, accounts: [{ currency: "ARGt", ownerName: null, addresses: [{ addressType: "CBU", address: "0070999030004012345678", network: null, country: null, fields: [] }] }] },
        { id: "65189058ec7cde46775eb9d5", name: "Pousada Mar Azul", nickname: null, belotag: null, isFavorite: false, tier: "frequent", lastTransferAt: null, accounts: [{ currency: "BRL", ownerName: null, addresses: [{ addressType: "PIX", address: "+5548999001122", network: null, country: "BR", fields: [] }] }] },
      ];
      return (busqueda ? todos.filter((c) => c.name.toLowerCase().includes(busqueda.toLowerCase())) : todos) as never;
    },
    async alcancias() { return []; },
    async redes(currency) {
      const base = [{ addressType: "BELOTAG", minAmount: "", maxAmount: "", fee: "0", available: true }];
      if (currency === "USDT") return [...base, { addressType: "TRON", minAmount: "5", maxAmount: "", fee: "1.5", available: true }, { addressType: "POLYGON", minAmount: "3", maxAmount: "", fee: "1", available: true }] as never;
      return base as never;
    },
    async cotizarSwap(p) {
      const [base, quote] = p.pairCode.split("/");
      const monto = Number(p.quoteAmount);
      const enBase = p.quoteCurrency === base;
      const precio = base === "USDT" && quote === "ARGt" ? precioUsdtArs : 1;
      const baseAmount = enBase ? monto : monto / precio;
      const quoteAmount = enBase ? monto * precio : monto;
      exigir(p.type === "BUY" ? quote : base, p.type === "BUY" ? quoteAmount : baseAmount);
      const id = randomUUID();
      pendientes.set(id, tx("swap", dec(baseAmount, 6), base, "pending", { debits: [{ currency: p.type === "BUY" ? quote : base, amount: dec(p.type === "BUY" ? quoteAmount : baseAmount) }] }, 0));
      return { id, status: "pending", pairCode: p.pairCode, type: p.type, price: dec(precio, 18), baseAmount: dec(baseAmount, 6), quoteAmount: dec(quoteAmount, 2), expiresAt: vence() };
    },
    async confirmarSwap(id) { return confirmar(id); },
    async cotizarTransferencia(p) {
      const monto = Number(p.quoteAmount);
      const fee = p.addressType === "TRON" ? 1.5 : p.addressType === "POLYGON" ? 1 : 0;
      exigir(p.currency, monto + fee);
      const id = randomUUID();
      pendientes.set(id, tx("transfer", dec(monto, 6), p.currency, "pending", { debits: [{ currency: p.currency, amount: dec(monto + fee, 6) }] }, 0));
      return { id, status: "pending", address: p.address, addressType: p.addressType, currency: p.currency, amount: dec(monto, 18), fee: dec(fee, 2), exchangeRate: null, expiresAt: vence(), debits: [{ currency: p.currency, amount: dec(monto + fee) }] } as never;
    },
    async confirmarTransferencia(id) { return confirmar(id); },
    async destinatarioPix(address) {
      if (!/^\+?\d{10,14}$|@|^[0-9a-f-]{36}$/i.test(address)) throw new BeloError("invalid_address", "validation_error", "The destination address is invalid for this rail");
      return { address, name: "Pousada Mar Azul LTDA" } as never;
    },
    async cotizarPix(p) {
      const brl = Number(p.amount);
      const usdt = brl / precioUsdtBrl;
      const ars = usdt * precioUsdtArs;
      exigir("ARGt", ars);
      const id = randomUUID();
      pendientes.set(id, tx("pix_payout", dec(usdt, 6), "USDT", "pending", { debits: [{ currency: "ARS", amount: dec(ars) }], netAmount: dec(brl), netCurrency: "BRL" }, 0));
      return { id, status: "pending", address: p.address, amount: dec(brl), currency: "BRL", price: dec(precioUsdtBrl, 4), expiresAt: vence(), debits: [{ currency: "ARS", amount: dec(ars) }] } as never;
    },
    async confirmarPix(id) { return confirmar(id); },
    async metodosCobro() {
      return [{ id: "mp-cvu", name: "Transferencia en pesos", currencyCode: "ARS", fee: "0", limits: { min: "100", max: "5000000" } }] as never;
    },
    async crearCobro(p) {
      const id = randomUUID();
      return { id, type: p.type ?? "link", status: "active", checkoutUrl: `https://pay.belo.app/${id}`, currencyCode: p.currencyCode, amount: p.amount ?? null, productTitle: p.productTitle, expiresAt: p.expiresAt ?? null, createdAt: ahora() } as never;
    },
    async estadoCobro(id) { return { id, status: "pending", transactionId: null } as never; },
    async tarjetas() { return []; },
    simulacion: {
      async deposito(monto, de) {
        const t = tx("deposit", monto, "ARS", "success", { counterparty: { name: de, bank: "Mercado Pago", belotag: null, account: "0000003100011122233344", accountType: "CVU" }, debits: [] }, 0);
        transacciones.unshift(t);
        saldo("ARGt").available = dec(Number(saldo("ARGt").available) + Number(monto));
        return t;
      },
    },
  };
}
