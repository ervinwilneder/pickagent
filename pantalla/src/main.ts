/**
 * La pantalla del agente de belo: el hilo principal en vivo (incluidos los
 * turnos que arranca un evento), con las vistas de belo renderizadas en el
 * chat y un lugar para escribirle.
 */
import { MastraClient } from "@mastra/client-js";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { conectarServidor, renderizarVista, vistaDe, type Servidor } from "./host.ts";
import "./estilos.css";

const MASTRA = import.meta.env.VITE_MASTRA_URL ?? "http://localhost:4111";
const BELO = import.meta.env.VITE_BELO_MCP_URL ?? "http://localhost:3001/mcp";
const AGENTE = "belo";
const HILO = { threadId: import.meta.env.VITE_HILO ?? "principal", resourceId: import.meta.env.VITE_PERSONA ?? "ervin" };

const mensajesEl = document.getElementById("mensajes")!;
const estadoEl = document.getElementById("estado")!;
const formEl = document.getElementById("composer") as HTMLFormElement;
const inputEl = document.getElementById("texto") as HTMLInputElement;
const enviarBtn = document.getElementById("enviar") as HTMLButtonElement;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** El agente escribe con negritas de markdown; se respetan, el resto va como texto. */
const conFormato = (t: string) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const hora = (d: Date | string | number = Date.now()) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const estado = (t: string, alerta = false) => {
  estadoEl.textContent = t;
  estadoEl.className = alerta ? "estado alerta" : "estado";
};

/* Burbujas. Cada turno del asistente es una burbuja que recibe texto y vistas. */
let burbujaActual: HTMLElement | null = null;
let textoActual: HTMLElement | null = null;
const llamadas = new Map<string, { nombre: string; args: Record<string, unknown>; caja: HTMLElement; resolver: (r: CallToolResult) => void; rechazar: (e: unknown) => void }>();

function burbuja(rol: "persona" | "agente" | "evento", cuando?: string | number) {
  const b = document.createElement("article");
  b.className = `mensaje ${rol}`;
  b.innerHTML = `<header><span class="rol">${rol === "persona" ? "$ vos" : rol === "agente" ? "belo" : "[evento]"}</span><span class="cuando">${esc(hora(cuando))}</span></header><div class="contenido"></div>`;
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

let servidor: Servidor | null = null;
const toolDelServidor = (nombre: string) => nombre.replace(/^belo_/, "");

function abrirLlamada(id: string, nombre: string, args: Record<string, unknown>) {
  if (!burbujaActual) abrirTurno();
  textoActual = null;
  const caja = document.createElement("div");
  caja.className = "llamada";
  caja.innerHTML = `<span class="marca">[..]</span> usando <code>${esc(toolDelServidor(nombre))}</code>`;
  contenido(burbujaActual!).append(caja);
  let resolver!: (r: CallToolResult) => void;
  let rechazar!: (e: unknown) => void;
  const resultado = new Promise<CallToolResult>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  llamadas.set(id, { nombre, args, caja, resolver, rechazar });
  const uri = servidor ? vistaDe(servidor, toolDelServidor(nombre)) : undefined;
  if (servidor && uri) {
    const marco = document.createElement("div");
    marco.className = "marco-vista";
    caja.after(marco);
    void renderizarVista(servidor, uri, marco, args, resultado, {
      alMensaje: (m) => {
        const t = m.content.map((c) => ("text" in c ? c.text : "")).join("");
        if (t) void enviar(t, true);
      },
    }).catch((e) => (marco.textContent = `No pude mostrar la vista: ${e instanceof Error ? e.message : e}`));
  }
}
function cerrarLlamada(id: string, resultado: unknown, error?: boolean) {
  const l = llamadas.get(id);
  if (!l) return;
  l.caja.innerHTML = `<span class="marca ${error ? "mal" : "ok"}">[${error ? "!!" : "OK"}]</span> ${error ? "falló" : "usó"} <code>${esc(toolDelServidor(l.nombre))}</code>`;
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
          caja.innerHTML = `<span class="marca ok">[OK]</span> usó <code>${esc(toolDelServidor(p.toolName))}</code>`;
          cont.append(caja);
          const uri = servidor ? vistaDe(servidor, toolDelServidor(p.toolName)) : undefined;
          const salida = p.output ?? p.result;
          if (servidor && uri && salida !== undefined) {
            const marco = document.createElement("div");
            marco.className = "marco-vista";
            caja.after(marco);
            const r = salida as { content?: unknown };
            const res: CallToolResult = Array.isArray(r?.content) ? (r as CallToolResult) : { content: [{ type: "text", text: JSON.stringify(salida) }], structuredContent: salida as Record<string, unknown> };
            void renderizarVista(servidor, uri, marco, p.input ?? p.args ?? {}, Promise.resolve(res)).catch(() => marco.remove());
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
  mensajesEl.lastElementChild?.scrollIntoView({ block: "end" });
}

const mastra = new MastraClient({ baseUrl: MASTRA });
const agente = mastra.getAgent(AGENTE);

async function enviar(texto: string, desdeVista = false) {
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

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = inputEl.value;
  inputEl.value = "";
  void enviar(t);
});

(async () => {
  try {
    servidor = await conectarServidor(new URL(BELO));
    document.getElementById("servidor")!.textContent = `${servidor.tools.size} tools · ${servidor.resources.size} vistas`;
  } catch (e) {
    document.getElementById("servidor")!.textContent = "sin vistas";
    console.error("server de belo:", e);
  }
  await suscribir();
})().catch((e) => estado(`no pude conectar: ${e instanceof Error ? e.message : e}`, true));
