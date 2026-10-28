/**
 * Host de MCP Apps dentro de la pantalla: conecta con el server de belo desde
 * el navegador, lee el HTML de cada vista y la renderiza en un iframe con el
 * puente de ext-apps, igual que el host de referencia.
 */
import { AppBridge, PostMessageTransport, RESOURCE_MIME_TYPE, buildAllowAttribute, getToolUiResourceUri, type McpUiResourceCsp, type McpUiResourcePermissions, type McpUiMessageRequest } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult, type Resource, type Tool } from "@modelcontextprotocol/client";

const IMPLEMENTACION = { name: "belo agente", version: "0.0.0" };

/**
 * El sandbox vive en otro origen que la pantalla. En local, 127.0.0.1 contra
 * localhost (o al revés); publicada, el dominio que diga VITE_SANDBOX_URL.
 */
export function urlDelSandbox(): URL {
  const configurada = import.meta.env.VITE_SANDBOX_URL as string | undefined;
  if (configurada) return new URL(configurada);
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
  const tools = await client.listTools();
  const resources = await client.listResources();
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
      // Un pedido que no vuelve se reintenta una vez; la vista pesa unos 350 KB.
      const leer = () => servidor.client.readResource({ uri });
      const conPlazo = (q: Promise<Awaited<ReturnType<typeof leer>>>) => Promise.race([q, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("sin respuesta")), 10_000))]);
      const r = await conPlazo(leer()).catch(() => conPlazo(leer()));
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
  alEstado?: (paso: string) => void;
}

/** Renderiza la vista de una tool con su input y su resultado dentro de `contenedor`. */
export async function renderizarVista(servidor: Servidor, uri: string, contenedor: HTMLElement, input: Record<string, unknown>, resultado: Promise<CallToolResult>, opciones: OpcionesVista = {}): Promise<void> {
  const paso = (t: string) => opciones.alEstado?.(t);
  paso("leyendo la vista");
  const { html, csp, permissions } = await leerVista(servidor, uri);
  paso("cargando el sandbox");
  const iframe = document.createElement("iframe");
  iframe.className = "vista";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const allow = buildAllowAttribute(permissions);
  if (allow) iframe.setAttribute("allow", allow);
  contenedor.replaceChildren(iframe);

  const listo = new Promise<void>((resolve, reject) => {
    const oir = ({ source, data }: MessageEvent) => {
      if (source !== iframe.contentWindow) return;
      if (data?.method === "ui/notifications/sandbox-proxy-ready") {
        window.removeEventListener("message", oir);
        resolve();
      } else if (data?.method === "belo/sandbox-error") {
        window.removeEventListener("message", oir);
        reject(new Error(String(data.params?.mensaje ?? "el sandbox falló")));
      }
    };
    window.addEventListener("message", oir);
  });
  const u = urlDelSandbox();
  if (csp) u.searchParams.set("csp", JSON.stringify(csp));
  iframe.src = u.href;
  await Promise.race([listo, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`el sandbox en ${u.origin} no respondió`)), 15_000))]);
  paso("sandbox listo");

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
  paso("vista enviada, esperando que inicialice");
  await Promise.race([inicializada, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("la vista no inicializó")), 15_000))]);
  paso("vista inicializada");
  puente.sendToolInput({ arguments: input });
  resultado.then(
    (r) => puente.sendToolResult(r),
    (e) => puente.sendToolCancelled({ reason: e instanceof Error ? e.message : String(e) }),
  );
}
