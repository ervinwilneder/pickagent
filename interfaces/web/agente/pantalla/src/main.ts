/**
 * La pantalla del agente de belo: el hilo principal en vivo (incluidos los
 * turnos que arranca un evento), con las vistas de belo renderizadas en el
 * chat y un lugar para escribirle.
 */
import { MastraClient } from "@mastra/client-js";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectarServidor, renderizarVista, resolver as ubicar, type Servidores } from "./host.ts";
import "./estilos.css";
import { icono, montarIconos } from "../../../../../shared/ui/phosphor.ts";

montarIconos();

const MASTRA = import.meta.env.VITE_MASTRA_URL ?? "http://localhost:4111";
/** Los enlaces anteriores abren el mismo modo único, sin conservar el selector. */
const url = new URL(location.href);
if (url.searchParams.has("agente")) {
  url.searchParams.delete("agente");
  history.replaceState(history.state, "", url);
}
/** La pantalla de PickAgent siempre usa logística y la cuenta Belo del cliente. */
const SERVERS: Record<string, string> = {
  logistica: import.meta.env.VITE_LOGISTICA_MCP_URL ?? "http://localhost:3002/mcp",
  belo: import.meta.env.VITE_BELO_MCP_URL ?? "http://localhost:3001/mcp",
};
const HILO = { threadId: "asistente", resourceId: import.meta.env.VITE_PERSONA ?? "ervin" };

const mensajesEl = document.getElementById("mensajes")!;
const errorEl = document.getElementById("error-mensaje")!;
const formEl = document.getElementById("composer") as HTMLFormElement;
const inputEl = document.getElementById("texto") as HTMLTextAreaElement;
const enviarBtn = document.getElementById("enviar") as HTMLButtonElement;
const sinModeloLocal = import.meta.env.DEV && import.meta.env.VITE_LOCAL_SIN_MODELO === "1";
enviarBtn.disabled = sinModeloLocal;

function pintarBienvenida() {
  if (mensajesEl.childElementCount) return;
  const template = document.getElementById("bienvenida-template") as HTMLTemplateElement;
  mensajesEl.append(template.content.cloneNode(true));
  montarIconos(mensajesEl);
}
pintarBienvenida();
mensajesEl.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-ejemplo]") : null;
  if (!button) return;
  inputEl.value = button.dataset.ejemplo ?? "";
  inputEl.focus();
});

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** El agente escribe con negritas de markdown; se respetan, el resto va como texto. */
const conFormato = (t: string) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const hora = (d: Date | string | number = Date.now()) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const estado = (t: string, alerta = false) => {
  errorEl.hidden = !alerta;
  errorEl.textContent = alerta
    ? t.startsWith("no pude enviar")
      ? "No se pudo enviar el mensaje. Intentá de nuevo."
      : "No se pudo conectar con el agente. Intentá de nuevo."
    : "";
  if (alerta) console.warn(t);
};

/* Burbujas. Cada turno del asistente es una burbuja que recibe texto y vistas. */
let burbujaActual: HTMLElement | null = null;
let textoActual: HTMLElement | null = null;
const llamadas = new Map<string, { nombre: string; args: Record<string, unknown>; caja: HTMLElement; resolver: (r: CallToolResult) => void; rechazar: (e: unknown) => void }>();

function burbuja(rol: "persona" | "agente" | "evento", cuando?: string | number) {
  mensajesEl.querySelector(".bienvenida")?.remove();
  const b = document.createElement("article");
  b.className = `mensaje ${rol}`;
  b.innerHTML = `<header><span class="rol">${rol === "persona" ? "vos" : rol === "agente" ? "pickagent" : "evento"}</span><span class="cuando">${esc(hora(cuando))}</span></header><div class="contenido"></div>`;
  mensajesEl.append(b);
  b.scrollIntoView({ block: "end" });
  return b;
}
function contenido(b: HTMLElement) {
  return b.querySelector(".contenido") as HTMLElement;
}
function textoDe(partes: unknown): string {
  if (typeof partes === "string") return partes;
  if (!Array.isArray(partes)) return "";
  return partes.map((p: { type?: string; text?: string }) => (p.type === "text" ? p.text ?? "" : "")).join("");
}
function evento(texto: string, cuando?: string | number) {
  const m = texto.match(/<untrusted-mcp-event-data>([\s\S]*?)<\/untrusted-mcp-event-data>/);
  let linea = texto;
  if (m) {
    try {
      const e = JSON.parse(m[1]!.trim());
      const d = e.data ?? {};
      linea = `${e.event}: ${d.tipo ?? ""} ${d.monto ?? ""} ${d.moneda ?? ""}${d.contraparte ? ` · ${d.contraparte}` : ""} · ${d.estado ?? ""}`;
    } catch {}
  }
  const b = burbuja("evento", cuando);
  contenido(b).innerHTML = `<code>${esc(linea)}</code>`;
}

