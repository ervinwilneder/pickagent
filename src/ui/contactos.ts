/** Vista "contactos": la agenda, con un botón por cuenta que le pide al chat una transferencia. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, moneda, textoDeError } from "./comun.ts";

interface Direccion { addressType: string; address: string }
interface Cuenta { currency: string | null; addresses: Direccion[] }
interface Contacto { id: string; name: string; nickname: string | null; belotag: string | null; tier: string; isFavorite: boolean; accounts: Cuenta[] }

const lista = document.getElementById("lista")!;
const estado = document.getElementById("estado")!;
const buscar = document.getElementById("buscar") as HTMLInputElement;
const etiqueta: Record<string, string> = { self: "cuenta propia", favorite: "favorito", frequent: "frecuente" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estado.textContent = error;
    return;
  }
  const { contactos = [] } = datos<{ contactos?: Contacto[] }>(result);
  estado.textContent = contactos.length ? "" : "Sin contactos.";
  lista.replaceChildren(
    ...contactos.map((c) => {
      const t = el("article", "tarjeta");
      const lineas = c.accounts.flatMap((a) => a.addresses.map((d) => ({ d, moneda: a.currency })));
      t.innerHTML = `<div><span class="nombre">${esc(c.name)}</span>${c.belotag ? ` <code>$${esc(c.belotag)}</code>` : ""}<span class="etiqueta">${esc(etiqueta[c.tier] ?? c.tier)}</span></div>` +
        lineas.map(({ d, moneda: m }) => `<div class="linea"><span><span class="etiqueta">${esc(d.addressType)}${m ? ` · ${esc(moneda(m))}` : ""}</span><br><code>${esc(d.address)}</code></span><button class="copiar" data-tipo="${esc(d.addressType)}" data-direccion="${esc(d.address)}" data-nombre="${esc(c.name)}" type="button">Transferir</button></div>`).join("");
      return t;
    }),
  );
  lista.querySelectorAll<HTMLButtonElement>("button.copiar").forEach((b) =>
    b.addEventListener("click", () => {
      const { tipo, direccion, nombre } = b.dataset;
      void app.sendMessage({ role: "user", content: [{ type: "text", text: `Quiero transferirle a ${nombre} (${tipo} ${direccion}). Preguntame cuánto y en qué moneda, y cotizá.` }] });
    }),
  );
}

document.getElementById("buscador")!.addEventListener("submit", async (e) => {
  e.preventDefault();
  estado.textContent = "Buscando…";
  pintar(await app.callServerTool({ name: "contactos", arguments: buscar.value ? { buscar: buscar.value } : {} }));
});

const app = conectar("belo contactos", { alResultado: pintar });
