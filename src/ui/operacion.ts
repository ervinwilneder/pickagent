/**
 * Vista "operación": la cotización como la muestra belo, con su cuenta
 * regresiva, el botón para aprobar (que abre el link de belo) y el estado
 * final. Si venció, vuelve a cotizar con los mismos argumentos.
 */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, fmt, hora, textoDeError } from "./comun.ts";

interface Operacion {
  tipo: "transferencia" | "conversion" | "pix";
  id: string;
  titulo: string;
  monto: string;
  moneda: string;
  destino: { nombre: string | null; detalle: string };
  debitos: { moneda: string; monto: string }[];
  comision: { monto: string; moneda: string } | null;
  tipoCambio: string | null;
  vence: string;
  recotizar: { tool: string; arguments: Record<string, unknown> };
}
interface Confirmacion { id: string; estado: string; linkDeAprobacion: string | null; resumen: string }
interface Estado { movimiento: { estado: string } }

const raiz = document.getElementById("operacion")!;
let actual: Operacion | null = null;
let reloj: number | undefined;
let sondeo: number | undefined;

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    raiz.replaceChildren(el("p", "resultado error", esc(error)));
    return;
  }
  const { operacion } = datos<{ operacion?: Operacion }>(result);
  if (!operacion) return;
  actual = operacion;
  clearInterval(reloj);
  clearInterval(sondeo);
  const o = operacion;
  raiz.replaceChildren(
    el("div", "titulo", esc(o.titulo)),
    el("div", "principal", esc(fmt(o.monto, o.moneda))),
    el("div", "destino", `${o.destino.nombre ? `<strong>${esc(o.destino.nombre)}</strong>` : ""}<small>${esc(o.destino.detalle)}</small>`),
    el("dl", undefined, [
      ...o.debitos.map((d) => `<dt>Descontaremos de tu balance</dt><dd>${esc(fmt(d.monto, d.moneda))}</dd>`),
      o.debitos.length === 0 ? `<dt>Descontaremos de tu balance</dt><dd>a confirmar</dd>` : "",
      o.comision ? `<dt>Comisión</dt><dd>${esc(fmt(o.comision.monto, o.comision.moneda))}</dd>` : "",
      o.tipoCambio ? `<dt>Tipo de cambio</dt><dd>${esc(o.tipoCambio)}</dd>` : "",
    ].join("")),
    el("div", "vence", ""),
    el("div", "acciones", `<button class="primario" id="aprobar" type="button">Aprobar en belo</button><button id="recotizar" type="button">Volver a cotizar</button>`),
    el("div", "resultado", ""),
  );
  raiz.querySelector("#aprobar")!.addEventListener("click", aprobar);
  raiz.querySelector("#recotizar")!.addEventListener("click", recotizar);
  reloj = window.setInterval(cuentaRegresiva, 500);
  cuentaRegresiva();
}

function cuentaRegresiva() {
  if (!actual) return;
  const restante = Math.max(0, Math.floor((new Date(actual.vence).getTime() - Date.now()) / 1000));
  const venceEl = raiz.querySelector(".vence")!;
  venceEl.textContent = restante > 0 ? `La cotización vence en ${restante} s (${hora(actual.vence)})` : "La cotización venció: volvé a cotizar.";
  venceEl.classList.toggle("pronto", restante <= 15);
  (raiz.querySelector("#aprobar") as HTMLButtonElement | null)?.toggleAttribute("disabled", restante === 0);
}

async function aprobar() {
  if (!actual) return;
  const boton = raiz.querySelector("#aprobar") as HTMLButtonElement;
  const resultado = raiz.querySelector(".resultado")!;
  boton.disabled = true;
  resultado.className = "resultado";
  resultado.textContent = "Confirmando…";
  const r = await app.callServerTool({ name: "confirmar", arguments: { tipo: actual.tipo, id: actual.id } });
  const error = textoDeError(r);
  if (error) {
    resultado.className = "resultado error";
    resultado.textContent = error;
    boton.disabled = false;
    return;
  }
  const c = datos<Confirmacion>(r);
  clearInterval(reloj);
  raiz.querySelector(".vence")!.textContent = "";
  if (c.linkDeAprobacion) {
    resultado.innerHTML = `Aprobala en belo: <a href="${esc(c.linkDeAprobacion)}" id="link" target="_blank" rel="noopener">abrir belo</a>. Esperando tu decisión…`;
    raiz.querySelector("#link")!.addEventListener("click", (e) => {
      e.preventDefault();
      void app.openLink({ url: c.linkDeAprobacion! });
    });
    void app.openLink({ url: c.linkDeAprobacion });
  } else {
    resultado.textContent = c.resumen;
  }
  void app.updateModelContext({ content: [{ type: "text", text: `La persona aprobó la operación ${actual.id}; estado ${c.estado}${c.linkDeAprobacion ? ", pendiente de aprobación en belo" : ""}.` }] });
  sondeo = window.setInterval(() => void verEstado(), 3000);
}

async function verEstado() {
  if (!actual) return;
  const r = await app.callServerTool({ name: "estado", arguments: { id: actual.id } });
  if (textoDeError(r)) return;
  const { movimiento } = datos<Estado>(r);
  const resultado = raiz.querySelector(".resultado")!;
  if (movimiento.estado === "success") {
    clearInterval(sondeo);
    resultado.className = "resultado ok";
    resultado.textContent = "Listo: la operación se hizo.";
  } else if (movimiento.estado === "failed") {
    clearInterval(sondeo);
    resultado.className = "resultado error";
    resultado.textContent = "La operación no se pudo hacer. No se movió plata.";
  }
}

async function recotizar() {
  if (!actual) return;
  raiz.querySelector(".resultado")!.textContent = "Cotizando de nuevo…";
  pintar(await app.callServerTool({ name: actual.recotizar.tool, arguments: actual.recotizar.arguments }));
}

const app = conectar("belo operación", { alResultado: pintar });