function abrirTurno(cuando?: string | number) {
  burbujaActual = burbuja("agente", cuando);
  textoActual = null;
}
function agregarTexto(delta: string) {
  if (!burbujaActual) abrirTurno();
  if (!textoActual) {
    textoActual = document.createElement("p");
    contenido(burbujaActual!).append(textoActual);
  }
  textoActual.dataset.crudo = (textoActual.dataset.crudo ?? "") + delta;
  textoActual.innerHTML = conFormato(textoActual.dataset.crudo);
  burbujaActual!.scrollIntoView({ block: "end" });
}
function cerrarTurno() {
  burbujaActual = null;
  textoActual = null;
}

const servidores: Servidores = new Map();
const toolDelServidor = (nombre: string) => ubicar(servidores, nombre)?.tool ?? nombre;

function abrirLlamada(id: string, nombre: string, args: Record<string, unknown>) {
  if (!burbujaActual) abrirTurno();
  textoActual = null;
  const caja = document.createElement("div");
  caja.className = "llamada";
  caja.innerHTML = `<span class="marca">${icono("circle-notch")}</span> usando <code>${esc(toolDelServidor(nombre))}</code>`;
  contenido(burbujaActual!).append(caja);
  let resolver!: (r: CallToolResult) => void;
  let rechazar!: (e: unknown) => void;
  const resultado = new Promise<CallToolResult>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  llamadas.set(id, { nombre, args, caja, resolver, rechazar });
  const r = ubicar(servidores, nombre);
  if (r?.uri) {
    const marco = document.createElement("div");
    marco.className = "marco-vista";
    caja.after(marco);
    void renderizarVista(r.servidor, r.uri, marco, args, resultado, {
      alMensaje: (m) => {
        const t = m.content.map((c) => ("text" in c ? c.text : "")).join("");
        if (t) void enviar(t, true);
      },
      alEstado: (p) => (caja.dataset.estado = p),
    }).catch((e) => (marco.textContent = `No pude mostrar la vista: ${e instanceof Error ? e.message : e}`));
  }
}
function cerrarLlamada(id: string, resultado: unknown, error?: boolean) {
  const l = llamadas.get(id);
  if (!l) return;
  l.caja.innerHTML = `<span class="marca ${error ? "mal" : "ok"}">${icono(error ? "x" : "check")}</span> ${error ? "falló" : "usó"} <code>${esc(toolDelServidor(l.nombre))}</code>`;
  const r = resultado as { content?: unknown; structuredContent?: unknown; isError?: boolean } | null;
  const comoResultado: CallToolResult = r && Array.isArray(r.content)
    ? (r as CallToolResult)
    : { content: [{ type: "text", text: typeof resultado === "string" ? resultado : JSON.stringify(resultado ?? null) }], structuredContent: (resultado && typeof resultado === "object" ? resultado : undefined) as Record<string, unknown> | undefined, isError: error };
  if (error) l.rechazar(new Error(String(resultado)));
  else l.resolver(comoResultado);
  llamadas.delete(id);
}

/* Historial y stream del hilo. */
function pintarHistorial(mensajes: { role: string; content?: unknown; createdAt?: string | number }[]) {
  mensajesEl.replaceChildren();
  for (const m of mensajes) {
    const c = m.content as { parts?: unknown[]; content?: unknown } | string | undefined;
    const partes = (c && typeof c === "object" && "parts" in c ? c.parts : c) as unknown;
    if (m.role === "signal") {
      evento(textoDe(partes), m.createdAt);
      continue;
    }
    if (m.role === "user") {
      const b = burbuja("persona", m.createdAt);
      contenido(b).innerHTML = `<p>${esc(textoDe(partes))}</p>`;
      continue;
    }
    if (m.role === "assistant") {
      const b = burbuja("agente", m.createdAt);
      const cont = contenido(b);
      for (let p of (Array.isArray(partes) ? partes : []) as { type?: string; text?: string; toolName?: string; input?: Record<string, unknown>; args?: Record<string, unknown>; output?: unknown; result?: unknown; error?: unknown }[]) {
        if (p.type === "text" && p.text) {
          const el = document.createElement("p");
          el.innerHTML = conFormato(p.text);
          cont.append(el);
          continue;
        }
        // En el historial la tool viene como "tool-invocation" con sus datos adentro.
        const inv = (p as { toolInvocation?: { toolName?: string; args?: Record<string, unknown>; result?: unknown } }).toolInvocation;
        if (inv?.toolName) {
          p = { ...p, type: "tool-invocation", toolName: inv.toolName, args: inv.args, result: inv.result };
        }
        if (p.type?.startsWith("tool") && p.toolName) {
          const caja = document.createElement("div");
          caja.className = "llamada";
          caja.innerHTML = `<span class="marca ok">${icono("check")}</span> usó <code>${esc(toolDelServidor(p.toolName))}</code>`;
          cont.append(caja);
          const rs = ubicar(servidores, p.toolName);
          const salida = p.output ?? p.result;
          if (rs?.uri && salida !== undefined) {
            const marco = document.createElement("div");
            marco.className = "marco-vista";
            caja.after(marco);
            const r = salida as { content?: unknown };
            const res: CallToolResult = Array.isArray(r?.content) ? (r as CallToolResult) : { content: [{ type: "text", text: JSON.stringify(salida) }], structuredContent: salida as Record<string, unknown> };
            void renderizarVista(rs.servidor, rs.uri, marco, p.input ?? p.args ?? {}, Promise.resolve(res), { alEstado: (paso) => (caja.dataset.estado = paso) }).catch((e) => (marco.textContent = `No pude mostrar la vista: ${e instanceof Error ? e.message : e}`));
          }
        } else if (p.type === "error") {
          const el = document.createElement("p");
          el.className = "mal";
          el.textContent = `No pude responder: ${(p.error as { message?: string })?.message ?? "error"}`;
          cont.append(el);
        }
      }
    }
  }
  pintarBienvenida();
  mensajesEl.lastElementChild?.scrollIntoView({ block: "end" });
}

