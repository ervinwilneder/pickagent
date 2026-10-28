# Agente de belo: un cliente siempre encendido

Revisión: 2026-10-28. Estado: borrador para construir hoy, en el Buildathon 001.

## Qué es

Un cliente propio donde vive un agente que no espera que le hablen: está
conectado al server MCP de belo (`interfaces/mcp`), muestra sus vistas (MCP
Apps) dentro del chat y se suscribe a sus eventos (MCP Events). Cuando entra
un movimiento en la cuenta, el agente se entera, piensa y actúa: avisa,
propone una cotización, pide el OK. La persona conversa con él cuando quiere;
el agente conversa cuando pasa algo.

Es lo que ni Claude ni ChatGPT pueden hacer hoy: los dos son por turnos y
ninguno consume eventos. Esta pieza demuestra la otra mitad del "agentic
banking": el agente que trabaja aunque nadie esté mirando.

## Objetivos

- Un agente conectado al server MCP de belo por `MCPClient`, con todas sus
  tools y sus vistas renderizadas en el chat.
- Suscripción al evento `movimiento.nuevo`; cada evento llega al hilo del
  agente como una señal que arranca un turno si el hilo está inactivo.
- El agente responde al evento en el mismo hilo: cuenta qué entró y propone
  el siguiente paso en términos de belo, usando las tools (por ejemplo
  cotizar una conversión y mostrar la vista de aprobación).
- Memoria persistente del hilo, para que la conversación sobreviva a
  reinicios.
- Demo en la laptop de Ervin, contra el server local de staging (o el de
  producción con la cuenta de ejemplo).

## No objetivos (hoy)

- Una interfaz propia: la UI es Mastra Studio, que ya renderiza MCP Apps y
  muestra el hilo. Una interfaz de producto (web o escritorio) va después,
  sobre el mismo agente, con AG-UI o CopilotKit, que también renderizan
  MCP Apps.
- Canales externos (Telegram, WhatsApp, Slack): se agregan como salida del
  mismo agente cuando haga falta.
- Identidad por persona (OAuth de belo): el server de belo opera hoy la
  organización del sandbox por API key.

## Por qué Mastra

Mastra trae las tres capacidades que el cliente necesita, en un solo stack
y con versiones del mismo mes:

- `Agent` con `signals`: un `SignalProvider` entrega notificaciones a un
  hilo y, si el hilo está inactivo, arranca un turno sin mensaje del
  usuario. Es la definición de "always-on".
- `MCPEventsSignalProvider` (`@mastra/mcp/integrations`): convierte las
  suscripciones a eventos MCP en señales; `subscribeThread(hilo, {server,
  event, args})`. Guarda el cursor en un `MCPEventCursorStore`.
- Studio renderiza MCP Apps en el chat del agente: las tools cargadas con
  `MCPClient.listTools()` llevan el `serverId` en `_meta.ui` y
  `toMCPServerProxies()` registra los servers externos en la instancia de
  `Mastra` para resolver los recursos `ui://`.

Alternativas descartadas hoy: OpenDots (agentes persistentes con conexiones
MCP, pero sin MCP Apps ni eventos, y atado al servicio hosteado CopilotKit
Intelligence) y OpenMuse (agente personal con computadora propia, mismo
problema). Las dos sirven de referencia para la interfaz de producto.

## Arquitectura

```
  Studio (navegador) ── chat + vistas MCP Apps
        │
  Mastra (Node, laptop)
   ├─ Agent "belo"  ── tools de MCPClient("belo") ── server MCP de belo (local :3001 o Vercel)
   │     └─ signals: [MCPEventsSignalProvider(client)]  ── events/poll movimiento.nuevo
   ├─ Memory + storage LibSQL (archivo local)  ── hilos, mensajes, notificaciones
   └─ mcpServers: proxies de MCPClient  ── para que Studio resuelva ui://
```

Flujo del evento: el server de belo detecta un movimiento nuevo (lee el
historial desde el cursor) → el provider lo recibe por poll cada 5 s →
`notify()` crea una notificación en el hilo suscripto → si el hilo está
inactivo, arranca un turno → el agente razona con las instrucciones y las
tools → la respuesta aparece en el hilo de Studio (y, si usa una tool con
vista, la vista se renderiza).

## Repo

`interfaces/web/agente`: proyecto Mastra (TypeScript, npm, `mastra dev`).

- `src/mastra/index.ts`: instancia `Mastra` con storage LibSQL, el agente y
  los proxies de MCP.
- `src/mastra/belo.ts`: `MCPClient` apuntando al server de belo (URL por
  configuración, sin default de producción), el `MCPEventsSignalProvider`
  y el `Agent`.
- `src/mastra/instrucciones.ts`: cómo se comporta el agente en términos de
  belo (las mismas reglas del server: cotizar, mostrar, aprobar, nunca
  mecanismos internos).
- `escuchar.ts`: suscribe el hilo principal al evento al arrancar.

Modelo: Claude por la API de Anthropic (`ANTHROPIC_API_KEY`), con el
router de modelos de Mastra.

## Riesgos y preguntas abiertas

- Studio es una herramienta de desarrollo; para el pitch alcanza, para
  producto no. La interfaz propia es el paso siguiente.
- Un turno arrancado por señal gasta tokens por cada evento; para la demo
  es deseable, en producción se filtra por tipo y monto.
- El server de belo expone eventos solo en modo poll (corre sin estado en
  Vercel); el provider lo soporta.
- Falta verificar en vivo cómo Studio muestra un turno iniciado por señal
  cuando nadie tiene el hilo abierto.
