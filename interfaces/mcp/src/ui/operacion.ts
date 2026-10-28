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

const DURACION = 60_000;
const cuerpo = document.getElementById("cuerpo")!;
const estadoEl = document.getElementById("estado")!;
const tipoEl = document.getElementById("tipo")!;
let actual: Operacion | null = null;
let reloj: number | undefined;
let sondeo: number | undefined;

const estado = (texto: string, alerta = false) => {
  estadoEl.textContent = texto;
  estadoEl.className = alerta ? "estado alerta" : "estado";
};

function pintar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estado("error", true);
    cuerpo.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const { operacion } = datos<{ operacion?: Operacion }>(result);
  if (!operacion) return;
  actual = operacion;
  clearInterval(reloj);
  clearInterval(sondeo);
  const o = operacion;
  tipoEl.textContent = `belo_${o.tipo}`;
  estado("pendiente_aprobacion");
  const pares = [
    ...o.debitos.map((d) => `<dt>Descontaremos de tu balance</dt><dd>${esc(fmt(d.monto, d.moneda))} ${esc(d.moneda)}</dd>`),
    o.debitos.length === 0 ? `<dt>Descontaremos de tu balance</dt><dd>a confirmar</dd>` : "",
    o.comision ? `<dt>Comisión</dt><dd>${esc(fmt(o.comision.monto, o.comision.moneda))} ${esc(o.comision.moneda)}</dd>` : "",
    o.tipoCambio ? `<dt>Tipo de cambio</dt><dd>${esc(o.tipoCambio)}</dd>` : "",
  ].join("");
  cuerpo.replaceChildren(
    el("p", "prompt", esc(`belo ${o.tipo} --monto ${o.monto} ${o.moneda}${o.destino.nombre ? ` --a "${o.destino.nombre}"` : ""}`)),
    el("div", "titulo", `<em>&gt;</em> ${esc(o.titulo)}`),
    el("div", "grande", `${esc(fmt(o.monto, o.moneda))}<small>${esc(o.moneda)}</small>`),
    el("div", "fila", `<span class="quien">${o.destino.nombre ? esc(o.destino.nombre) : "<span class='marca'>sin nombre</span>"}</span><span class="detalle">${esc(o.destino.detalle)}</span>`),
    el("hr", "punteado"),
    el("dl", "pares", pares),
    el("hr", "punteado"),
    el("div", "vence", `<span><span class="texto"></span></span><div class="barra"><i></i></div>`),
    el("div", "acciones", `<button class="boton primario" id="aprobar" type="button">Aprobar en belo ↵</button><button class="boton" id="recotizar" type="button">Recotizar</button>`),
    el("div", "resultado", ""),
  );
  cuerpo.querySelector("#aprobar")!.addEventListener("click", aprobar);
  cuerpo.querySelector("#recotizar")!.addEventListener("click", recotizar);
  reloj = window.setInterval(cuentaRegresiva, 500);
  cuentaRegresiva();
}

function cuentaRegresiva() {
  if (!actual) return;
  const restanteMs = Math.max(0, new Date(actual.vence).getTime() - Date.now());
  const restante = Math.ceil(restanteMs / 1000);
  const vence = cuerpo.querySelector(".vence")!;
  vence.querySelector(".texto")!.textContent = restante > 0 ? `vence_en=${restante}s · ${hora(actual.vence)}` : "cotizacion_vencida · recotizá para seguir";
  (vence.querySelector(".barra i") as HTMLElement).style.width = `${Math.min(100, (restanteMs / DURACION) * 100)}%`;
  vence.classList.toggle("pronto", restante <= 15);
  (cuerpo.querySelector("#aprobar") as HTMLButtonElement | null)?.toggleAttribute("disabled", restante === 0);
  if (restante === 0) estado("vencida", true);
}

async function aprobar() {
  if (!actual) return;
  const boton = cuerpo.querySelector("#aprobar") as HTMLButtonElement;
  const resultado = cuerpo.querySelector(".resultado")!;
  boton.disabled = true;
  resultado.className = "resultado";
  resultado.textContent = "[..] confirmando";
  const r = await app.callServerTool({ name: "confirmar", arguments: { tipo: actual.tipo, id: actual.id } });
  const error = textoDeError(r);
  if (error) {
    resultado.className = "resultado mal";
    resultado.textContent = `[!!] ${error}`;
    boton.disabled = false;
    return;
  }
  const c = datos<Confirmacion>(r);
  clearInterval(reloj);
  cuerpo.querySelector(".vence")?.remove();
  if (c.linkDeAprobacion) {
    estado("esperando_tu_ok");
    resultado.innerHTML = `[..] aprobala en belo: <a href="${esc(c.linkDeAprobacion)}" id="link" target="_blank" rel="noopener">abrir belo ↗</a>`;
    cuerpo.querySelector("#link")!.addEventListener("click", (e) => {
      e.preventDefault();
      void app.openLink({ url: c.linkDeAprobacion! });
    });
    void app.openLink({ url: c.linkDeAprobacion });
  } else {
    resultado.textContent = `[..] ${c.resumen}`;
  }
  void app.updateModelContext({ content: [{ type: "text", text: `La persona aprobó la operación ${actual.id}; estado ${c.estado}${c.linkDeAprobacion ? ", pendiente de aprobación en belo" : ""}.` }] });
  sondeo = window.setInterval(() => void verEstado(), 3000);
}

async function verEstado() {
  if (!actual) return;
  const r = await app.callServerTool({ name: "estado", arguments: { id: actual.id } });
  if (textoDeError(r)) return;
  const { movimiento } = datos<Estado>(r);
  const resultado = cuerpo.querySelector(".resultado")!;
  if (movimiento.estado === "success") {
    clearInterval(sondeo);
    estado("ejecutada");
    resultado.className = "resultado ok";
    resultado.textContent = "[OK] listo: la operación se hizo.";
  } else if (movimiento.estado === "failed") {
    clearInterval(sondeo);
    estado("fallida", true);
    resultado.className = "resultado mal";
    resultado.textContent = "[!!] la operación no se pudo hacer. No se movió plata.";
  }
}

async function recotizar() {
  if (!actual) return;
  estado("cotizando");
  cuerpo.querySelector(".resultado")!.textContent = "[..] cotizando de nuevo";
  pintar(await app.callServerTool({ name: actual.recotizar.tool, arguments: actual.recotizar.arguments }));
}

const app = conectar("belo operación", pintar, () => ({
  operacion: {
    tipo: "pix", id: "demo", titulo: "Vas a pagar por pix", monto: "200.00", moneda: "BRL",
    destino: { nombre: "Pousada Mar Azul LTDA", detalle: "clave pix +55 48 99900-1122" },
    debitos: [{ moneda: "ARS", monto: "63340.04" }], comision: null, tipoCambio: "1 USDT ≈ 5.1700 BRL",
    vence: new Date(Date.now() + 47_000).toISOString(), recotizar: { tool: "cotizar_pix", arguments: {} },
  },
}));
