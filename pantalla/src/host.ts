/**
 * Host de MCP Apps dentro de la pantalla: conecta con el server de belo desde
 * el navegador, lee el HTML de cada vista y la renderiza en un iframe con el
 * puente de ext-apps, igual que el host de referencia.
 */
import { AppBridge, PostMessageTransport, RESOURCE_MIME_TYPE, buildAllowAttribute, getToolUiResourceUri, type McpUiResourceCsp, type McpUiResourcePermissions, type McpUiMessageRequest } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult, type Resource, type Tool } from "@modelcontextprotocol/client";

const IMPLEMENTACION = { name: "belo agente", version: "0.0.0" };

/** El sandbox vive en otro origen: 127.0.0.1 contra localhost de la pantalla (o al revés). */
export function urlDelSandbox(): URL {
  const u = new URL(window.location.href);
  u.hostname = u.hostname === "localhost" ? "127.0.0.1" : "localhost";
  u.pathname = "/sandbox.html";
  u.search = "";
  u.hash = "";
  return u;
}

export interface Servidor {
  client: Client;
  tools: Map<string, Tool>;
  resources: Map<string, Resource>;
  html: Map<string, Promise<{ html: string; csp?: McpUiResourceCsp; permissions?: McpUiResourcePermissions }>>;
}

export async function conectarServidor(url: URL): Promise<Servidor> {
  const client = new Client(IMPLEMENTACION);
  await client.connect(new StreamableHTTPClientTransport(url));
  const [tools, resources] = await Promise.all([client.listTools(), client.listResources()]);
  return {
    client,
    tools: new Map(tools.tools.map((t) => [t.name, t])),
    resources: new Map(resources.resources.map((r) => [r.uri, r])),
    html: new Map(),
  };
}

/** La vista de una tool del server, si la tiene. */
export function vistaDe(servidor: Servidor, tool: string): string | undefined {
  const t = servidor.tools.get(tool);
  return t ? getToolUiResourceUri(t) : undefined;
}

async function leerVista(servidor: Servidor, uri: string) {
  let p = servidor.html.get(uri);
  if (!p) {
    p = (async () => {
      const r = await servidor.client.readResource({ uri });
      const c = r.contents[0];
      if (!c || c.mimeType !== RESOURCE_MIME_TYPE) throw new Error(`La vista ${uri} no es una MCP App`);
      const html = "blob" in c ? atob(c.blob as string) : (c.text as string);
      const meta = ((c as { _meta?: { ui?: { csp?: McpUiResourceCsp; permissions?: McpUiResourcePermissions } } })._meta?.ui) ?? ((servidor.resources.get(uri) as { _meta?: { ui?: { csp?: McpUiResourceCsp; permissions?: McpUiResourcePermissions } } } | undefined)?._meta?.ui);
      return { html, csp: meta?.csp, permissions: meta?.permissions };
    })();
    servidor.html.set(uri, p);
  }
  return p;
}

export interface OpcionesVista {
  alMensaje?: (m: McpUiMessageRequest["params"]) => void;
}

/** Renderiza la vista de una tool con su input y su resultado dentro de `contenedor`. */
export async function renderizarVista(servidor: Servidor, uri: string, contenedor: HTMLElement, input: Record<string, unknown>, resultado: Promise<CallToolResult>, opciones: OpcionesVista = {}): Promise<void> {
  const { html, csp, permissions } = await leerVista(servidor, uri);
  const iframe = document.createElement("iframe");
  iframe.className = "vista";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const allow = buildAllowAttribute(permissions);
  if (allow) iframe.setAttribute("allow", allow);
  contenedor.replaceChildren(iframe);

  const listo = new Promise<void>((resolve) => {
    const oir = ({ source, data }: MessageEvent) => {
      if (source === iframe.contentWindow && data?.method === "ui/notifications/sandbox-proxy-ready") {
        window.removeEventListener("message", oir);
        resolve();
      }
    };
    window.addEventListener("message", oir);
  });
  const u = urlDelSandbox();
  if (csp) u.searchParams.set("csp", JSON.stringify(csp));
  iframe.src = u.href;
  await listo;

  const caps = servidor.client.getServerCapabilities();
  const puente = new AppBridge(servidor.client, IMPLEMENTACION, {
    openLinks: {},
    serverTools: caps?.tools,
    serverResources: caps?.resources,
    updateModelContext: { text: {} },
  }, {
    hostContext: {
      theme: "dark",
      platform: "web",
      containerDimensions: { width: iframe.clientWidth || 640, maxHeight: 4000 },
      displayMode: "inline",
      availableDisplayModes: ["inline"],
    },
  });

  puente.onmessage = async (params) => {
    opciones.alMensaje?.(params);
    return {};
  };
  puente.onopenlink = async ({ url }) => {
    window.open(url, "_blank", "noopener,noreferrer");
    return {};
  };
  puente.onupdatemodelcontext = async () => ({});
  puente.onloggingmessage = () => {};
  puente.onsizechange = async ({ height }) => {
    if (height !== undefined) iframe.style.height = `${Math.ceil(height) + 2}px`;
  };
  puente.onrequestdisplaymode = async () => ({ mode: "inline" as const });

  const inicializada = new Promise<void>((resolve) => {
    puente.oninitialized = () => resolve();
  });
  await puente.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  await puente.sendSandboxResourceReady({ html, csp, permissions });
  await inicializada;
  puente.sendToolInput({ arguments: input });
  resultado.then(
    (r) => puente.sendToolResult(r),
    (e) => puente.sendToolCancelled({ reason: e instanceof Error ? e.message : String(e) }),
  );
}
