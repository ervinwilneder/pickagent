# pickagent

Un agente que resuelve envíos de mercadería y cobra por belo. Hecho en el
Buildathon 001 de belo (Buenos Aires, 28 de octubre de 2026). Demo viva en
https://pickagent.vercel.app.

Con el equipo se habla en español rioplatense. Las decisiones de diseño viven
en `.development/designs/` (empezá por `SITEMAP.md`); las convenciones del
producto, en `.development/AGENTS.md`. No hay README: la documentación es el
diseño, el OpenAPI y los comentarios.

## Qué hay

```
engines/logistica/      motor de agregación de transportistas y su MCP (vistas: formulario y ofertas)
interfaces/mcp/         server MCP de belo: tools, vistas (MCP Apps) y evento movimiento.nuevo (MCP Events)
interfaces/web/agente/  pickagent y el asistente personal sobre Mastra; pantalla/ es la UI en vivo (Vite)
.development/           diseños, investigación y convenciones
.biz/deck/              el deck de la presentación (slides bilingües)
```

Cada pieza es un paquete npm independiente con su lockfile: `npm ci` en cada
carpeta. Node 24 o más nuevo.

## Correr todo local

Cuatro procesos. Sin API key, el server de belo usa una cuenta de ejemplo en
memoria; dos instancias enlazadas simulan al cliente y a pickagent.

```sh
# 1. belo del cliente (cuenta de ejemplo), avisa a la cuenta de pickagent cuando le transfiere
cd interfaces/mcp && npm ci && npm run build:ui
BELO_LOG=1 PORT=3001 BELO_FALSO_PAR_BELOTAG=pickagent BELO_FALSO_PAR_URL=http://localhost:3004 BELO_FALSO_NOMBRE="Cliente de pickagent" npm run serve

# 2. belo de pickagent (cuenta de ejemplo)
BELO_LOG=1 PORT=3004 BELO_FALSO_NOMBRE=pickagent npm run serve

# 3. motor de logística
cd engines/logistica && npm ci && npm run build:ui
LOGISTICA_LOG=1 PORT=3002 PICKAGENT_BELOTAG=pickagent npm run serve

# 4. agentes (Mastra, Studio en http://localhost:4111)
cd interfaces/web/agente && npm ci
cat > .env <<EOT
ANTHROPIC_API_KEY=...
BELO_MCP_URL=http://localhost:3001/mcp
PICKAGENT_BELO_MCP_URL=http://localhost:3004/mcp
LOGISTICA_MCP_URL=http://localhost:3002/mcp
EOT
npm run dev

# 5. la pantalla (http://localhost:5173: landing en /, app en /app.html)
cd interfaces/web/agente/pantalla && npm ci
cat > .env <<EOT
VITE_MASTRA_URL=http://localhost:4111
VITE_BELO_MCP_URL=http://localhost:3001/mcp
VITE_PICKAGENT_BELO_MCP_URL=http://localhost:3004/mcp
VITE_LOGISTICA_MCP_URL=http://localhost:3002/mcp
EOT
npm run dev
```

Con una API key real de belo, el server de belo corre con `BELO_API_KEY` y
`BELO_BASE_URL` (juntas) en lugar de la cuenta de ejemplo. Los secretos nunca
van a git: `.env` está ignorado en cada paquete.

## Convenciones

- Dependencias en la última versión con al menos 3 días publicada; `npm ci`
  siempre; el diff del lockfile se revisa.
- Nada de legacy: lo que se reemplaza se borra en el mismo cambio.
- Sin suites de tests en el repo: se prueban en scratch, se commitean los fixes.
- Un cambio empieza por el diseño en `.development/designs/`.