const mastra = new MastraClient({ baseUrl: MASTRA });
const agente = mastra.getAgent("asistente");

async function enviar(texto: string, desdeVista = false) {
  if (sinModeloLocal) return;
  if (!texto.trim()) return;
  if (!desdeVista) {
    const b = burbuja("persona");
    contenido(b).innerHTML = `<p>${esc(texto)}</p>`;
  }
  enviarBtn.disabled = true;
  try {
    await agente.sendMessage({ message: texto, ...HILO });
  } catch (e) {
    estado(`no pude enviar: ${e instanceof Error ? e.message : e}`, true);
  } finally {
    enviarBtn.disabled = false;
  }
}

async function suscribir() {
  estado("conectando al hilo");
  const sub = await agente.subscribeToThread({ ...HILO, withInitialHistory: { perPage: 60 } });
  estado("escuchando el hilo");
  void sub.processDataStream({
    reconnect: true,
    onChunk: (c) => {
      const chunk = c as unknown as { type: string; payload?: Record<string, unknown> };
      const p = chunk.payload ?? {};
      switch (chunk.type) {
        case "thread-history":
          pintarHistorial((p.messages as never[]) ?? []);
          break;
        case "start":
          abrirTurno();
          break;
        case "text-delta":
          agregarTexto(String(p.text ?? ""));
          break;
        case "tool-call":
          abrirLlamada(String(p.toolCallId), String(p.toolName), (p.args as Record<string, unknown>) ?? {});
          break;
        case "tool-result":
          cerrarLlamada(String(p.toolCallId), p.result, Boolean(p.isError));
          break;
        case "tool-error":
          cerrarLlamada(String(p.toolCallId), p.error, true);
          break;
        case "finish":
        case "thread-run-status":
          cerrarTurno();
          estado(`escuchando el hilo · último turno ${hora()}`);
          break;
        case "error":
          agregarTexto(`No pude responder: ${(p.error as { message?: string })?.message ?? JSON.stringify(p.error)}`);
          cerrarTurno();
          break;
        default:
          if (chunk.type.startsWith("data-user-message")) {
            const t = textoDe((p.content as { parts?: unknown[] })?.parts ?? p.text);
            if (t && chunk.type.endsWith("pending")) burbujaSignalOUsuario(t);
          }
          console.debug("chunk", chunk.type, p);
      }
    },
  });
}
function burbujaSignalOUsuario(t: string) {
  if (t.includes("<untrusted-mcp-event-data>")) evento(t);
}

inputEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!enviarBtn.disabled) formEl.requestSubmit(enviarBtn);
});

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = inputEl.value;
  inputEl.value = "";
  void enviar(t);
});

(async () => {
  const partes: string[] = [];
  for (const [nombre, url] of Object.entries(SERVERS)) {
    try {
      const s = await conectarServidor(new URL(url));
      servidores.set(nombre, s);
      partes.push(`${nombre} ${s.tools.size} tools · ${s.resources.size} vistas`);
    } catch (e) {
      partes.push(`${nombre} sin conexión`);
      console.error(`server ${nombre}:`, e);
    }
  }
  console.info("Conexión de servicios:", partes.join(" / "));
  await suscribir();
})().catch((e) => estado(`no pude conectar: ${e instanceof Error ? e.message : e}`, true));
