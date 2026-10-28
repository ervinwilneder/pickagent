/**
 * Vista "novedades": queda atenta a la cuenta. Cada 5 segundos pide los
 * movimientos nuevos desde un cursor y, cuando aparece uno, lo muestra y
 * le manda un mensaje a la conversación para que el agente reaccione.
 */
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectar, datos, el, esc, fmt, hora, sinHost, textoDeError } from "./comun.ts";

interface Movimiento { id: string; tipo: string; estado: string; monto: string; moneda: string; contraparte: string | null; fecha: string }
interface Inicio { desde: string; tipo: string | null; demo: boolean }

const CADA_MS = 5_000;
const estadoEl = document.getElementById("estado")!;
const listaEl = document.getElementById("lista")!;
const cuantosEl = document.getElementById("cuantos")!;
const promptEl = document.getElementById("prompt")!;
const latido = document.getElementById("latido")!;
const pausarBtn = document.getElementById("pausar") as HTMLButtonElement;
const simularBtn = document.getElementById("simular") as HTMLButtonElement;
const verbo: Record<string, string> = { deposit: "recibiste", transfer: "transferiste", swap: "convertiste", pix_payout: "pagaste por pix", withdrawal: "retiraste" };

let cursor = "";
let tipo: string | null = null;
let pausado = false;
let vistos = 0;
let timer: number | undefined;
let proximo = 0;

function arrancar(result: CallToolResult) {
  const error = textoDeError(result);
  if (error) {
    estadoEl.textContent = "error";
    estadoEl.className = "estado alerta";
    listaEl.replaceChildren(el("p", "resultado mal", esc(error)));
    return;
  }
  const inicio = datos<Inicio>(result);
  cursor = inicio.desde;
  tipo = inicio.tipo;
  promptEl.textContent = `belo novedades --escuchar${tipo ? ` --tipo ${tipo}` : ""} --desde ${hora(cursor)}`;
  simularBtn.hidden = !inicio.demo;
  estadoEl.textContent = "escuchando";
  estadoEl.className = "estado";
  programar();
}

function programar() {
  clearInterval(timer);
  proximo = Date.now() + CADA_MS;
  timer = window.setInterval(tick, 250);
}

async function tick() {
  if (pausado) return;
  const falta = proximo - Date.now();
  (latido.querySelector(".barra i") as HTMLElement).style.width = `${Math.max(0, Math.min(100, (1 - falta / CADA_MS) * 100))}%`;
  if (falta > 0) return;
  proximo = Number.POSITIVE_INFINITY; // una consulta a la vez
  try {
    const r = await app.callServerTool({ name: "novedades_desde", arguments: tipo ? { desde: cursor, tipo } : { desde: cursor } });
    const error = textoDeError(r);
    if (error) {
      estadoEl.textContent = "sin respuesta";
      estadoEl.className = "estado alerta";
    } else {
      const { movimientos, cursor: siguiente } = datos<{ movimientos: Movimiento[]; cursor: string }>(r);
      cursor = siguiente;
      estadoEl.textContent = `escuchando · ${hora()}`;
      estadoEl.className = "estado";
      for (const m of movimientos) await avisar(m);
    }
  } finally {
    proximo = Date.now() + CADA_MS;
  }
}

function describir(m: Movimiento): string {
  const que = verbo[m.tipo] ?? m.tipo;
  return `${que} ${fmt(m.monto, m.moneda)} ${m.moneda}${m.contraparte ? ` ${m.tipo === "deposit" ? "de" : "a"} ${m.contraparte}` : ""}`;
}

async function avisar(m: Movimiento) {
  vistos += 1;
  cuantosEl.textContent = String(vistos);
  if (vistos === 1) listaEl.replaceChildren();
  const entra = m.tipo === "deposit";
  const marca = m.estado === "success" ? `<span class="marca ok">[OK]</span>` : m.estado === "failed" ? `<span class="marca mal">[!!]</span>` : `<span class="marca">[..]</span>`;
  listaEl.prepend(el("div", "fila", `<span class="quien">${marca} ${esc(m.contraparte ?? (verbo[m.tipo] ?? m.tipo))}</span><span class="monto ${entra ? "entra" : "sale"}">${entra ? "+" : "−"}${esc(fmt(m.monto, m.moneda))} ${esc(m.moneda)}</span><span class="detalle">${esc(hora(m.fecha))} · ${esc(verbo[m.tipo] ?? m.tipo)} · avisado al chat</span>`));
  const texto = `Movimiento nuevo en mi cuenta de belo: ${describir(m)} (${m.estado === "success" ? "acreditado" : m.estado}). ¿Qué me conviene hacer con esto?`;
  void app.updateModelContext({ content: [{ type: "text", text: `Novedades de belo: ${vistos} movimientos desde ${hora(cursor)}. Último: ${describir(m)}.` }] });
  if (sinHost) return;
  const { isError } = await app.sendMessage({ role: "user", content: [{ type: "text", text: texto }] });
  if (isError) {
    estadoEl.textContent = "el chat no aceptó el aviso";
    estadoEl.className = "estado alerta";
  }
}

pausarBtn.addEventListener("click", () => {
  pausado = !pausado;
  pausarBtn.textContent = pausado ? "Reanudar" : "Pausar";
  estadoEl.textContent = pausado ? "en pausa" : "escuchando";
  latido.querySelector(".texto")!.textContent = pausado ? "en pausa" : "esperando movimientos";
  if (!pausado) programar();
});

simularBtn.addEventListener("click", async () => {
  simularBtn.disabled = true;
  await app.callServerTool({ name: "simular_deposito", arguments: { monto: "125000.00", de: "Carla Benítez" } });
  simularBtn.disabled = false;
});

const app = conectar("belo novedades", arrancar, () => {
  setTimeout(() => void avisar({ id: "1", tipo: "deposit", estado: "success", monto: "125000.00", moneda: "ARS", contraparte: "Carla Benítez", fecha: new Date().toISOString() }), 400);
  return { desde: new Date().toISOString(), tipo: null, demo: true };
});
