import { defineConfig, type Plugin } from "vite";

/** sandbox.html se sirve con la CSP de la vista por cabecera HTTP (?csp=...), como el host de referencia de MCP Apps. */
function cspDelSandbox(): Plugin {
  const limpiar = (xs?: string[]) => (xs ?? []).filter((d) => /^[a-z0-9.*:/-]+$/i.test(d)).join(" ");
  return {
    name: "csp-del-sandbox",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/sandbox.html")) return next();
        let csp: { resourceDomains?: string[]; connectDomains?: string[]; frameDomains?: string[] } = {};
        try {
          const q = new URL(req.url, "http://x").searchParams.get("csp");
          if (q) csp = JSON.parse(q);
        } catch {}
        const recursos = limpiar(csp.resourceDomains);
        const conexiones = limpiar(csp.connectDomains);
        const marcos = limpiar(csp.frameDomains) || "'none'";
        res.setHeader("Content-Security-Policy", [
          "default-src 'none'",
          `script-src 'self' 'unsafe-inline' ${recursos}`,
          `style-src 'self' 'unsafe-inline' ${recursos}`,
          `img-src 'self' data: ${recursos}`,
          `font-src 'self' data: ${recursos}`,
          `media-src 'self' data: ${recursos}`,
          `connect-src 'self' ${conexiones}`,
          `frame-src ${marcos}`,
          "object-src 'none'",
          "base-uri 'self'",
        ].join("; "));
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [cspDelSandbox()],
  build: { rollupOptions: { input: { index: "index.html", sandbox: "sandbox.html" } } },
});
