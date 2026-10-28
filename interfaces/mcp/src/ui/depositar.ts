/** Vista "depositar": CVU y alias en pesos, y direcciones cripto agrupadas por moneda, con copiar. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, mensajeConIcono, moneda, textoDeError } from "./comun.ts";

interface Direccion { currencyCode: string; network: string; value: string }

const lista = document.getElementById("lista")!;
const estadoEl = document.getElementById("estado")!;
const red: Record<string, string> = { cvu: "CVU", alias: "Alias", ethereum: "Ethereum", tron: "Tron", polygon: "Polygon", optimism: "Optimism", arbitrum_one: "Arbitrum", bsc: "BNB Chain", base: "Base", solana: "Solana", avalanche: "Avalanche", plasma: "Plasma", bitcoin_bech32: "Bitcoin", bitcoin_p2pkh: "Bitcoin legacy" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    lista.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { direcciones = [] } = datos<{ direcciones?: Direccion[] }>(result);
  const porMoneda = new Map<string, Direccion[]>();
  for (const d of direcciones) porMoneda.set(d.currencyCode, [...(porMoneda.get(d.currencyCode) ?? []), d]);
  const orden = [...porMoneda.keys()].sort((a, b) => (a === "ARS" ? -1 : b === "ARS" ? 1 : a.localeCompare(b)));
  estadoEl.textContent = `${direcciones.length} direcciones`;
  estadoEl.className = "estado";
  lista.replaceChildren(
    ...orden.map((m) => {
      const grupo = el("div", "fila", `<span class="quien"><span class="chip verde">${esc(moneda(m))}</span></span><span class="monto"></span>`);
      const sub = el("div", "filas");
      sub.innerHTML = porMoneda.get(m)!.map((d) => `<div class="fila"><span class="quien codigo">${esc(d.value)}</span><span class="monto"><button class="boton chico copiar" data-valor="${esc(d.value)}" type="button">Copiar</button></span><span class="detalle">${esc(red[d.network] ?? d.network)}</span></div>`).join("");
      grupo.append(sub);
      return grupo;
    }),
  );
  lista.querySelectorAll<HTMLButtonElement>("button.copiar").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.valor!);
        mensajeConIcono(b, "check", "copiado");
        setTimeout(() => (b.textContent = "Copiar"), 1500);
      } catch {
        b.textContent = "seleccioná y copiá";
      }
    }),
  );
}

const app = conectar("belo depositar", pintar, () => ({
  direcciones: [
    { currencyCode: "ARS", network: "cvu", value: "0000139300000001793501" },
    { currencyCode: "ARS", network: "alias", value: "ervinwilneder.belo" },
    { currencyCode: "USDT", network: "tron", value: "TRH3KR1HRcHin1TZEqhpSJsU5JRW7yvJMJ" },
    { currencyCode: "USDT", network: "polygon", value: "0xee2d7d8fd38e4f7961d177fdd8c83267013b5d02" },
    { currencyCode: "BTC", network: "bitcoin_bech32", value: "bc1q0cfq853uukkj6dm09jatuec9f7hkq8r6x6n5au" },
  ],
}));
void app;
