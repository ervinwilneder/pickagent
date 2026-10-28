/** Vista "cuenta": saldos y movimientos en los términos del producto belo. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, fecha, fmt, moneda, textoDeError } from "./comun.ts";

interface Saldo { currencyCode: string; available: string; yield?: { rate: string; totalYield?: string } }
interface Movimiento {
  id: string; type: string; status: string; amount: string; currency: string; createdAt: string;
  receipt: null | { counterparty: null | { name: string | null; bank: string | null; belotag: string | null }; debits: { currency: string; amount: string }[]; netAmount: string | null; netCurrency: string | null; conversion: null | { pairCode: string } };
}

const saldosEl = document.getElementById("saldos")!;
const movimientosEl = document.getElementById("movimientos")!;
const estadoEl = document.getElementById("estado")!;
const actualizarBtn = document.getElementById("actualizar")!;

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = error;
    return;
  }
  const { saldos = [], movimientos = [] } = datos<{ saldos?: Saldo[]; movimientos?: Movimiento[] }>(result);
  saldosEl.replaceChildren(
    ...saldos.filter((s) => Number(s.available) > 0).map((s) => {
      const el = document.createElement("article");
      el.className = "saldo";
      const rinde = s.yield ? `<div class="rinde">rinde ${s.yield.totalYield ?? s.yield.rate} anual</div>` : "";
      el.innerHTML = `<div class="moneda">${moneda(s.currencyCode)}</div><div class="monto">${fmt(s.available, s.currencyCode)}</div>${rinde}`;
      return el;
    }),
  );
  movimientosEl.replaceChildren(
    ...movimientos.map((m) => {
      const li = document.createElement("li");
      const entra = m.type === "deposit";
      const quien = m.receipt?.counterparty?.name ?? (m.type === "swap" ? `Conversión ${m.receipt?.conversion?.pairCode ?? ""}` : "Movimiento");
      const que = { deposit: "Recibiste", transfer: "Transferiste", swap: "Convertiste", pix_payout: "Pagaste por pix", withdrawal: "Retiraste" }[m.type] ?? m.type;
      const debito = m.receipt?.debits?.[0];
      const monto = m.type === "pix_payout" && m.receipt?.netAmount ? fmt(m.receipt.netAmount, m.receipt.netCurrency ?? "BRL") : fmt(m.amount, m.currency);
      const detalle = [fecha(m.createdAt), que, debito && !entra && m.type !== "transfer" ? `salieron ${fmt(debito.amount, debito.currency)}` : null, m.status !== "success" ? m.status : null].filter(Boolean).join(" · ");
      li.innerHTML = `<span class="quien">${quien}</span><span class="monto ${entra ? "entra" : "sale"}">${entra ? "+" : "−"}${monto}</span><span class="detalle">${detalle}</span>`;
      return li;
    }),
  );
  estadoEl.textContent = `Actualizado ${new Date().toLocaleTimeString("es-AR")}`;
}

actualizarBtn.addEventListener("click", async () => {
  estadoEl.textContent = "Actualizando…";
  pintar(await app.callServerTool({ name: "cuenta", arguments: { movimientos: 10 } }));
});

const app = conectar("belo cuenta", { alResultado: pintar });
