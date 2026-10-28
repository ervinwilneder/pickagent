# belo — hackathon de agentic banking

Producto de Ervin Wilneder nacido en el Buildathon 001 de belo (Buenos Aires,
2026-10-28): lo que se construye sobre el MCP de belo
(`https://b2b.belo.app/mcp`). Sigue las convenciones de `~/Projects/AGENTS.md`
e identidad `me`.

EGM artifact directory: .development/designs

## Contexto

- `.development/research/`: el informe "belo MCP y agentic banking" (2026-10-28),
  sus notas de investigación, el catálogo de las 18 tools del MCP y el
  instructivo oficial de conexión.
- El MCP está agregado en la configuración de usuario de Claude Code (`belo`,
  OAuth con la cuenta de Google ervinwilneder@gmail.com). Toda operación que
  mueve plata es preview → link de aprobación en belo → confirm; las
  cotizaciones vencen a los 60 segundos y el link a los 15 minutos.
- La cuenta conectada hoy es la personal de producción. Los términos del
  buildathon piden sandbox con fondos ficticios: confirmar con la organización
  antes de la demo.

## Repos

- `interfaces/mcp`: el server de la MCP App de belo (Mastra `MCPServer`):
  tools con vista para los hosts que renderizan MCP Apps (Claude web y
  Desktop, VS Code Copilot, Goose, Postman; ChatGPT usa su propio Apps SDK),
  eventos de la cuenta por la extensión MCP Events (borrador SEP-3415:
  `events/list`, `poll`, `stream`, `subscribe`) y un puerto de belo con dos
  adaptadores: REST con API key de organización y una cuenta falsa en
  memoria para la demo. Los tipos de belo se generan del OpenAPI de staging
  (`.development/research/api/belo-baas-openapi.json`).

- `interfaces/web/agente`: los agentes sobre Mastra (diseños en
  `designs/agente.md` y `designs/pickagent.md`): pickagent (conectado a
  logística y belo, expuesto además como MCP), el asistente personal con
  belo y sin belo, señales por eventos de belo, memoria en LibSQL, Studio en
  `:4111` y la pantalla propia en `pantalla/` (`:5173`, publicada en
  `pickagent.vercel.app`: landing en `/`, app en `/app.html`, sandbox en
  `pickagent-sandbox.vercel.app`; identidad propia de pickagent, no la de belo).
  Configuración: `BELO_MCP_URL`, `LOGISTICA_MCP_URL`, `ANTHROPIC_API_KEY`,
  opcional `BELO_AGENTE_MODELO` y `BELO_AGENTE_PERSONA`.

- `engines/logistica`: el motor de logística de pickagent (diseño en
  `designs/pickagent.md`): dominio, localidades con coordenadas, puerto de
  transportista con dos adaptadores (catálogo y conectado por API, con
  Andreani y Pickit simulados), registro con fallas aisladas, y su MCP con
  las vistas de formulario y ofertas. Corre en `:3002`.

## Excepciones de versiones (2026-10-28)

- `typescript` 5.9.3: `openapi-typescript` exige `^5` y TypeScript 7 no
  expone `ts.factory`. Se sube cuando el generador lo soporte.
- `@mastra/mcp` 2.6.0 se instaló el mismo día que salió: la 2.5.0 rechaza a
  los clientes del protocolo 2025 (`initialize`), que es como abren Claude
  Desktop y claude.ai, y solo la 2.6.0 trae `legacy: "stateless"`.
- `@modelcontextprotocol/ext-apps` 2.0.3: la 2.0.4 y la 2.1.0 salieron el
  27/10. Se sube el 30/10.

## Estado

- 2026-10-28 (Buildathon 001): pickagent completo y probado de punta a punta
  con el modelo de cobro definitivo: el cliente le paga a pickagent (cuenta
  de belo de la empresa), pickagent cruza el depósito con la reserva
  pendiente y la confirma solo. La liquidación a los transportistas (neto
  menos comisión, desde su belo) existe en el motor como proceso de fondo:
  no se ve en la conversación ni en la demo. Contra entrega con belo air: cobra el
  chofer y el neteo descuenta la comisión. Un solo cliente, ya logueado.
  Tres agentes en Studio (`:4111`) y en la pantalla
  (`pickagent.vercel.app/app.html`, switch pickagent / mi asistente e interruptor
  "belo conectado"). Servers locales: belo cliente `:3001`, belo pickagent
  `:3004` (cuentas de ejemplo enlazadas), belo staging `:3003`, logística
  `:3002`; túneles para los dos belo, logística y el agente.
- Pendiente con belo: permiso de transferencias para la key de staging (hoy
  el pago real solo corre contra las cuentas de ejemplo), el 502 al crear
  cobros, y cómo habilitan `/api/v1` para un server en la nube.
- Pendiente nuestro: identidad por persona (OAuth de belo) y capa de
  clientes, clientes reales de Andreani y Pickit cuando haya credenciales,
  API para que los transportistas carguen su catálogo, graduar la carpeta a
  `pickagent/`.
