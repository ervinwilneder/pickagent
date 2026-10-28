/** Vista "contactos": la agenda, con un botón por cuenta que le pide al chat una transferencia. */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, moneda, textoDeError } from "./comun.ts";

interface Direccion { addressType: string; address: string }
interface Cuenta { currency: string | null; addresses: Direccion[] }
interface Contacto { id: string; name: string; belotag: string | null; tier: string; isFavorite: boolean; accounts: Cuenta[] }

const lista = document.getElementById("lista")!;
const estadoEl = document.getElementById("estado")!;
const buscar = document.getElementById("buscar") as HTMLInputElement;
const etiqueta: Record<string, string> = { self: "propia", favorite: "favorito", frequent: "frecuente" };

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    lista.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { contactos = [] } = datos<{ contactos?: Contacto[] }>(result);
  estadoEl.textContent = `${contactos.length} contactos`;
  estadoEl.className = "estado";
  lista.replaceChildren(
    ...contactos.map((c) => {
      const lineas = c.accounts.flatMap((a) => a.addresses.map((d) => ({ d, moneda: a.currency })));
      const chips = `<span class="chip ${c.tier === "self" ? "verde" : ""}">${esc(etiqueta[c.tier] ?? c.tier)}</span>${c.belotag ? ` <span class="chip verde">$${esc(c.belotag)}</span>` : ""}`;
      const cuentas = lineas.map(({ d, moneda: m }) => `<div class="fila"><span class="quien codigo">${esc(d.address)}</span><span class="monto"><button class="boton chico transferir" data-tipo="${esc(d.addressType)}" data-direccion="${esc(d.address)}" data-nombre="${esc(c.name)}" type="button">Transferir</button></span><span class="detalle">${esc(d.addressType)}${m ? ` · ${esc(moneda(m))}` : ""}</span></div>`).join("");
      const t = el("div", "fila", `<span class="quien">${esc(c.name)}</span><span class="monto">${chips}</span><span class="detalle"></span>`);
      const sub = el("div", "filas");
      sub.innerHTML = cuentas;
      t.querySelector(".detalle")!.replaceWith(sub);
      return t;
    }),
  );
  if (!contactos.length) lista.replaceChildren(el("p", "nota", "sin contactos con ese nombre"));
  lista.querySelectorAll<HTMLButtonElement>("button.transferir").forEach((b) =>
    b.addEventListener("click", () => {
      const { tipo, direccion, nombre } = b.dataset;
      void app.sendMessage({ role: "user", content: [{ type: "text", text: `Quiero transferirle a ${nombre} (${tipo} ${direccion}). Preguntame cuánto y en qué moneda, y cotizá.` }] });
    }),
  );
}

document.getElementById("buscador")!.addEventListener("submit", async (e) => {
  e.preventDefault();
  estadoEl.textContent = "buscando";
  pintar(await app.callServerTool({ name: "contactos", arguments: buscar.value ? { buscar: buscar.value } : {} }));
});

const app = conectar("belo contactos", pintar, () => ({
  contactos: [
    { id: "1", name: "Cuenta propia", belotag: "ervin", tier: "self", isFavorite: false, accounts: [{ currency: "ARGt", addresses: [{ addressType: "CVU", address: "0000003100099988877766" }, { addressType: "CBU", address: "1430001713000035470016" }] }] },
    { id: "2", name: "Martín Oyola", belotag: null, tier: "frequent", isFavorite: true, accounts: [{ currency: "ARGt", addresses: [{ addressType: "CBU", address: "0070999030004012345678" }] }] },
    { id: "3", name: "Anahí Soledad López", belotag: "anibio", tier: "frequent", isFavorite: false, accounts: [{ currency: "USDT", addresses: [{ addressType: "BELOTAG", address: "anibio" }] }] },
    { id: "4", name: "Pousada Mar Azul", belotag: null, tier: "frequent", isFavorite: false, accounts: [{ currency: "BRL", addresses: [{ addressType: "PIX", address: "+5548999001122" }] }] },
  ],
}));
