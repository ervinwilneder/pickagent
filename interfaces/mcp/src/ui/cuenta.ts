/** Vista "cuenta": saldos con rendimiento y últimos movimientos, en los términos de belo. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, fecha, fmt, hora, moneda, textoDeError } from "./comun.ts";

interface Saldo { currencyCode: string; available: string; yield?: { rate: string; totalYield?: string } }
interface Movimiento {
  id: string; type: string; status: string; amount: string | null; currency: string | null; createdAt: string;
  receipt: null | { counterparty: null | { name: string | null; bank: string | null }; debits: { currency: string; amount: string }[]; netAmount: string | null; netCurrency: string | null; conversion: null | { pairCode: string } };
}

const saldosEl = document.getElementById("saldos")!;
const movimientosEl = document.getElementById("movimientos")!;
const cuantosEl = document.getElementById("cuantos")!;
const estadoEl = document.getElementById("estado")!;
const promptEl = document.getElementById("prompt")!;
const verbo: Record<string, string> = { deposit: "recibiste", transfer: "transferiste", swap: "convertiste", pix_payout: "pagaste por pix", withdrawal: "retiraste" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    movimientosEl.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { saldos = [], movimientos = [] } = datos<{ saldos?: Saldo[]; movimientos?: Movimiento[] }>(result);
  const conPlata = saldos.filter((s) => Number(s.available) > 0);
  saldosEl.replaceChildren(
    ...conPlata.map((s) => {
      const rinde = s.yield ? `<div class="rinde">rinde ${esc(s.yield.totalYield ?? s.yield.rate)} anual</div>` : `<div class="rinde nada">sin rendimiento</div>`;
      return el("article", "saldo", `<span class="chip verde">${esc(moneda(s.currencyCode))}</span><div class="monto">${esc(fmt(s.available, s.currencyCode))}</div>${rinde}`);
    }),
  );
  if (!conPlata.length) saldosEl.replaceChildren(el("p", "nota", "sin fondos"));
  cuantosEl.textContent = `últimos ${movimientos.length}`;
  movimientosEl.replaceChildren(
    ...movimientos.map((m) => {
      const entra = m.type === "deposit";
      const quien = m.receipt?.counterparty?.name ?? (m.type === "swap" ? `Conversión ${m.receipt?.conversion?.pairCode?.replace("ARGt", "ARS") ?? ""}` : "Movimiento");
      const debito = m.receipt?.debits?.[0];
      const monto = m.type === "pix_payout" && m.receipt?.netAmount ? `${fmt(m.receipt.netAmount, m.receipt.netCurrency ?? "BRL")} ${moneda(m.receipt.netCurrency ?? "BRL")}` : `${fmt(m.amount ?? "0", m.currency ?? "")} ${moneda(m.currency ?? "")}`;
      const marca = m.status === "success" ? `<span class="marca ok">[OK]</span>` : m.status === "failed" ? `<span class="marca mal">[!!]</span>` : `<span class="marca">[..]</span>`;
      const detalle = [fecha(m.createdAt), verbo[m.type] ?? m.type, debito && !entra && m.type !== "transfer" ? `salieron ${fmt(debito.amount, debito.currency)} ${moneda(debito.currency)}` : null, m.receipt?.counterparty?.bank ?? null].filter(Boolean).join(" · ");
      const clase = m.status !== "success" ? "pendiente" : entra ? "entra" : "sale";
      return el("div", "fila", `<span class="quien">${marca} ${esc(quien)}</span><span class="monto ${clase}">${entra ? "+" : "−"}${esc(monto)}</span><span class="detalle">${esc(detalle)}</span>`);
    }),
  );
  estadoEl.textContent = `actualizado ${hora()}`;
  estadoEl.className = "estado";
}

document.getElementById("actualizar")!.addEventListener("click", async () => {
  estadoEl.textContent = "actualizando";
  pintar(await app.callServerTool({ name: "cuenta", arguments: { movimientos: 10 } }));
});

const app = conectar("belo cuenta", pintar, () => {
  promptEl.textContent = "belo cuenta --movimientos 4";
  const hoy = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  return {
    saldos: [
      { currencyCode: "ARGt", available: "1850000.00", yield: { rate: "19.00%" } },
      { currencyCode: "USDT", available: "2400.000000", yield: { rate: "3.36%", totalYield: "10.00%" } },
      { currencyCode: "BTC", available: "0.00210000", yield: { rate: "0.10%" } },
    ],
    movimientos: [
      { id: "1", type: "deposit", status: "success", amount: "350000.00", currency: "ARS", createdAt: hoy(0), receipt: { counterparty: { name: "Lucía Ferrer", bank: "Mercado Pago" }, debits: [], netAmount: null, netCurrency: null, conversion: null } },
      { id: "2", type: "pix_payout", status: "success", amount: "38.68", currency: "USDT", createdAt: hoy(1), receipt: { counterparty: { name: "Pousada Mar Azul LTDA", bank: "Pix" }, debits: [{ currency: "ARS", amount: "63330.00" }], netAmount: "200.00", netCurrency: "BRL", conversion: null } },
      { id: "3", type: "swap", status: "success", amount: "100.000000", currency: "USDT", createdAt: hoy(2), receipt: { counterparty: null, debits: [{ currency: "ARS", amount: "163734.00" }], netAmount: null, netCurrency: null, conversion: { pairCode: "USDT/ARGt" } } },
      { id: "4", type: "transfer", status: "pending", amount: "90000.00", currency: "ARS", createdAt: hoy(4), receipt: { counterparty: { name: "Martín Oyola", bank: "Banco Galicia" }, debits: [{ currency: "ARS", amount: "90000.00" }], netAmount: "90000.00", netCurrency: "ARS", conversion: null } },
    ],
  };
});
