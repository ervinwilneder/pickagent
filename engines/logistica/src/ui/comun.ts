/** Lo que comparten las vistas: conexión con el host, formato de montos y el modo muestra. */
import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/client";
import "./estilos.css";
import { montarIconos } from "../../../../shared/ui/phosphor.ts";
export { icono, mensajeConIcono } from "../../../../shared/ui/phosphor.ts";

montarIconos();

export const moneda = (c: string) => (c === "ARGt" ? "ARS" : c);

/** Monto con separadores de es-AR; cripto chica con 6 decimales. */
export function fmt(monto: string, c: string): string {
  const n = Number(monto);
  const decimales = ["ARS", "ARGt", "BRL"].includes(c) ? 2 : n !== 0 && Math.abs(n) < 1 ? 6 : 2;
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}
export const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
export const hora = (iso?: string) => new Date(iso ?? Date.now()).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** Mastra devuelve el resultado como JSON en `structuredContent` o en el texto. */
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

/** Sin host (la vista abierta sola en un navegador) se muestra con datos de ejemplo. */
export const sinHost = window.parent === window;

/** Crea la app, registra los handlers antes de conectar, y conecta. En modo muestra pinta el ejemplo. */
export function conectar(nombre: string, alResultado: (r: CallToolResult) => void, muestra?: () => Record<string, unknown>): App {
  const app = new App({ name: nombre, version: "0.0.0" });
  app.ontoolresult = alResultado;
  app.onerror = console.error;
  if (sinHost && muestra) {
    alResultado({ content: [], structuredContent: muestra() });
  } else {
    void app.connect();
  }
  return app;
}
