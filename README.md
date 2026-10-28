# pickagent

**Decile qué mandar. Un agente lo resuelve y lo cobra por belo.**

pickagent es un agente que resuelve envíos de mercadería: junta lo que falta en un
formulario, consulta a todos los transportistas agregados, muestra las mejores
ofertas con el precio pagando con belo, reserva, cobra y confirma solo cuando
entra el pago. Hecho en el Buildathon 001 de belo (Buenos Aires, 28 de octubre
de 2026).

Demo viva: **https://pickagent.vercel.app** (landing en `/`, app en `/app.html`).

## Qué tiene de nuevo

- **Agregación de transportistas.** Un motor simple y robusto al que una empresa
  se suma de dos formas: cargando su catálogo de servicios (el motor cotiza por
  ella) o conectando su API con tres llamadas (cotizar, crear, seguir). Andreani
  y Pickit entran así, hoy simulados con la forma de sus APIs. El motor es un
  server MCP con sus propias vistas.
- **MCP Events.** El server MCP de belo emite `movimiento.nuevo` (borrador
  SEP-3415, implementado con Mastra, por sondeo y sin estado). Cuando entra el
  pago en la cuenta de pickagent, el agente lo cruza con la reserva pendiente,
  la marca pagada y entrega el seguimiento, sin que nadie le escriba.
- **Agente always-on.** Claude y ChatGPT responden solo a un mensaje. pickagent
  corre sobre Mastra con señales: un evento en un hilo inactivo arranca un turno,
  y la pantalla está suscripta al hilo, así que el turno se ve escribiéndose en
  vivo, herramientas incluidas.
- **belo air.** Contra entrega sin efectivo: el chofer pide el monto exacto
  desde su belo, el cliente acerca el teléfono, revisa y confirma. El evento de
  belo confirma la entrega y el cobro.
- **MCP Apps.** El formulario, las ofertas y la aprobación de belo son HTML del
  server que corre en sandbox dentro del chat. Los mismos MCP sirven en Claude
  Desktop (con vistas), en ChatGPT (en texto) y en la pantalla propia.

## Cómo funciona un envío

1. La persona cuenta el envío en una frase.
2. Se abre el formulario, precargado con lo que ya dijo.
3. El motor consulta a todos los transportistas en paralelo y devuelve hasta
   cinco ofertas con precio de lista y precio con belo.
4. La persona elige y paga: transferencia a pickagent con la aprobación de belo,
   o contra entrega con belo air.
5. El evento de belo avisa el depósito; pickagent confirma la reserva y da el
   código de seguimiento.

El cliente le paga a pickagent (la cuenta de belo de la empresa). Lo que
pickagent les paga después a los transportistas es un proceso de fondo, fuera
de la conversación.

## Arquitectura

```
pantalla (Vite)  ──suscripta al hilo──▶  agentes (Mastra)  ──MCPClient──▶  motor de logística (MCP)
   │  vistas en sandbox                    pickagent                          │  transportistas por catálogo y por API
   │  switch de agente y de belo           mi asistente (con / sin belo)      │  pedidos, ofertas, reservas, seguimiento
   └──────────────────────────────────────▶  señales por eventos  ◀──────────▶  belo (MCP + API)
hosts externos (Claude, ChatGPT) usan los mismos MCP                             │  saldos, transferencias, pix, cobros
                                                                                  │  evento movimiento.nuevo, belo air
```

## Estructura del repo

```
engines/logistica/      motor de agregación de transportistas y su MCP (vistas: formulario y ofertas)
interfaces/mcp/         server MCP de belo: tools, vistas (MCP Apps) y evento movimiento.nuevo (MCP Events)
interfaces/web/agente/  pickagent y el asistente personal sobre Mastra; pantalla/ es la UI en vivo
.development/           diseños (empezá por designs/SITEMAP.md), investigación y convenciones
.biz/deck/              el deck de la presentación, bilingüe
```

## Correr todo local

Cuatro procesos más la pantalla. Sin API key, el server de belo usa una cuenta
de ejemplo en memoria; dos instancias enlazadas simulan al cliente y a
pickagent. Node 24 o más nuevo; `npm ci` en cada paquete.

```sh
# 1. belo del cliente (cuenta de ejemplo); avisa a la cuenta de pickagent cuando le transfiere
cd interfaces/mcp && npm ci && npm run build:ui
BELO_LOG=1 PORT=3001 BELO_FALSO_PAR_BELOTAG=pickagent BELO_FALSO_PAR_URL=http://localhost:3004 BELO_FALSO_NOMBRE="Cliente de pickagent" npm run serve

# 2. belo de pickagent (cuenta de ejemplo)
BELO_LOG=1 PORT=3004 BELO_FALSO_NOMBRE=pickagent npm run serve

# 3. motor de logística
cd engines/logistica && npm ci && npm run build:ui
LOGISTICA_LOG=1 PORT=3002 PICKAGENT_BELOTAG=pickagent npm run serve

# 4. agentes (Mastra; Studio en http://localhost:4111)
cd interfaces/web/agente && npm ci
cat > .env <<EOT
ANTHROPIC_API_KEY=...
BELO_MCP_URL=http://localhost:3001/mcp
PICKAGENT_BELO_MCP_URL=http://localhost:3004/mcp
LOGISTICA_MCP_URL=http://localhost:3002/mcp
EOT
npm run dev

# 5. pantalla (http://localhost:5173)
cd interfaces/web/agente/pantalla && npm ci
cat > .env <<EOT
VITE_MASTRA_URL=http://localhost:4111
VITE_BELO_MCP_URL=http://localhost:3001/mcp
VITE_PICKAGENT_BELO_MCP_URL=http://localhost:3004/mcp
VITE_LOGISTICA_MCP_URL=http://localhost:3002/mcp
EOT
npm run dev
```

Con una API key real de belo, el server corre con `BELO_API_KEY` y
`BELO_BASE_URL` (las dos juntas) en lugar de la cuenta de ejemplo. Los secretos
nunca van a git.

Para usar los MCP desde Claude Desktop o ChatGPT, agregá como conector
personalizado la URL del server (`http://localhost:3002/mcp` para el motor,
`http://localhost:3001/mcp` para belo), publicada por un túnel si el host no
llega a tu máquina.

## Guion para probar

Abrí la pantalla con el switch en **mi asistente** y **belo conectado** prendido.

1. "Necesito mandar 20 cajas de repuestos, unos 120 kilos, desde Villa Crespo a
   Rosario antes del viernes a las 10. Es frágil." Se abre el formulario;
   completalo y buscá ofertas.
2. Elegí una oferta con **Elegir y pagar con belo**; decí "por adelantado".
3. Aprobá la transferencia en la vista de belo.
4. Sin escribir nada: el pago sale, la reserva se confirma, llega el seguimiento.
5. Cambiá a **pickagent**: se ve el depósito entrando y el cruce con la reserva,
   con las llamadas a herramientas a la vista.
6. Otro pedido con "pago contra entrega con belo air".
7. Apagá **belo conectado** y repetí: mismo pedido, a precio de lista y pago manual.

## Cómo se trabaja

Las convenciones están en [`AGENTS.md`](AGENTS.md) y en
[`.development/AGENTS.md`](.development/AGENTS.md). Un cambio empieza por el
diseño en `.development/designs/`. Dependencias en la última versión con al
menos tres días publicada; nada de legacy; sin suites de tests en el repo.

Licencia MIT.
