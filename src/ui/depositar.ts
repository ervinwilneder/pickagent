/** Vista "depositar": CVU y alias en pesos, y direcciones cripto agrupadas por moneda, con copiar. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, moneda, textoDeError } from "./comun.ts";

interface Direccion { currencyCode: string; network: string; value: string }

const lista = document.getElementById("lista")!;
const estado = document.getElementById("estado")!;
const red: Record<string, string> = { cvu: "CVU", alias: "Alias", ethereum: "Ethereum", tron: "Tron", polygon: "Polygon", optimism: "Optimism", arbitrum_one: "Arbitrum", bsc: "BNB Chain", base: "Base", solana: "Solana", avalanche: "Avalanche", plasma: "Plasma", bitcoin_bech32: "Bitcoin (bech32)", bitcoin_p2pkh: "Bitcoin (legacy)" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estado.textContent = error;
    return;
  }
  const { direcciones = [] } = datos<{ direcciones?: Direccion[] }>(result);
  const porMoneda = new Map<string, Direccion[]>();
  for (const d of direcciones) porMoneda.set(d.currencyCode, [...(porMoneda.get(d.currencyCode) ?? []), d]);
  const orden = [...porMoneda.keys()].sort((a, b) => (a === "ARS" ? -1 : b === "ARS" ? 1 : a.localeCompare(b)));
  lista.replaceChildren(
    ...orden.map((m) => {
      const t = el("article", "tarjeta");
      t.innerHTML = `<div class="nombre">${esc(moneda(m))}</div>` + porMoneda.get(m)!.map((d) => `<div class="linea"><span><span class="etiqueta">${esc(red[d.network] ?? d.network)}</span><br><code>${esc(d.value)}</code></span><button class="copiar" data-valor="${esc(d.value)}" type="button">Copiar</button></div>`).join("");
      return t;
    }),
  );
  lista.querySelectorAll<HTMLButtonElement>("button.copiar").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.valor!);
        b.textContent = "Copiado";
        setTimeout(() => (b.textContent = "Copiar"), 1500);
      } catch {
        estado.textContent = "No se pudo copiar: seleccioná y copiá a mano.";
      }
    }),
  );
}

const app = conectar("belo depositar", { alResultado: pintar });
void app;
