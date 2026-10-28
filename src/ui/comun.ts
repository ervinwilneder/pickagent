/** Lo que comparten las vistas: conexión con el host, tema y formato de montos. */
import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";
import "./estilos.css";

export const moneda = (c: string) => (c === "ARGt" ? "ARS" : c);

export function fmt(monto: string, c: string): string {
  const n = Number(monto);
  const decimales = ["ARS", "ARGt", "BRL"].includes(c) ? 2 : n !== 0 && Math.abs(n) < 1 ? 6 : 2;
  return `${n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} ${moneda(c)}`;
}

export const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
export const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Mastra devuelve el resultado de la tool como JSON en `structuredContent` o en el texto. */
export function datos<T>(result: CallToolResult): T {
  if (result.structuredContent) return result.structuredContent as T;
  const texto = result.content?.find((c) => c.type === "text") as { text?: string } | undefined;
  try {
    return JSON.parse(texto?.text ?? "{}") as T;
  } catch {
    return {} as T;
  }
}

export function textoDeError(result: CallToolResult): string | null {
  if (!result.isError) return null;
  const texto = result.content?.find((c) => c.type === "text") as { text?: string } | undefined;
  return texto?.text ?? "Algo falló.";
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function contexto(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

/** Crea la app, registra los handlers antes de conectar, y conecta. */
export function conectar(nombre: string, handlers: { alResultado: (r: CallToolResult) => void; alInput?: (args: Record<string, unknown>) => void }): App {
  const app = new App({ name: nombre, version: "0.0.0" });
  app.ontoolresult = handlers.alResultado;
  if (handlers.alInput) app.ontoolinput = (p) => handlers.alInput!((p as { arguments?: Record<string, unknown> }).arguments ?? {});
  app.onhostcontextchanged = contexto;
  app.onerror = console.error;
  app.connect().then(() => {
    const ctx = app.getHostContext();
    if (ctx) contexto(ctx);
  });
  return app;
}
