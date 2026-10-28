/**
 * Proxy del sandbox (origen distinto al de la pantalla): crea el iframe
 * interno con el HTML de la vista y releva los mensajes entre la pantalla y
 * la vista. Misma arquitectura que el host de referencia de MCP Apps.
 */
import { buildAllowAttribute, type McpUiSandboxProxyReadyNotification, type McpUiSandboxResourceReadyNotification } from "@modelcontextprotocol/ext-apps/app-bridge";

/** Un error de arranque se le cuenta al host antes de abortar, para poder diagnosticarlo. */
function abortar(mensaje: string): never {
  try {
    window.parent?.postMessage({ jsonrpc: "2.0", method: "belo/sandbox-error", params: { mensaje } }, "*");
  } catch {}
  throw new Error(mensaje);
}
if (window.self === window.top) abortar("Este archivo solo corre dentro de un iframe.");
if (!document.referrer) abortar("Sin referrer: no se puede validar quién embebe.");
const ORIGEN_PANTALLA = new URL(document.referrer).origin;
// Quién puede embeber el sandbox: la pantalla local, o la publicada (VITE_PANTALLA_ORIGEN).
const permitidos = [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, ...String(import.meta.env.VITE_PANTALLA_ORIGEN ?? "").split(",").filter(Boolean).map((o) => new RegExp(`^${o.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))];
if (!permitidos.some((re) => re.test(ORIGEN_PANTALLA))) abortar(`Origen no permitido: ${ORIGEN_PANTALLA}`);
const ORIGEN_PROPIO = new URL(window.location.href).origin;

// Si window.top fuera accesible, el sandbox estaría mal configurado.
try {
  window.top!.alert("sandbox roto");
  throw "FALLA";
} catch (e) {
  if (e === "FALLA") abortar("El sandbox no está aislado.");
}

const interno = document.createElement("iframe");
interno.setAttribute("style", "width:100%; height:100%; border:none;");
interno.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
document.body.appendChild(interno);

const RECURSO_LISTO: McpUiSandboxResourceReadyNotification["method"] = "ui/notifications/sandbox-resource-ready";
const PROXY_LISTO: McpUiSandboxProxyReadyNotification["method"] = "ui/notifications/sandbox-proxy-ready";

window.addEventListener("message", (event) => {
  if (event.source === window.parent) {
    if (event.origin !== ORIGEN_PANTALLA) return;
    if (event.data?.method === RECURSO_LISTO) {
      const { html, sandbox, permissions } = event.data.params;
      if (typeof sandbox === "string") interno.setAttribute("sandbox", sandbox);
      const allow = buildAllowAttribute(permissions);
      if (allow) interno.setAttribute("allow", allow);
      if (typeof html === "string") {
        const doc = interno.contentDocument ?? interno.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        } else {
          interno.srcdoc = html;
        }
      }
    } else {
      interno.contentWindow?.postMessage(event.data, "*");
    }
  } else if (event.source === interno.contentWindow) {
    if (event.origin !== ORIGEN_PROPIO) return;
    window.parent.postMessage(event.data, ORIGEN_PANTALLA);
  }
});

window.addEventListener("error", (e) => abortar(`error en el sandbox: ${e.message}`));
window.parent.postMessage({ jsonrpc: "2.0", method: PROXY_LISTO, params: {} }, ORIGEN_PANTALLA);
